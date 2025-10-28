"""
Image processing utility for optimizing uploads
- Max dimension: 1024x1024px (maintains aspect ratio)
- Converts to WebP format
- Compresses with minimal quality loss
"""
from PIL import Image
import io
from pathlib import Path
import uuid
import logging

logger = logging.getLogger(__name__)

def process_and_save_image(
    file_data: bytes,
    upload_dir: Path,
    max_dimension: int = 1024,
    quality: int = 85
) -> str:
    """
    Process image: resize, convert to WebP, compress
    
    Args:
        file_data: Raw image bytes
        upload_dir: Directory to save processed image
        max_dimension: Maximum width or height (maintains aspect ratio)
        quality: WebP quality (85 = high quality with good compression)
    
    Returns:
        Filename of saved image
    """
    try:
        # Open image
        image = Image.open(io.BytesIO(file_data))
        
        # Handle EXIF orientation to prevent rotation issues
        try:
            from PIL import ImageOps
            image = ImageOps.exif_transpose(image)
            logger.info("Applied EXIF orientation correction")
        except Exception as e:
            logger.warning(f"Could not apply EXIF orientation: {e}")
        
        # Convert RGBA to RGB if needed (WebP works better with RGB)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Calculate new dimensions (maintain aspect ratio)
        width, height = image.size
        if width > max_dimension or height > max_dimension:
            if width > height:
                new_width = max_dimension
                new_height = int((max_dimension / width) * height)
            else:
                new_height = max_dimension
                new_width = int((max_dimension / height) * width)
            
            # High-quality resize with Lanczos filter
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        
        # Generate unique filename
        filename = f"{uuid.uuid4()}.webp"
        filepath = upload_dir / filename
        
        # Save as WebP with optimization
        image.save(
            filepath,
            'WEBP',
            quality=quality,
            method=6,  # Slowest but best compression
            optimize=True
        )
        
        # Get file size for logging
        file_size = filepath.stat().st_size
        original_size = len(file_data)
        savings = ((original_size - file_size) / original_size) * 100
        
        logger.info(f"Saved {filename}: {file_size} bytes (reduced by {savings:.1f}%)")
        
        return filename
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise Exception(f"Failed to process image: {str(e)}")

def process_multiple_images(
    files_data: list,
    upload_dir: Path,
    max_count: int = 5,
    max_dimension: int = 1024,
    quality: int = 85
) -> list:
    """
    Process multiple images
    
    Args:
        files_data: List of (filename, file_bytes) tuples
        upload_dir: Directory to save processed images
        max_count: Maximum number of images allowed
        max_dimension: Maximum width or height
        quality: WebP quality
    
    Returns:
        List of saved filenames
    """
    if len(files_data) > max_count:
        raise Exception(f"Maximum {max_count} images allowed")
    
    filenames = []
    for filename, file_bytes in files_data:
        processed_filename = process_and_save_image(
            file_bytes,
            upload_dir,
            max_dimension,
            quality
        )
        filenames.append(processed_filename)
    
    return filenames
