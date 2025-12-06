"""
Uploads routes - Extracted from server.py
Handles image and video uploads with processing
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Request, Query
from typing import List
import logging

# Import image/video processors
from image_processor import process_and_save_image
from video_processor import process_and_save_video

router = APIRouter(prefix="/upload", tags=["uploads"])
logger = logging.getLogger(__name__)

# Upload directory
UPLOAD_DIR = "/app/backend/uploaded_images"

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
    """
    # Validate max files first (before try block to preserve 400 status)
    if len(files) > max_files:
        raise HTTPException(status_code=400, detail=f"Maximum {max_files} images allowed")
    
    uploaded_urls = []
    
    for file in files:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not an image")
        
        try:
            # Read file bytes
            file_bytes = await file.read()
            
            # Process and save image using image_processor
            # This will resize, convert to WebP, and compress
            processed_filename = process_and_save_image(
                file_data=file_bytes,
                upload_dir=UPLOAD_DIR,
                max_dimension=1024,
                quality=85
            )
            
            # Generate relative URL with /api prefix
            image_url = f"/api/uploads/images/{processed_filename}"
            uploaded_urls.append(image_url)
            
            logger.info(f"Processed and uploaded image: {processed_filename} -> {image_url}")
            
        except Exception as e:
            logger.error(f"Error processing image {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process image {file.filename}: {str(e)}")
    
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
    - Returns video URL and thumbnail URL
    """
    # Validate file type
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail=f"File {file.filename} is not a video")
    
    # Check file size (max 200MB)
    file_bytes = await file.read()
    max_size = 200 * 1024 * 1024  # 200MB
    if len(file_bytes) > max_size:
        raise HTTPException(status_code=400, detail=f"Video file too large. Maximum size is 200MB")
    
    try:
        # Process video: compress and generate thumbnail
        video_filename, thumbnail_filename = process_and_save_video(
            file_data=file_bytes,
            upload_dir=UPLOAD_DIR,
            max_duration=120  # 2 minutes
        )
        
        # Generate relative URLs with /api prefix
        video_url = f"/api/uploads/images/{video_filename}"
        thumbnail_url = f"/api/uploads/images/{thumbnail_filename}"
        
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
