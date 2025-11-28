"""
Pages/CMS Router - Complete
Handles all page management endpoints including CRUD operations, image uploads, and SEO metadata
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging
import os
import re
import io
from PIL import Image
import base64

from database import db

# Initialize router
router = APIRouter(prefix="/pages", tags=["pages"])

# =====================================================
# PYDANTIC MODELS
# =====================================================

class ContentBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    content: str  # Rich text HTML content
    order: int = 0

class Page(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    url_slug: str  # URL path, e.g., "/pricing" or "/about"
    is_home: bool = False  # True if this is the home page (url_slug will be "/")
    thumbnail: Optional[str] = None  # Path to thumbnail image
    status: str = "draft"  # draft, pending, published, scheduled
    index_status: str = "indexed"  # indexed, no-index
    scheduled_at: Optional[datetime] = None  # For scheduled status
    
    # CMS flexible content
    use_cms_content: bool = False  # Toggle between hard-coded and CMS content
    content_blocks: List[ContentBlock] = []  # Repeater blocks with rich text
    
    # SEO fields
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    focus_keyword: Optional[str] = None
    og_image: Optional[str] = None  # Open Graph image
    
    # Page content (can be extended later for full content management)
    content: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None  # athlete_id
    last_modified_by: Optional[str] = None  # athlete_id

class PageCreate(BaseModel):
    title: str
    url_slug: Optional[str] = None
    is_home: bool = False
    thumbnail: Optional[str] = None
    status: str = "draft"
    index_status: str = "indexed"
    scheduled_at: Optional[datetime] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    focus_keyword: Optional[str] = None
    og_image: Optional[str] = None
    content: Optional[str] = None
    use_cms_content: bool = False
    content_blocks: List[ContentBlock] = []

class PageUpdate(BaseModel):
    title: Optional[str] = None
    url_slug: Optional[str] = None
    is_home: Optional[bool] = None
    thumbnail: Optional[str] = None
    status: Optional[str] = None
    index_status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    focus_keyword: Optional[str] = None
    og_image: Optional[str] = None
    content: Optional[str] = None
    use_cms_content: Optional[bool] = None
    content_blocks: Optional[List[ContentBlock]] = None

# =====================================================
# HELPER FUNCTIONS
# =====================================================

async def verify_super_admin(athlete_id: str):
    """Verify that the user is a super admin"""
    athlete = await db.athletes.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if not athlete.get("is_super_admin", False):
        raise HTTPException(status_code=403, detail="Super Admin access required")

async def auto_update_index_html(page_data: dict):
    """
    Automatically update index.html with page metadata
    Called when home page is saved/published
    """
    try:
        # Extract metadata
        meta_title = page_data.get('meta_title') or page_data.get('title') or 'My Health Tracker'
        meta_description = page_data.get('meta_description') or 'Your personal AI Health & Fitness coach'
        og_image = page_data.get('og_image') or ''
        
        # Construct full image URL
        backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://trainsmart-cms.emergent.host')
        if og_image and not og_image.startswith('http'):
            og_image = f"{backend_url}{og_image}"
        
        # Read current index.html
        index_path = "/app/frontend/public/index.html"
        
        if not os.path.exists(index_path):
            logging.warning(f"index.html not found at {index_path}")
            return
        
        with open(index_path, 'r', encoding='utf-8') as f:
            html = f.read()
        
        # Replace meta tags
        html = re.sub(r'<title>.*?</title>', f'<title>{meta_title}</title>', html)
        html = re.sub(r'<meta name="description" content=".*?"', f'<meta name="description" content="{meta_description}"', html)
        html = re.sub(r'<meta property="og:title" content=".*?"', f'<meta property="og:title" content="{meta_title}"', html)
        html = re.sub(r'<meta property="og:description" content=".*?"', f'<meta property="og:description" content="{meta_description}"', html)
        
        if og_image:
            html = re.sub(r'<meta property="og:image" content=".*?"', f'<meta property="og:image" content="{og_image}"', html)
            html = re.sub(r'<meta property="og:image:secure_url" content=".*?"', f'<meta property="og:image:secure_url" content="{og_image}"', html)
            html = re.sub(r'<meta name="twitter:image" content=".*?"', f'<meta name="twitter:image" content="{og_image}"', html)
        
        html = re.sub(r'<meta name="twitter:title" content=".*?"', f'<meta name="twitter:title" content="{meta_title}"', html)
        html = re.sub(r'<meta name="twitter:description" content=".*?"', f'<meta name="twitter:description" content="{meta_description}"', html)
        
        # Write updated index.html
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        logging.info(f"✅ index.html updated automatically with metadata: {meta_title}")
        
    except Exception as e:
        logging.error(f"Error in auto_update_index_html: {e}", exc_info=True)
        raise

# =====================================================
# PAGES CRUD ENDPOINTS
# =====================================================

@router.get("")
async def get_all_pages(athlete_id: str, search: str = "", status: str = "", index_status: str = ""):
    """Get all pages with optional filters (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Build query
        query = {}
        
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"url_slug": {"$regex": search, "$options": "i"}}
            ]
        
        if status:
            query["status"] = status
        
        if index_status:
            query["index_status"] = index_status
        
        # Fetch pages
        pages = await db.pages.find(query, {"_id": 0}).sort("updated_at", -1).limit(100).to_list(length=100)
        
        return {"pages": pages, "total": len(pages)}
    except Exception as e:
        logging.error(f"Error fetching pages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch pages: {str(e)}")

