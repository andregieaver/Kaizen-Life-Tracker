import subprocess
import uuid
import logging
from pathlib import Path
from PIL import Image
import io

def process_and_save_video(file_data: bytes, upload_dir: Path, max_duration: int = 120) -> tuple:
    """
    Process video: compress to MP4, generate thumbnail
    
    Args:
        file_data: Raw video bytes
        upload_dir: Directory to save processed files
        max_duration: Maximum video duration in seconds (default 2 minutes)
    
    Returns:
        Tuple of (video_filename, thumbnail_filename)
    """
    # Generate unique filenames
    video_id = str(uuid.uuid4())
    temp_input = upload_dir / f"temp_{video_id}"
    video_output = f"{video_id}.mp4"
    thumbnail_output = f"{video_id}_thumb.webp"
    
    video_path = upload_dir / video_output
    thumbnail_path = upload_dir / thumbnail_output
    
    try:
        # Save temporary input file
        with open(temp_input, 'wb') as f:
            f.write(file_data)
        
        # Get video info (duration, dimensions)
        probe_cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-show_entries', 'stream=width,height',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(temp_input)
        ]
        
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
        probe_lines = probe_result.stdout.strip().split('\n')
        
        width = int(probe_lines[0]) if len(probe_lines) > 0 else 1920
        height = int(probe_lines[1]) if len(probe_lines) > 1 else 1080
        duration = float(probe_lines[2]) if len(probe_lines) > 2 else 0
        
        logging.info(f"Video info: {width}x{height}, duration: {duration}s")
        
        # Check duration limit
        if duration > max_duration:
            raise ValueError(f"Video duration ({duration}s) exceeds maximum ({max_duration}s)")
        
        # Calculate scale to fit within 1280x720 (720p) while maintaining aspect ratio
        max_width = 1280
        max_height = 720
        
        if width > max_width or height > max_height:
            scale_ratio = min(max_width / width, max_height / height)
            new_width = int(width * scale_ratio)
            new_height = int(height * scale_ratio)
            # Ensure dimensions are even (required by H.264)
            new_width = new_width - (new_width % 2)
            new_height = new_height - (new_height % 2)
            scale_filter = f"scale={new_width}:{new_height}"
        else:
            # Ensure dimensions are even
            new_width = width - (width % 2)
            new_height = height - (height % 2)
            scale_filter = f"scale={new_width}:{new_height}"
        
        # Compress video to MP4 with H.264
        # CRF 23 = good quality with compression (range 0-51, lower = better quality)
        compress_cmd = [
            'ffmpeg',
            '-i', str(temp_input),
            '-c:v', 'libx264',           # H.264 video codec
            '-crf', '23',                 # Constant Rate Factor (quality)
            '-preset', 'medium',          # Encoding speed/compression tradeoff
            '-vf', scale_filter,          # Scale filter
            '-c:a', 'aac',                # AAC audio codec
            '-b:a', '128k',               # Audio bitrate
            '-movflags', '+faststart',    # Enable streaming
            '-y',                          # Overwrite output
            str(video_path)
        ]
        
        subprocess.run(compress_cmd, check=True, capture_output=True)
        
        # Generate thumbnail at 1 second mark
        thumbnail_cmd = [
            'ffmpeg',
            '-i', str(temp_input),
            '-ss', '00:00:01',            # Seek to 1 second
            '-vframes', '1',               # Extract 1 frame
            '-vf', f'scale=640:360',      # Thumbnail size
            '-y',
            str(thumbnail_path)
        ]
        
        subprocess.run(thumbnail_cmd, check=True, capture_output=True)
        
        # Get file sizes for logging
        original_size = len(file_data)
        compressed_size = video_path.stat().st_size
        compression_ratio = (1 - compressed_size / original_size) * 100
        
        logging.info(f"Video processed: {original_size} -> {compressed_size} bytes ({compression_ratio:.1f}% reduction)")
        logging.info(f"Thumbnail generated: {thumbnail_output}")
        
        return video_output, thumbnail_output
        
    except subprocess.CalledProcessError as e:
        logging.error(f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}")
        raise Exception(f"Video processing failed: {str(e)}")
    except Exception as e:
        logging.error(f"Error processing video: {e}")
        raise
    finally:
        # Clean up temporary file
        if temp_input.exists():
            temp_input.unlink()
