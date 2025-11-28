"""
Journal routes - Extracted from server.py
Handles journal entry CRUD, audio/video transcription, and video processing
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging
import io
import os
import tempfile
import subprocess

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo

router = APIRouter(prefix="/journal", tags=["journal"])

# ============= MODELS =============

class JournalEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    content: str
    entry_type: str = "text"
    video_path: Optional[str] = None
    subtitle_path: Optional[str] = None
    has_burned_subtitles: Optional[bool] = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

# ============= HELPER FUNCTIONS =============

def format_timestamp(seconds):
    """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

# ============= ROUTES =============

@router.get("/{athlete_id}")
async def get_journal_entries(athlete_id: str):
    """Get all journal entries for an athlete"""
    entries = await db.journal_entries.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(length=100)
    
    return {"entries": [parse_from_mongo(entry) for entry in entries]}


@router.post("")
async def create_journal_entry(entry: JournalEntry):
    """Create a new journal entry"""
    entry_dict = prepare_for_mongo(entry.model_dump())
    await db.journal_entries.insert_one(entry_dict)
    return {"success": True, "id": entry.id}


@router.put("/{entry_id}")
async def update_journal_entry(entry_id: str, content: dict):
    """Update a journal entry"""
    update_data = {
        "content": content.get("content"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.journal_entries.update_one(
        {"id": entry_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    return {"success": True}


@router.delete("/{entry_id}")
async def delete_journal_entry(entry_id: str):
    """Delete a journal entry"""
    result = await db.journal_entries.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    return {"success": True}


@router.post("/transcribe/{athlete_id}")
async def transcribe_audio(athlete_id: str, audio: UploadFile = File(...)):
    """Transcribe audio to text using OpenAI Whisper"""
    import openai
    
    try:
        # Get OpenAI API key from system_settings
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not found. Please add your OpenAI API key in System Settings → Advanced tab (Super Admin only), then try again."
            )
        
        openai_key = system_settings['advanced']['openaiApiKey']
        
        # Read audio file
        audio_content = await audio.read()
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=openai_key)
        
        # Transcribe using Whisper
        audio_file = io.BytesIO(audio_content)
        audio_file.name = audio.filename or "audio.wav"
        
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text"
        )
        
        return {"transcription": transcription}
        
    except openai.OpenAIError as e:
        error_message = str(e)
        if "invalid_api_key" in error_message.lower() or "incorrect api key" in error_message.lower():
            raise HTTPException(
                status_code=400, 
                detail="Invalid OpenAI API key. Please update your API key in System Settings → Advanced tab."
            )
        raise HTTPException(status_code=500, detail=f"Transcription failed: {error_message}")
    except Exception as e:
        logging.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")


@router.post("/transcribe-video/{athlete_id}")
async def transcribe_video(athlete_id: str, video: UploadFile = File(...)):
    """Transcribe video to text with timestamps using OpenAI Whisper"""
    import openai
    
    try:
        # Get OpenAI API key from system_settings
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not found. Please add your OpenAI API key in System Settings → Advanced tab (Super Admin only), then try again."
            )
        
        openai_key = system_settings['advanced']['openaiApiKey']
        
        # Read video file
        video_content = await video.read()
        
        # Create temporary files for video and audio
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as video_temp:
            video_temp.write(video_content)
            video_temp_path = video_temp.name
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as audio_temp:
            audio_temp_path = audio_temp.name
        
        try:
            # Extract audio from video using FFmpeg
            subprocess.run([
                'ffmpeg', '-i', video_temp_path,
                '-vn',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                audio_temp_path,
                '-y'
            ], check=True, capture_output=True)
            
            # Create OpenAI client
            client = openai.OpenAI(api_key=openai_key)
            
            # Transcribe audio with timestamps using Whisper
            with open(audio_temp_path, 'rb') as audio_file:
                transcription = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )
            
            # Generate SRT subtitle format
            srt_content = ""
            for i, segment in enumerate(transcription.segments, 1):
                start_time = format_timestamp(segment['start'])
                end_time = format_timestamp(segment['end'])
                text = segment['text'].strip()
                srt_content += f"{i}\n{start_time} --> {end_time}\n{text}\n\n"
            
            return {
                "transcription": transcription.text,
                "srt": srt_content,
                "segments": transcription.segments
            }
            
        finally:
            # Clean up temporary files
            if os.path.exists(video_temp_path):
                os.unlink(video_temp_path)
            if os.path.exists(audio_temp_path):
                os.unlink(audio_temp_path)
        
    except openai.OpenAIError as e:
        error_message = str(e)
        if "invalid_api_key" in error_message.lower() or "incorrect api key" in error_message.lower():
            raise HTTPException(
                status_code=400, 
                detail="Invalid OpenAI API key. Please update your API key in System Settings → Advanced tab."
            )
        raise HTTPException(status_code=500, detail=f"Transcription failed: {error_message}")
    except Exception as e:
        logging.error(f"Error transcribing video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe video: {str(e)}")


