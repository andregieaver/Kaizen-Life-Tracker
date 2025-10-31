# Analytics Events Documentation

## Overview
TrainSmart uses Google Tag Manager (GTM) and Google Analytics 4 (GA4) for tracking user behavior and engagement. All events are privacy-first and respect Google Consent Mode v2.

## Event Naming Convention
- **Format**: `snake_case`
- **Pattern**: `verb_noun` (e.g., `page_view`, `cta_click`, `form_submit`)

## Common Parameters

### Navigation
- `page_location` - Full URL
- `page_path` - Path only (e.g., `/dashboard`)
- `page_title` - Document title
- `page_referrer` - Previous page URL

### Context
- `section` - Section of the page (e.g., `hero`, `features`, `pricing`)
- `element` - UI element (e.g., `button`, `link`, `card`)
- `label` - Human-readable label
- `variant` - Visual variant (e.g., `primary`, `secondary`)

### Identity
- `anon_id` - Anonymous user ID (UUID, stored in localStorage)
- `user_id` - Authenticated user ID (set after login, no PII)

### Acquisition
- `utm_source` - Traffic source
- `utm_medium` - Marketing medium
- `utm_campaign` - Campaign name
- `utm_term` - Paid keyword
- `utm_content` - Content variant

### Value
- `value` - Numeric value
- `currency` - Currency code (e.g., `EUR`, `USD`)

## Core Events

### Navigation Events

#### `page_view`
Tracks SPA route changes automatically.

**When**: On every route change (automatic via usePageViews hook)

**Parameters**:
```javascript
{
  page_location: "https://app.example.com/dashboard",
  page_path: "/dashboard",
  page_title: "Dashboard",
  page_referrer: "https://app.example.com/",
  anon_id: "uuid",
  user_id: "user_123" // if authenticated
}
```

#### `scroll_depth`
Tracks scroll depth milestones (25%, 50%, 75%, 100%).

**When**: User scrolls to milestones (handled by GTM Enhanced Measurement)

#### `section_view`
Tracks when a section comes into view.

**When**: Section visible in viewport for >50%

**Example**:
```javascript
track('section_view', { section: 'features' })
```

### Engagement Events

#### `cta_click`
Tracks call-to-action button clicks.

**When**: User clicks CTA buttons

**Example**:
```html
<button 
  data-track="cta_click"
  data-props='{"section":"hero","label":"Get Started","variant":"primary"}'>
  Get Started
</button>
```

**Parameters**:
```javascript
{
  section: "hero",
  label: "Get Started",
  variant: "primary"
}
```

#### `menu_click`
Tracks navigation menu clicks.

**Example**:
```javascript
track('menu_click', { menu: 'main', item: 'dashboard' })
```

#### `outbound_click`
Tracks clicks to external links.

**When**: User clicks external links (handled by GTM Enhanced Measurement)

### Form Events

#### `form_start`
Tracks when user starts filling a form.

**Example**:
```javascript
import { forms } from '@/lib/analytics';
forms.start('signup', 'signup-form');
```

#### `form_submit`
Tracks successful form submissions.

**Example**:
```javascript
forms.submit('signup', 'signup-form');
```

#### `form_error`
Tracks form validation errors.

**Example**:
```javascript
forms.error('signup', 'signup-form', 'Email already exists');
```

### Product Events

#### `feature_use`
Tracks feature usage.

**Example**:
```javascript
track('feature_use', { feature: 'workout_log', action: 'create' })
```

### Integration Events

#### `integration_connect`
Tracks when user connects an integration.

**Example**:
```javascript
track('integration_connect', { integration: 'strava' })
```

#### `integration_disconnect`
Tracks when user disconnects an integration.

**Example**:
```javascript
track('integration_disconnect', { integration: 'strava' })
```

## Ecommerce Events

### `view_item_list`
User views a list of plans/products.

**Example**:
```javascript
import { ecommerce } from '@/lib/analytics';

ecommerce.viewItemList([
  { id: 'pro_monthly', name: 'Pro Monthly', price: 19.99, currency: 'EUR' },
  { id: 'premium_yearly', name: 'Premium Yearly', price: 290.00, currency: 'EUR' }
], 'Plans');
```

