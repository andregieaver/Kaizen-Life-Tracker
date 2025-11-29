"""
Voice Realtime API Routes
Handles OpenAI Realtime Voice API for AI coach voice interactions
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime, timezone
import logging
import uuid

from database import db

# Create router
router = APIRouter(prefix="/api", tags=["voice_realtime"])

# Logger
logger = logging.getLogger(__name__)


# ==================== Pydantic Models ====================

class VoiceTranscriptTurn(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime


class VoiceConversationSave(BaseModel):
    athlete_id: str
    transcript: List[VoiceTranscriptTurn]
    session_id: str
    duration_seconds: int


# ==================== Helper Functions ====================

async def get_realtime_chat_for_athlete(athlete_id: str):
    """Get or create realtime chat instance for athlete"""
    # Import here to avoid circular dependencies
    from ai_coach_service import AICoachService
    
    # Get OpenAI API key from system settings
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    if not system_settings:
        raise HTTPException(status_code=500, detail="System settings not found")
    
    openai_api_key = system_settings.get('advanced', {}).get('openaiApiKey')
    if not openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    # Create AI coach service instance
    ai_coach = AICoachService(openai_api_key)
    
    return ai_coach


# ==================== Voice Realtime Endpoints ====================

@router.post("/coach/voice/session/{athlete_id}")
async def create_voice_session(athlete_id: str):
    """Create a new realtime voice session for the athlete"""
    try:
        print(f"[VOICE] Starting voice session creation for athlete {athlete_id}")
        
        # Get the realtime chat instance for this athlete (this can raise HTTPException)
        ai_coach = await get_realtime_chat_for_athlete(athlete_id)
        print(f"[VOICE] Realtime chat instance created")
        
        # Get athlete context for the voice session
        context = await ai_coach.get_athlete_context(athlete_id)
        print(f"[VOICE] Athlete context retrieved")
        
        # Create the system message with athlete context (similar to text chat)
        athlete_info = context.get('athlete', {})
        distance_unit = athlete_info.get('distance_unit', 'miles')
        measurement_system = athlete_info.get('measurement_system', 'imperial')
        voice_preference = athlete_info.get('voice_preference', 'alloy')
        coach_language = athlete_info.get('coach_language', 'en')
        coach_personality = athlete_info.get('coach_personality', None)
        
        # Language name mapping
        language_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 
            'it': 'Italian', 'pt': 'Portuguese', 'nl': 'Dutch', 'no': 'Norwegian',
            'sv': 'Swedish', 'da': 'Danish', 'fi': 'Finnish', 'pl': 'Polish',
            'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean'
        }
        language_name = language_names.get(coach_language, 'English')
        
        # Personality instructions
        personality_instructions = {
            'zen': """
Tone and style:
- Speak simply, clearly, and briefly.
- Use a soothing, grounded tone, not hype.
- Focus on one main point at a time.
- Avoid jargon unless you explain it in one sentence.

Coaching philosophy:
- Consistency beats intensity.
- Emphasize breath, form, and recovery.
- Encourage small daily wins, not perfection.
- Gently challenge all-or-nothing thinking.

Behavior:
- Never shame the user.
- If the user is overwhelmed, simplify their plan.
- If they miss workouts, respond with compassion and a realistic restart plan.
- Always give 1–3 concrete next steps they can do today.""",
            
            'science': """
Tone and style:
- Sound curious and excited about data.
- Use simple analogies to explain complex physiology.
- Be precise but not pedantic: explain in plain language first, details second.
- Avoid overwhelming walls of text; use short paragraphs and lists.

Coaching philosophy:
- Base recommendations on exercise science and recovery principles.
- Use metrics like HRV, VO₂max, RHR, sleep duration/quality when available.
- Explain trade-offs (e.g., performance vs recovery, strength vs endurance).

