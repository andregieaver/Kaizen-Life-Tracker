"""
Uploads routes - Extracted from server.py
Handles image and video uploads with processing
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Request, Query
from typing import List
from pathlib import Path
import logging
import os

# Import image/video processors
from image_processor import process_and_save_image
from video_processor import process_and_save_video

router = APIRouter(prefix="/upload", tags=["uploads"])
logger = logging.getLogger(__name__)

# Upload directories - must match StaticFiles mounts in server.py
UPLOAD_DIR_IMAGES = Path("/app/backend/uploaded_images")
UPLOAD_DIR_VIDEOS = Path("/app/backend/uploaded_videos")

# ============= SECURITY CONSTANTS =============
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB per image
MAX_VIDEO_SIZE = 200 * 1024 * 1024  # 200MB per video
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'}
ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg'}

def validate_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal attacks"""
    if not filename:
        return "unnamed"
    # Remove path components and dangerous characters
    safe_name = os.path.basename(filename)
    # Keep only alphanumeric, dots, dashes, underscores
    safe_name = ''.join(c if c.isalnum() or c in '.-_' else '_' for c in safe_name)
    return safe_name or "unnamed"

def get_file_extension(filename: str) -> str:
    """Safely extract file extension"""
    if not filename:
        return ""
    return os.path.splitext(filename.lower())[1]

# ============= ROUTES =============

@router.post("/images")
async def upload_images(
    request: Request,
    files: List[UploadFile] = File(...),
    max_files: int = Query(5, description="Maximum number of files allowed")
):
    """
    Upload multiple images with processing:
    - Resize to max 1024x1024px (maintains aspect ratio)
    - Convert to WebP format
    - Compress with minimal quality loss
    - Security: File type, size, and extension validation
    """
    # Validate max files first (before try block to preserve 400 status)
    if len(files) > max_files:
        raise HTTPException(status_code=400, detail=f"Maximum {max_files} images allowed")
    
    uploaded_urls = []
    
    for file in files:
        # Sanitize filename first
        safe_filename = validate_filename(file.filename)
        file_ext = get_file_extension(file.filename)
        
        # Validate content type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400, 
                detail=f"File type '{file.content_type}' not allowed. Allowed: JPEG, PNG, GIF, WebP, HEIC"
            )
        
        # Validate file extension
        if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File extension '{file_ext}' not allowed. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
            )
        
        try:
            # Read file bytes
            file_bytes = await file.read()
            
            # Validate file size
            if len(file_bytes) > MAX_IMAGE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image '{safe_filename}' too large. Maximum size is 10MB"
                )
            
            # Check for empty files
            if len(file_bytes) == 0:
                raise HTTPException(status_code=400, detail=f"Image '{safe_filename}' is empty")
            
            # Process and save image using image_processor
            # This will resize, convert to WebP, and compress
            processed_filename = process_and_save_image(
                file_data=file_bytes,
                upload_dir=UPLOAD_DIR_IMAGES,
                max_dimension=1024,
                quality=85
            )
            
            # Generate relative URL with /api prefix
            # Static files are mounted at /api/uploaded_images
            image_url = f"/api/uploaded_images/{processed_filename}"
            uploaded_urls.append(image_url)
            
            logger.info(f"Processed and uploaded image: {safe_filename} -> {image_url}")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing image {safe_filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")
    
    return {"urls": uploaded_urls}


@router.post("/video")
async def upload_video(
    request: Request,
    file: UploadFile = File(...)
):
    """
    Upload and process a single video:
    - Compress to MP4 (H.264, max 720p)
    - Generate thumbnail
    - Max 2 minutes duration
    - Security: File type, size, and extension validation
    - Returns video URL and thumbnail URL
    """
    # Sanitize filename
    safe_filename = validate_filename(file.filename)
    file_ext = get_file_extension(file.filename)
    
    # Validate content type
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. Allowed: MP4, MOV, AVI, WebM, MPEG"
        )
    
    # Validate file extension
    if file_ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension '{file_ext}' not allowed. Allowed: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}"
        )
    
    # Read and validate file size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail=f"Video file too large. Maximum size is 200MB")
    
    # Check for empty files
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail=f"Video file is empty")
    
    try:
        # Process video: compress and generate thumbnail
        video_filename, thumbnail_filename = process_and_save_video(
            file_data=file_bytes,
            upload_dir=UPLOAD_DIR_VIDEOS,
            max_duration=120  # 2 minutes
        )
        
        # Generate relative URLs with /api prefix
        # Static files are mounted at /api/uploaded_videos
        video_url = f"/api/uploaded_videos/{video_filename}"
        thumbnail_url = f"/api/uploaded_videos/{thumbnail_filename}"
        
        logger.info(f"Processed video: {video_filename}, thumbnail: {thumbnail_filename}")
        
        return {
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
            "type": "video"
        }
        
    except ValueError as e:
        # Duration or validation error
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing video: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")
