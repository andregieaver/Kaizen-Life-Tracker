# Font Management - Single Source of Truth

## Overview
The entire application now uses **Noto Sans** as the primary font, with **Inter** reserved exclusively for the logo text. All fonts are hosted locally for better performance and offline support.

## Font Files Location
```
/app/frontend/src/fonts/
├── NotoSans-Regular.ttf    (400 weight)
├── NotoSans-Medium.ttf     (500 weight)
├── NotoSans-SemiBold.ttf   (600 weight)
└── NotoSans-Bold.ttf       (700 weight)
```

**Note:** Fonts are in the `src` directory (not `public`) so webpack can properly process and bundle them.

## Single Source of Truth
All font changes are managed through CSS variables in `/app/frontend/src/index.css`

### CSS Variables (Lines 81-85)
```css
:root {
  /* Typography - Single Source of Truth */
  /* Change these variables to update fonts across the entire app */
  --font-display: "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-body: "Noto Sans", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-logo: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

## How to Change Fonts

### To change the main app font:
1. Open `/app/frontend/src/index.css`
2. Update `--font-display` and `--font-body` variables (lines 83-84)
3. If using a new font, add @font-face declarations at the top of the file

### To change the logo font:
1. Open `/app/frontend/src/index.css`
2. Update `--font-logo` variable (line 85)

### Example: Switching to Roboto
```css
:root {
  --font-display: "Roboto", sans-serif;
  --font-body: "Roboto", sans-serif;
  --font-logo: "Inter", sans-serif;
}
```

## Font Loading

### @font-face Declarations (Lines 9-44)
```css
@font-face {
  font-family: 'Noto Sans';
  src: url('/fonts/NotoSans-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap; /* Prevents FOIT (Flash of Invisible Text) */
}

/* ...and 3 more weight variations */
```

### Font Display Strategy
- **`font-display: swap`**: Shows fallback font immediately, then swaps to Noto Sans when loaded
- Prevents blank text during font loading
- Better UX on slow connections

## Components with Logo Font

The following components explicitly use `var(--font-logo)` to maintain the Inter font for branding:

### 1. Dashboard.js
**Desktop Header (Line 567):**
```jsx
<h1 className="text-2xl font-bold tracking-tight" 
    style={{ color: 'var(--text-hi)', fontFamily: 'var(--font-logo)' }}>
  {siteTitle}
</h1>
```

**Mobile Header (Line 731):**
```jsx
<h1 className="hidden text-xl font-bold tracking-tight" 
    style={{ color: 'var(--text-hi)', fontFamily: 'var(--font-logo)' }}>
  {siteTitle}
</h1>
```

### 2. LandingPage.js
**Header Logo (Line 386):**
```jsx
<span className="ml-2 text-xl font-bold text-white" 
      style={{ fontFamily: 'var(--font-logo)' }}>
  {siteTitle}
</span>
```

**Footer Logo (Line 734):**
```jsx
<span className="ml-2 text-lg font-bold text-white" 
      style={{ fontFamily: 'var(--font-logo)' }}>
  {siteTitle}
</span>
```

## Font Usage Across the App

### Where Noto Sans is Applied
✅ **All body text** via `font-family: var(--font-body)` (line 114)
✅ **All headings** using `font-display` class
✅ **All UI components** (buttons, inputs, cards, modals)
✅ **Navigation menus**
✅ **Tables and data displays**
✅ **Forms and inputs**
✅ **Bottom tab bar**
✅ **All pages** (Dashboard, Account, Settings, etc.)

### Where Inter is Reserved
❌ **Logo text only** (TrainSmart branding)

## Performance Benefits

### Local Hosting Advantages
1. **No external requests** to Google Fonts CDN
2. **Works offline** - PWA ready
3. **No GDPR concerns** with external font services
4. **Faster load times** - served from same domain
5. **Consistent performance** - not affected by CDN outages

### File Sizes
```
NotoSans-Regular.ttf:  292KB
NotoSans-Medium.ttf:   292KB
NotoSans-SemiBold.ttf: 292KB
NotoSans-Bold.ttf:     292KB
Total: ~1.2MB (cached after first load)
```

## Browser Support

### Font Format
- **TrueType (.ttf)**: Supported by all modern browsers
- Chrome 4+, Firefox 3.5+, Safari 3.1+, Edge (all versions)

### Fallback Stack
```css
"Noto Sans", 
-apple-system,           /* iOS/macOS system font */
BlinkMacSystemFont,      /* macOS Chrome */
"Segoe UI",              /* Windows */
Roboto,                  /* Android */
"Helvetica Neue",        /* Older macOS */
Arial,                   /* Universal fallback */
sans-serif               /* Generic fallback */
```

## Updating Fonts

### Adding New Font Weights/Styles

1. **Download font file** (e.g., `NotoSans-Italic.ttf`)
2. **Place in** `/app/frontend/public/fonts/`
3. **Add @font-face declaration** in `/app/frontend/src/index.css`:
```css
@font-face {
  font-family: 'Noto Sans';
  src: url('/fonts/NotoSans-Italic.ttf') format('truetype');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
```

### Switching to a Different Font Family

1. **Download font files** (Regular, Medium, SemiBold, Bold)
2. **Replace files** in `/app/frontend/public/fonts/`
3. **Update @font-face declarations** (family name, file paths)
4. **Update CSS variables**:
```css
--font-display: "Your New Font", sans-serif;
--font-body: "Your New Font", sans-serif;
```

## Testing

### Verify Font Loading
1. Open browser DevTools → Network tab
2. Filter by "Font" type
3. Reload page
4. Confirm all 4 Noto Sans files load with 200 status

### Verify Font Application
1. Inspect any text element
2. Check computed styles
3. `font-family` should show `"Noto Sans"`
4. Logo text should show `"Inter"`

## Troubleshooting

### Fonts not loading?
- Check file paths in @font-face declarations
- Verify files exist in `/app/frontend/public/fonts/`
- Clear browser cache
- Check Network tab for 404 errors

### Wrong font showing?
- Inspect element to check computed `font-family`
- Ensure CSS variables are properly set
- Check if component has inline font-family overrides
- Verify font-weight matches available font files

### Logo still using Noto Sans?
- Check if `style={{ fontFamily: 'var(--font-logo)' }}` is applied
- Verify `--font-logo` variable is set to "Inter"
- Clear cache and hard reload

## Files Modified

1. **`/app/frontend/public/fonts/`** (NEW)
   - Added 4 Noto Sans font files

2. **`/app/frontend/src/index.css`** (MODIFIED)
   - Lines 9-44: @font-face declarations
   - Lines 81-85: Font CSS variables (single source of truth)

3. **`/app/frontend/src/components/Dashboard.js`** (MODIFIED)
   - Line 567: Desktop header logo font
   - Line 731: Mobile header logo font

4. **`/app/frontend/src/components/LandingPage.js`** (MODIFIED)
   - Line 386: Header logo font
   - Line 734: Footer logo font

## Summary

✅ **Noto Sans** used everywhere in the app
✅ **Inter** reserved for logo text only
✅ **Locally hosted** - no external dependencies
✅ **Single source of truth** via CSS variables
✅ **Easy to update** - change one variable to update entire app
✅ **Performance optimized** with font-display: swap
✅ **4 weight variations** for typography flexibility

**To change fonts in the future, simply update the CSS variables in `/app/frontend/src/index.css` - that's it!**