@router.post("/process-video/{athlete_id}")
async def process_video_journal(
    athlete_id: str,
    video: UploadFile = File(...),
    transcription: str = Form(...),
    srt_content: str = Form(...),
    burn_subtitles: bool = Form(False)
):
    """Process video journal entry with optional subtitle burning"""
    try:
        # Create unique filename
        video_id = str(uuid.uuid4())
        video_filename = f"{athlete_id}_{video_id}.mp4"
        subtitle_filename = f"{athlete_id}_{video_id}.srt"
        
        video_dir = "/app/backend/uploaded_videos/journal"
        video_path = os.path.join(video_dir, video_filename)
        subtitle_path = os.path.join(video_dir, subtitle_filename)
        
        # Read uploaded video
        video_content = await video.read()
        
        if burn_subtitles:
            # Create temporary files
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as input_temp:
                input_temp.write(video_content)
                input_temp_path = input_temp.name
            
            with tempfile.NamedTemporaryFile(suffix='.srt', delete=False, mode='w') as srt_temp:
                srt_temp.write(srt_content)
                srt_temp_path = srt_temp.name
            
            try:
                # Burn subtitles into video with compression
                subprocess.run([
                    'ffmpeg', '-i', input_temp_path,
                    '-vf', f"subtitles={srt_temp_path}:force_style='FontSize=18,PrimaryColour=&HFFFFFF,BackColour=&H80000000,BorderStyle=3,Outline=1,Shadow=2'",
                    '-c:v', 'libx264',
                    '-crf', '28',
                    '-preset', 'medium',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    video_path,
                    '-y'
                ], check=True, capture_output=True)
                
                final_video_path = video_path
                final_subtitle_path = None
                
            finally:
                # Clean up temp files
                if os.path.exists(input_temp_path):
                    os.unlink(input_temp_path)
                if os.path.exists(srt_temp_path):
                    os.unlink(srt_temp_path)
        else:
            # Save video with compression (no subtitles burned in)
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as input_temp:
                input_temp.write(video_content)
                input_temp_path = input_temp.name
            
            try:
                # Compress video
                subprocess.run([
                    'ffmpeg', '-i', input_temp_path,
                    '-c:v', 'libx264',
                    '-crf', '28',
                    '-preset', 'medium',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    video_path,
                    '-y'
                ], check=True, capture_output=True)
                
                # Save separate subtitle file
                with open(subtitle_path, 'w') as srt_file:
                    srt_file.write(srt_content)
                
                final_video_path = video_path
                final_subtitle_path = subtitle_path
                
            finally:
                if os.path.exists(input_temp_path):
                    os.unlink(input_temp_path)
        
        # Create journal entry
        entry = JournalEntry(
            athlete_id=athlete_id,
            content=transcription,
            entry_type="video",
            video_path=f"/api/uploaded_videos/journal/{video_filename}",
            subtitle_path=f"/api/uploaded_videos/journal/{subtitle_filename}" if final_subtitle_path else None,
            has_burned_subtitles=burn_subtitles
        )
        
        # Save to database
        entry_dict = entry.model_dump()
        entry_dict = prepare_for_mongo(entry_dict)
        await db.journal_entries.insert_one(entry_dict)
        
        return {
            "success": True,
            "entry": entry
        }
        
    except Exception as e:
        logging.error(f"Error processing video journal: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")
