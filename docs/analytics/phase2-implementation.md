# Phase 2 Implementation Guide: Enhanced Tracking

## Overview
Phase 2 adds enhanced tracking capabilities including auto-capture click tracking, section view tracking, scroll depth, and time on page tracking.

## New Features

### 1. Auto-Capture Click Tracking

**What it does:**
Automatically tracks clicks on any element with a `data-track` attribute. No manual `track()` calls needed!

**How to use:**

```html
<!-- Simple click tracking -->
<button data-track="cta_click">
  Get Started
</button>

<!-- With additional properties -->
<button 
  data-track="cta_click"
  data-props='{"section":"hero","label":"Get Started","variant":"primary"}'>
  Get Started
</button>

<!-- On links -->
<a 
  href="/pricing" 
  data-track="nav_click"
  data-props='{"menu":"main","item":"pricing"}'>
  Pricing
</a>

<!-- On any element -->
<div 
  data-track="card_click"
  data-props='{"card_type":"feature","title":"AI Coach"}'>
  <h3>AI Coach</h3>
  <p>Get personalized training</p>
</div>
```

**Auto-extracted properties:**
- `element_type` - HTML tag name (e.g., `button`, `a`, `div`)
- `element_id` - Element ID if present
- `element_class` - Element classes
- `element_text` - Text content (first 100 chars)
- `element_href` - Link href if present

**Example event:**
```javascript
{
  event: 'cta_click',
  element_type: 'button',
  element_text: 'Get Started',
  section: 'hero',
  label: 'Get Started',
  variant: 'primary',
  anon_id: 'uuid...',
  utm_source: 'google',
  timestamp: '2024-01-31T12:00:00Z'
}
```

### 2. Section View Tracking

**What it does:**
Tracks when a section becomes visible in the viewport using IntersectionObserver. Useful for measuring content engagement.

**How to use:**

```javascript
import { useViewTracker } from '@/lib/useViewTracker';

function FeaturesSection() {
  // Basic usage - tracks when section is 50% visible
  const ref = useViewTracker('section_view', { section: 'features' });
  
  return (
    <section ref={ref}>
      <h2>Features</h2>
      {/* ... */}
    </section>
  );
}

// Custom threshold - trigger at 25% visibility
function HeroSection() {
  const ref = useViewTracker(
    'section_view', 
    { section: 'hero' },
    { threshold: 0.25 }
  );
  
  return (
    <section ref={ref}>
      {/* ... */}
    </section>
  );
}
```

**Tracked properties:**
- `element_id`, `element_class` - Element attributes
- `visibility_ratio` - Percentage visible (0-1)
- `viewport_height` - Browser viewport height
- `element_height` - Element height

**Note:** Each section is tracked only once per page load.

### 3. Scroll Depth Tracking

**What it does:**
Automatically tracks when users scroll to 25%, 50%, 75%, and 100% of the page.

**How to use:**

```javascript
import { useScrollDepth } from '@/lib/useViewTracker';

function LandingPage() {
  // Add this hook to any page component
  useScrollDepth();
  
  return (
    <div>
      {/* Your page content */}
    </div>
  );
}
```

**Events tracked:**
- `scroll_depth` at 25%, 50%, 75%, 100%

**Properties:**
```javascript
{
  depth_percentage: 50,
  page_path: '/landing',
  document_height: 4500,
  viewport_height: 900
}
```

### 4. Time on Page Tracking

**What it does:**
Tracks when users spend significant time on a page (engaged users).

**How to use:**

```javascript
import { useTimeOnPage } from '@/lib/useViewTracker';

function ArticlePage() {
  // Track engaged users (30 seconds default)
  useTimeOnPage(30);
  
  // Custom threshold
  useTimeOnPage(60); // 60 seconds
  
  return (
    <article>
      {/* ... */}
    </article>
  );
}
```

**Events:**
- `engaged_time` - When threshold is reached
- `time_on_page` - On component unmount (if >5 seconds)

### 5. Video Tracking

**What it does:**
Tracks video play, pause, progress (25%, 50%, 75%), and completion.

**How to use:**

```javascript
import { useVideoTracking } from '@/lib/useViewTracker';
import { useRef } from 'react';

function VideoPlayer({ videoId }) {
  const videoRef = useRef(null);
  
  // Track video interactions
  useVideoTracking(videoRef, videoId);
  
  return (
    <video ref={videoRef} controls>
      <source src="/video.mp4" type="video/mp4" />
    </video>
  );
}
```

**Events tracked:**
- `video_start` - First play
- `video_pause` - When paused
- `video_progress` - At 25%, 50%, 75%
- `video_complete` - Video finished

## Form Tracking

**Already in Phase 1**, enhanced in Phase 2:

```javascript
import { forms } from '@/lib/analytics';

function LoginForm() {
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Track form start
    forms.start('login', 'login-form');
    
    try {
      // Your submission logic
      await submitLogin(email, password);
      
      // Track success
      forms.submit('login', 'login-form');
    } catch (error) {
      // Track error
      forms.error('login', 'login-form', error.message);
    }
  };
  
  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

## Integration Examples

### Landing Page (Full Example)

```javascript
import React from 'react';
import { useScrollDepth, useTimeOnPage, useViewTracker } from '@/lib/useViewTracker';