Behavior:
- When giving advice, briefly mention the reasoning ("because…") in 1–2 sentences.
- Invite the user to track 1–3 key metrics, not 20.
- Never fake citations; if evidence is uncertain, say so and offer best-practice guidance.""",
            
            'tough': """
Tone and style:
- Direct, firm, and slightly playful.
- Use short, punchy sentences.
- Mild, friendly teasing is okay, but never insult or humiliate.
- No profanity stronger than PG-13.

Coaching philosophy:
- Discipline over motivation.
- Focus on doing the work even when it's not fun.
- Break big goals into small, non-negotiable actions.

Behavior:
- Call out excuses gently but firmly.
- Celebrate consistency more than big results.
- Remind the user: "You said you would. Now do it."
- If they're burned out, tell them to rest and come back stronger."""
        }
        
        personality_prompt = ""
        if coach_personality and coach_personality in personality_instructions:
            personality_prompt = f"\n\nCoaching Personality ({coach_personality.upper()}):\n{personality_instructions[coach_personality]}"
        
        # Build system instructions for voice
        system_instructions = f"""You are an expert running coach and athletic training assistant. You're having a voice conversation with {athlete_info.get('name', 'an athlete')}.

CRITICAL LANGUAGE REQUIREMENT:
- You MUST speak ONLY in {language_name}
- All your responses must be in {language_name}
- Do not switch languages under any circumstances

Response Guidelines:
- Keep responses concise and natural for voice (2-4 sentences typically)
- Be conversational and supportive
- Ask clarifying questions when needed
- Use {distance_unit} for distances
- Use {measurement_system} system for measurements
{personality_prompt}

Athlete Context:
{ai_coach.format_athlete_context_for_system(context)}

Remember: This is a VOICE conversation. Keep responses brief, natural, and conversational."""
        
        print(f"[VOICE] System instructions prepared (language: {language_name}, voice: {voice_preference})")
        
        # Return session configuration
        return {
            "session_id": str(uuid.uuid4()),
            "voice": voice_preference,
            "language": coach_language,
            "system_instructions": system_instructions,
            "athlete_id": athlete_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[VOICE] Error creating voice session: {e}")
        logging.error(f"Error creating voice session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create voice session: {str(e)}")


@router.post("/coach/voice/webrtc-offer")
async def handle_webrtc_offer(request: Dict[str, Any]):
    """Handle WebRTC offer/answer negotiation (placeholder for future real WebRTC)"""
    # This endpoint exists for future WebRTC implementation
    # Currently, the frontend handles WebRTC directly with OpenAI
    return {
        "status": "WebRTC negotiation handled by client",
        "message": "Frontend should connect directly to OpenAI Realtime API"
    }


@router.post("/coach/voice/save-conversation")
async def save_voice_conversation(voice_conversation: VoiceConversationSave):
    """Save voice conversation transcript to database"""
    try:
        athlete_id = voice_conversation.athlete_id
        
        logging.info(f"Saving voice conversation for athlete {athlete_id} with {len(voice_conversation.transcript)} turns")
        
        # Get AI coach service to save to conversation history
        ai_coach = await get_realtime_chat_for_athlete(athlete_id)
        
        # Save each turn to conversation history
        for turn in voice_conversation.transcript:
            if turn.role == 'user':
                # Save user message
                await ai_coach.conversation_repo.save_message(
                    athlete_id,
                    turn.content,
                    "user",
                    voice_conversation.session_id
                )
            elif turn.role == 'assistant':
                # Save assistant response
                assistant_response = {
                    "role": "assistant",
                    "content": turn.content
                }
                await ai_coach.conversation_repo.save_message(
                    athlete_id,
                    turn.content,
                    "assistant",
                    voice_conversation.session_id
                )
        
        logging.info(f"Successfully saved voice conversation with {len(voice_conversation.transcript)} turns")
        return {"success": True, "message": "Voice conversation saved successfully"}
        
    except Exception as e:
        logging.error(f"Error saving voice conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save voice conversation: {str(e)}")