### `select_item`
User selects a plan/product.

**Example**:
```javascript
ecommerce.selectItem({
  id: 'premium_yearly',
  name: 'Premium Yearly',
  price: 290.00,
  currency: 'EUR'
});
```

### `begin_checkout`
User begins checkout process.

**Example**:
```javascript
ecommerce.beginCheckout(
  { id: 'premium_yearly', name: 'Premium Yearly', price: 290.00 },
  290.00,
  'EUR'
);
```

### `purchase`
Completed purchase.

**Example**:
```javascript
ecommerce.purchase(
  'txn_123456', // transaction_id
  290.00, // value
  'EUR', // currency
  [{ id: 'premium_yearly', name: 'Premium Yearly', price: 290.00, quantity: 1 }],
  'WELCOME10' // coupon (optional)
);
```

## Identity Tracking

### Set User ID (After Login)
```javascript
import { setUserId } from '@/lib/analytics';
setUserId(user.id); // No PII - use internal ID only
```

### Clear User ID (After Logout)
```javascript
import { clearUserId } from '@/lib/analytics';
clearUserId();
```

## Consent Management

### Update Consent
Automatically handled by CookieBanner component. Consent state is synced with GTM.

```javascript
import { updateConsent } from '@/lib/analytics';

updateConsent({
  necessary: true,
  analytics: true,
  marketing: false,
  functional: true
});
```

## Implementation Examples

### Track Button Click
```html
<button
  data-track="cta_click"
  data-props='{"section":"pricing","label":"Choose Plan","variant":"premium"}'>
  Choose Premium
</button>
```

### Manual Event Tracking
```javascript
import { track } from '@/lib/analytics';

track('video_play', {
  video_id: 'intro_video',
  section: 'hero',
  duration: 60
});
```

### Track Section View
```javascript
import { useViewTracker } from '@/lib/useViewTracker';

function FeaturesSection() {
  const ref = useViewTracker('section_view', { section: 'features' });
  return <section ref={ref}>...</section>;
}
```

## Privacy & Compliance

### No PII in Events
- ❌ Never send: email, phone, name, address
- ✅ Use: `user_id` (internal ID), `anon_id`

### Consent Mode v2
- All events respect user consent
- No analytics events sent before consent granted
- Consent state synced with GTM automatically

### Data Retention
- Analytics data: 14 months (configurable in GA4)
- Database events: Configurable per policy
- User has right to deletion

## Testing

### Check dataLayer
```javascript
// In browser console
console.log(window.dataLayer);
```

### Check Analytics Consent
```javascript
import { hasAnalyticsConsent } from '@/lib/analytics';
console.log('Analytics consent:', hasAnalyticsConsent());
```

### Debug Mode
Open GTM Preview mode and verify events fire correctly.

## GTM Configuration Required

### Variables (Data Layer Variables)
- `page_location`
- `page_path`
- `page_title`
- `page_referrer`
- `anon_id`
- `user_id`
- `section`
- `label`
- `variant`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`

### Triggers
- Custom Event: `page_view`
- Custom Event: `cta_click`
- Custom Event: `form_start`, `form_submit`, `form_error`
- Custom Event: `section_view`
- Custom Event: `feature_use`
- Custom Event: `integration_connect`, `integration_disconnect`
- Custom Event: `view_item_list`, `select_item`, `begin_checkout`, `purchase`
- Custom Event: `consent_update`

### Tags
1. **GA4 Configuration Tag**
   - Measurement ID: `G-XXXXXXXXX`
   - Send page view: OFF (handled by custom event)
   - User Properties: `anon_id`

2. **GA4 Event Tags**
   - One tag per event type
   - Map parameters from Data Layer Variables

3. **Consent Update Listener**
   - Custom HTML tag that listens for `consent_update` event
   - Calls `gtag('consent', 'update', ...)`

## Support

For questions or issues:
1. Check browser console for analytics logs
2. Verify consent status
3. Check GTM Preview mode
4. Review this documentation