function LandingPage() {
  // Enable page-level tracking
  useScrollDepth();
  useTimeOnPage(30);
  
  // Section view tracking
  const heroRef = useViewTracker('section_view', { section: 'hero' });
  const featuresRef = useViewTracker('section_view', { section: 'features' });
  const pricingRef = useViewTracker('section_view', { section: 'pricing' });
  
  return (
    <div>
      {/* Hero Section */}
      <section ref={heroRef} className="hero">
        <h1>Welcome to TrainSmart</h1>
        <button 
          data-track="cta_click"
          data-props='{"section":"hero","label":"Get Started","variant":"primary"}'>
          Get Started
        </button>
      </section>
      
      {/* Features Section */}
      <section ref={featuresRef} className="features">
        <h2>Features</h2>
        <div className="feature-grid">
          <div 
            data-track="feature_card_click"
            data-props='{"feature":"ai_coach"}'>
            <h3>AI Coach</h3>
          </div>
          {/* More features... */}
        </div>
      </section>
      
      {/* Pricing Section */}
      <section ref={pricingRef} className="pricing">
        <h2>Pricing</h2>
        <button
          data-track="plan_select"
          data-props='{"plan":"premium","price":29.99}'>
          Choose Premium
        </button>
      </section>
    </div>
  );
}
```

### Login Page (Full Example)

**Already implemented in `/app/frontend/src/components/Login.js`**

Features:
- Form tracking (start, submit, error)
- Login success tracking
- User ID setting on login
- Google OAuth tracking
- Error tracking

### Dashboard Component

Add tracking for navigation and feature usage:

```javascript
import { track } from '@/lib/analytics';

function Dashboard() {
  const handleFeatureClick = (featureName) => {
    track('feature_use', { feature: featureName });
    // Navigate to feature...
  };
  
  return (
    <div>
      <nav>
        <button
          data-track="menu_click"
          data-props='{"menu":"dashboard","item":"workouts"}'
          onClick={() => handleFeatureClick('workouts')}>
          Workouts
        </button>
      </nav>
    </div>
  );
}
```

## Testing Your Implementation

### 1. Check Browser Console

Open browser console and you should see:
```
🚀 Analytics initialized
🎯 Auto-capture click tracking initialized
📊 Analytics Event: page_view {page_path: '/landing', ...}
👁️ View tracked: section_view {section: 'hero'}
📜 Scroll depth: 25%
📊 Analytics Event: cta_click {section: 'hero', label: 'Get Started', ...}
```

### 2. Check dataLayer

```javascript
// In browser console
console.log(window.dataLayer);

// Should show events like:
[
  {event: 'page_view', page_path: '/landing', anon_id: '...'},
  {event: 'section_view', section: 'hero', visibility_ratio: 0.6},
  {event: 'scroll_depth', depth_percentage: 50},
  {event: 'cta_click', section: 'hero', label: 'Get Started'}
]
```

### 3. Check Database

Events are stored in MongoDB `analytics_events` collection:

```javascript
// Via API (Super Admin only)
GET /api/analytics/events?athlete_id={your_id}&limit=20

// Response:
{
  "success": true,
  "count": 20,
  "events": [
    {
      "event": "page_view",
      "timestamp": "2024-01-31T12:00:00Z",
      "page_path": "/landing",
      "anon_id": "uuid...",
      ...
    }
  ]
}
```

### 4. GTM Preview Mode

1. Open GTM (you'll set this up)
2. Click "Preview"
3. Enter your site URL
4. See real-time events firing
5. Verify Data Layer Variables are populated

## Performance Considerations

### Auto-Capture
- Uses event delegation (single listener on document)
- Minimal performance impact
- Traverses max 5 parent elements

### IntersectionObserver
- Tracks each section only once
- Unobserves after tracking
- Respects consent (no tracking without consent)

### Scroll Depth
- Throttled using `requestAnimationFrame`
- No performance impact on scroll

### Time on Page
- Checks every 5 seconds
- Cleans up on unmount

## Privacy & Consent

All tracking respects user consent:
```javascript
import { hasAnalyticsConsent } from '@/lib/analytics';

// Every tracking function checks consent
if (!hasAnalyticsConsent()) {
  return; // No tracking
}
```

Users must accept analytics cookies before any events are sent.

## Next Steps

### Phase 3: Ecommerce Tracking
- Integrate with Stripe checkout
- Auto-track purchase events
- Revenue validation

### Phase 4: Advanced Features
- E2E testing with Playwright
- Analytics dashboard
- BigQuery integration

## Troubleshooting

### Events not firing?

1. **Check consent**: `hasAnalyticsConsent()` must return `true`
2. **Check console**: Look for analytics logs
3. **Check dataLayer**: `console.log(window.dataLayer)`
4. **Check network**: Analytics endpoint should receive events

### Auto-capture not working?

1. Verify `data-track` attribute is present
2. Check console for "🎯 Auto-capture click tracking initialized"
3. Verify element is clickable (not disabled)
4. Check `data-props` JSON is valid

### Section views not tracking?

1. Verify ref is attached to element
2. Check element is in viewport
3. Try adjusting threshold (default 0.5)
4. Check console for "👁️ View tracked"

## Support

For issues or questions:
1. Check browser console logs
2. Verify analytics consent is granted
3. Review this documentation
4. Check `/docs/analytics/events.md` for event reference