@router.get("/{page_id}")
async def get_page(page_id: str, athlete_id: str):
    """Get a single page by ID (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        page = await db.pages.find_one({"id": page_id}, {"_id": 0})
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        return page
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch page: {str(e)}")

@router.get("/public/by-slug")
async def get_page_by_slug(slug: str):
    """Get a published page by URL slug (Public access, no auth required)"""
    try:
        # Normalize slug
        if not slug.startswith('/'):
            slug = f"/{slug}"
        
        # Find published page by url_slug
        page = await db.pages.find_one({
            "url_slug": slug,
            "status": "published"
        }, {"_id": 0})
        
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        return page
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching page by slug: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch page: {str(e)}")

@router.post("")
async def create_page(athlete_id: str, page_data: PageCreate):
    """Create a new page (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Handle home page logic
        if page_data.is_home:
            # If setting as home page, set URL slug to "/"
            url_slug = "/"
            
            # Remove is_home flag from any other page
            await db.pages.update_many(
                {"is_home": True},
                {"$set": {"is_home": False}}
            )
            logging.info("Removed home page flag from existing pages")
        else:
            # Auto-generate URL slug from title if not provided
            if not page_data.url_slug:
                url_slug = page_data.title.lower().replace(" ", "-").replace("/", "")
                # Remove special characters
                url_slug = "".join(c for c in url_slug if c.isalnum() or c == "-")
            else:
                url_slug = page_data.url_slug
            
            # Ensure slug starts with /
            if not url_slug.startswith("/"):
                url_slug = "/" + url_slug
        
        # Check if URL slug already exists (except for home page being updated)
        existing = await db.pages.find_one({"url_slug": url_slug})
        if existing:
            raise HTTPException(status_code=400, detail=f"A page with URL slug '{url_slug}' already exists")
        
        # Create page object
        page_dict = page_data.model_dump(exclude_unset=True)
        page_dict["url_slug"] = url_slug
        page_dict["created_by"] = athlete_id
        page_dict["last_modified_by"] = athlete_id
        page_dict["id"] = str(uuid4())
        page_dict["created_at"] = datetime.now(timezone.utc).isoformat()
        page_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Serialize content_blocks if present (convert ContentBlock objects to dicts)
        if "content_blocks" in page_dict and page_dict["content_blocks"]:
            page_dict["content_blocks"] = [
                block if isinstance(block, dict) else block 
                for block in page_dict["content_blocks"]
            ]
        
        # Insert into database
        await db.pages.insert_one(page_dict)
        
        # Remove _id from response (not JSON serializable)
        if "_id" in page_dict:
            del page_dict["_id"]
        
        # Auto-update index.html if this is the home page and it's published
        if url_slug == "/" and page_dict.get("status") == "published":
            try:
                await auto_update_index_html(page_dict)
                logging.info(f"✅ Auto-updated index.html with new home page metadata")
            except Exception as html_error:
                logging.error(f"Failed to auto-update index.html: {html_error}")
                # Don't fail the page creation if HTML update fails
        
        logging.info(f"Page created: {page_dict['id']} by {athlete_id}")
        return {"message": "Page created successfully", "page": page_dict}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create page: {str(e)}")

@router.put("/{page_id}")
async def update_page(page_id: str, athlete_id: str, page_data: PageUpdate):
    """Update a page (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Check if page exists
        existing = await db.pages.find_one({"id": page_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Build update data
        update_data = page_data.model_dump(exclude_unset=True)
        
        # Handle home page logic
        if "is_home" in update_data and update_data["is_home"]:
            # If setting as home page, set URL slug to "/"
            update_data["url_slug"] = "/"
            
            # Remove is_home flag from any other page
            await db.pages.update_many(
                {"is_home": True, "id": {"$ne": page_id}},
                {"$set": {"is_home": False}}
            )
            logging.info(f"Removed home page flag from other pages, set {page_id} as home")
        elif "is_home" in update_data and not update_data["is_home"]:
            # If removing home page status, ensure URL slug is not "/"
            current_slug = existing.get("url_slug", "")
            if current_slug == "/":
                # Generate a new slug from title
                title = update_data.get("title", existing.get("title", "page"))
                new_slug = "/" + title.lower().replace(" ", "-")
                new_slug = "".join(c for c in new_slug if c.isalnum() or c == "-" or c == "/")
                update_data["url_slug"] = new_slug
                logging.info(f"Changed URL slug from / to {new_slug} as page is no longer home")
        
        # If URL slug is being updated manually (and not by is_home logic), check for conflicts
        if "url_slug" in update_data and not update_data.get("is_home"):
            url_slug = update_data["url_slug"]
            if not url_slug.startswith("/"):
                url_slug = "/" + url_slug
                update_data["url_slug"] = url_slug
            
            # Check if another page has this slug
            conflict = await db.pages.find_one({"url_slug": url_slug, "id": {"$ne": page_id}})
            if conflict:
                raise HTTPException(status_code=400, detail=f"Another page with URL slug '{url_slug}' already exists")
        
        # Add metadata
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["last_modified_by"] = athlete_id
        
        # Update page
        await db.pages.update_one(
            {"id": page_id},
            {"$set": update_data}
        )
        
        # Fetch updated page
        updated_page = await db.pages.find_one({"id": page_id}, {"_id": 0})
        
        # Auto-update index.html if this is the home page
        if updated_page.get("url_slug") == "/" and updated_page.get("status") == "published":
            try:
                await auto_update_index_html(updated_page)
                logging.info(f"✅ Auto-updated index.html with home page metadata")
            except Exception as html_error:
                logging.error(f"Failed to auto-update index.html: {html_error}")
                # Don't fail the page update if HTML update fails
        
        logging.info(f"Page updated: {page_id} by {athlete_id}")
        return {"message": "Page updated successfully", "page": updated_page}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update page: {str(e)}")

@router.delete("/{page_id}")
async def delete_page(page_id: str, athlete_id: str):
    """Delete a page (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Check if page exists
        existing = await db.pages.find_one({"id": page_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Delete page
        await db.pages.delete_one({"id": page_id})
        
        logging.info(f"Page deleted: {page_id} by {athlete_id}")
        return {"message": "Page deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete page: {str(e)}")

@router.post("/{page_id}/upload-image")
async def upload_page_image(page_id: str, athlete_id: str, image_type: str, file: UploadFile = File(...)):
    """Upload thumbnail or OG image for a page (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Check file size (limit to 5MB)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Check if page exists
        page = await db.pages.find_one({"id": page_id})
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Process image
        try:
            image = Image.open(io.BytesIO(file_content))
            
            # Convert to RGB if needed
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize based on image type
            if image_type == "thumbnail":
                # Thumbnail: 3:2 ratio, max 600x400
                image.thumbnail((600, 400), Image.Resampling.LANCZOS)
            elif image_type == "og_image":
                # OG image: 1200x630 (recommended for social media)
                image.thumbnail((1200, 630), Image.Resampling.LANCZOS)
            
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=85, optimize=True)
            output.seek(0)
            optimized_content = output.read()
            
            encoded = base64.b64encode(optimized_content).decode('utf-8')
            data_url = f"data:image/jpeg;base64,{encoded}"
            
            update_field = "thumbnail" if image_type == "thumbnail" else "og_image"
            await db.pages.update_one(
                {"id": page_id},
                {"$set": {
                    update_field: data_url,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "last_modified_by": athlete_id
                }}
            )
            
            return {"success": True, "message": f"{image_type.title()} uploaded successfully", "path": data_url}
            
        except Exception as e:
            logging.error(f"Error processing image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading page image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@router.get("/meta-html/{page_id}")
async def get_page_meta_html(page_id: str):
    """
    Get HTML snippet with OG meta tags for a specific page
    Useful for pre-rendering services or SSR implementations
    """
    try:
        # Fetch page from database
        page = await db.pages.find_one({"id": page_id}, {"_id": 0})
        
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Extract metadata
        meta_title = page.get('meta_title') or page.get('title') or 'My Health Tracker'
        meta_description = page.get('meta_description') or 'Your personal AI Health & Fitness coach'
        og_image = page.get('og_image') or ''
        
        # Construct full image URL
        backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://trainsmart-cms.emergent.host')
        if og_image:
            if og_image.startswith('http'):
                full_image_url = og_image
            else:
                full_image_url = f"{backend_url}{og_image}"
        else:
            full_image_url = f"{backend_url}/static/default-og-image.jpg"
        
        # Generate meta tags HTML
        meta_html = f'''
        <!-- SEO Meta Tags -->
        <title>{meta_title}</title>
        <meta name="description" content="{meta_description}" />
        
        <!-- Open Graph Meta Tags -->
        <meta property="og:title" content="{meta_title}" />
        <meta property="og:description" content="{meta_description}" />
        <meta property="og:image" content="{full_image_url}" />
        <meta property="og:image:secure_url" content="{full_image_url}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        
        <!-- Twitter Card Meta Tags -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{meta_title}" />
        <meta name="twitter:description" content="{meta_description}" />
        <meta name="twitter:image" content="{full_image_url}" />
        '''
        
        return {
            "success": True,
            "page_id": page_id,
            "meta_html": meta_html,
            "meta_title": meta_title,
            "meta_description": meta_description,
            "og_image": full_image_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating page meta HTML: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate meta HTML: {str(e)}")
