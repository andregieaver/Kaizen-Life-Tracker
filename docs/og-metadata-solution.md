# OG Metadata Solution Guide

## Problem
Social media crawlers (Facebook, Twitter, LinkedIn) don't execute JavaScript, so they only see the hardcoded OG meta tags in `index.html`, not the dynamic values set per page.

## Architecture Challenge
- Frontend: React SPA running on port 3000 (separate service)
- Backend: FastAPI running on port 8001
- Current setup: Frontend and backend are separate services
- Challenge: Can't use traditional SSR without major refactoring

## Solutions Implemented

### Solution 1: Update Home Page Metadata (Immediate Fix)

**What it does:** Updates the hardcoded meta tags in `index.html` with your home page's metadata.

**API Endpoint:**
```
POST /api/pages/update-index-html?athlete_id={super_admin_id}
```

**How to use:**
1. Edit your home page (`/` slug) in Pages CMS
2. Set proper meta_title, meta_description, og_image
3. Publish the page
4. Call the API endpoint to update index.html

**Benefits:**
- ✅ Home page shares correctly
- ✅ No code changes needed
- ✅ One-time setup

**Limitations:**
- ❌ Only fixes home page (/)
- ❌ Other pages still use default tags
- ❌ Requires manual update when home page meta changes

### Solution 2: Meta HTML API (For Pre-rendering Services)

**What it does:** Provides an API endpoint that returns the correct meta tags for any page.

**API Endpoint:**
```
GET /api/pages/meta-html/{page_id}
```

**Response:**
```json
{
  "success": true,
  "page_id": "abc123",
  "meta_html": "<title>...</title><meta property=\"og:title\"...>",
  "meta_title": "Page Title",
  "meta_description": "Page description",
  "og_image": "https://domain.com/image.jpg"
}
```

**Use with Pre-rendering Services:**

#### Option A: Prerender.io
1. Sign up at https://prerender.io
2. Add your domain
3. Configure middleware to cache pre-rendered pages
4. Social crawlers get cached HTML with correct meta tags

#### Option B: Rendertron (Self-hosted)
1. Deploy Rendertron: https://github.com/GoogleChrome/rendertron
2. Configure to pre-render your pages
3. Serve pre-rendered HTML to crawlers

#### Option C: Cloudflare Workers
1. Create a Cloudflare Worker
2. Detect social media crawlers (user-agent)
3. Fetch page metadata from API
4. Inject meta tags into HTML
5. Return modified HTML to crawler

**Example Cloudflare Worker:**
```javascript
async function handleRequest(request) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';
  
  // Detect social media crawlers
  const isCrawler = /facebookexternalhit|twitterbot|linkedinbot|whatsapp/i.test(userAgent);
  
  if (isCrawler) {
    // Extract path and get page slug
    const slug = url.pathname;
    
    // Fetch page from your API
    const pageResponse = await fetch(`https://your-backend.com/api/pages/public/by-slug?url_slug=${slug}`);
    const pageData = await pageResponse.json();
    
    if (pageData.success) {
      // Fetch meta HTML
      const metaResponse = await fetch(`https://your-backend.com/api/pages/meta-html/${pageData.id}`);
      const metaData = await metaResponse.json();
      
      // Fetch original HTML
      const htmlResponse = await fetch(request);
      let html = await htmlResponse.text();
      
      // Inject meta tags
      html = html.replace(
        /<head>/i,
        `<head>${metaData.meta_html}`
      );
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
  
  // Not a crawler, serve normally
  return fetch(request);
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
```

## Recommended Approach

### For Quick Fix (Today):
**Use Solution 1** - Update home page metadata in index.html

1. Edit home page in Pages CMS
2. Set good meta_title, meta_description, og_image
3. Call `/api/pages/update-index-html` endpoint
4. Home page now shares correctly!

### For Complete Solution (This Week):
**Deploy Cloudflare Worker or Prerender.io**

**Why Cloudflare Worker:**
- ✅ No subscription cost (free tier generous)
- ✅ Fast edge network
- ✅ Easy to set up
- ✅ Works for all pages dynamically
- ✅ No code changes in your app

**Steps:**
1. Create Cloudflare account
2. Add your domain to Cloudflare
3. Create Worker with code above
4. Deploy Worker
5. Test with Facebook Debugger
6. Done! All pages now share correctly

## Testing OG Metadata

### Facebook Open Graph Debugger
```
https://developers.facebook.com/tools/debug/
```
- Enter your page URL
- Click "Scrape Again"
- View what Facebook sees
- Check for errors

### Twitter Card Validator
```
https://cards-dev.twitter.com/validator
```
- Enter your page URL
- View Twitter card preview
- Check for errors

### LinkedIn Post Inspector
```
https://www.linkedin.com/post-inspector/
```
- Enter your page URL
- View LinkedIn preview
- Check for errors

### Force Refresh Social Media Cache

**Facebook:**
```
https://developers.facebook.com/tools/debug/?q=YOUR_URL
```
Click "Scrape Again" button

**Twitter:**
Wait 1-7 days or submit to Card Validator

**LinkedIn:**
Use Post Inspector to refresh

## Current Implementation Status

✅ **Implemented:**
- API endpoint to get page meta HTML
- API endpoint to update home page metadata in index.html
- Full OG metadata extraction from database
- Image URL construction with full path

⏳ **Requires Setup:**
- Cloudflare Worker deployment (recommended)
- OR Prerender.io integration
- OR manual index.html updates per page

❌ **Not Feasible with Current Architecture:**
- Full SSR (would require Next.js migration)
- Backend serving frontend (separate services)

## Alternative: Next.js Migration (Long-term)

For the best long-term solution, consider migrating to Next.js:

**Benefits:**
- ✅ Built-in SSR/SSG
- ✅ Dynamic OG tags out of the box
- ✅ Better SEO overall
- ✅ API routes in same app
- ✅ Image optimization
- ✅ Automatic code splitting

**Migration Effort:**
- 2-4 weeks for full migration
- Can be done incrementally
- Worth it for better SEO and performance

## Summary

**Immediate Solution:** Call `/api/pages/update-index-html` to fix home page

**Best Solution:** Deploy Cloudflare Worker to handle all pages dynamically

**Long-term Solution:** Consider Next.js migration for native SSR support

## Support

For Cloudflare Worker setup:
1. https://developers.cloudflare.com/workers/
2. Use the example code above
3. Deploy to your domain
4. Test with OG debuggers

For Prerender.io:
1. https://prerender.io/documentation
2. Follow setup guide
3. Configure caching
4. Test with OG debuggers
