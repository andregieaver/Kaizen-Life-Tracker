import { logger } from '../utils/logger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Inject SEO meta tags into the document head based on page data
 * @param {Object} pageData - Page data from CMS with SEO fields
 */
export const injectPageSEO = (pageData) => {
  if (!pageData) return;

  // Get values with proper fallbacks
  const title = pageData.meta_title || pageData.title || '';
  const description = pageData.meta_description || '';
  const ogImagePath = pageData.og_image || '';

  // Update document title
  if (title) {
    document.title = title;
  }

  // Update meta description
  if (description) {
    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
      metaDescTag = document.createElement('meta');
      metaDescTag.setAttribute('name', 'description');
      document.head.appendChild(metaDescTag);
    }
    metaDescTag.setAttribute('content', description);
  }

  // Update OG title (use meta_title, fallback to title)
  let ogTitleTag = document.querySelector('meta[property="og:title"]');
  if (!ogTitleTag) {
    ogTitleTag = document.createElement('meta');
    ogTitleTag.setAttribute('property', 'og:title');
    document.head.appendChild(ogTitleTag);
  }
  ogTitleTag.setAttribute('content', title);

  // Update OG description (use meta_description)
  if (description) {
    let ogDescTag = document.querySelector('meta[property="og:description"]');
    if (!ogDescTag) {
      ogDescTag = document.createElement('meta');
      ogDescTag.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescTag);
    }
    ogDescTag.setAttribute('content', description);
  }

  // Update OG image
  if (ogImagePath) {
    // Construct full URL for OG image
    const fullImageUrl = ogImagePath.startsWith('http') 
      ? ogImagePath 
      : `${BACKEND_URL}${ogImagePath}`;

    let ogImageTag = document.querySelector('meta[property="og:image"]');
    if (!ogImageTag) {
      ogImageTag = document.createElement('meta');
      ogImageTag.setAttribute('property', 'og:image');
      document.head.appendChild(ogImageTag);
    }
    ogImageTag.setAttribute('content', fullImageUrl);

    // Add OG image secure URL (https)
    let ogImageSecureTag = document.querySelector('meta[property="og:image:secure_url"]');
    if (!ogImageSecureTag) {
      ogImageSecureTag = document.createElement('meta');
      ogImageSecureTag.setAttribute('property', 'og:image:secure_url');
      document.head.appendChild(ogImageSecureTag);
    }
    ogImageSecureTag.setAttribute('content', fullImageUrl);

    // Add OG image dimensions for better social media display
    let ogImageWidthTag = document.querySelector('meta[property="og:image:width"]');
    if (!ogImageWidthTag) {
      ogImageWidthTag = document.createElement('meta');
      ogImageWidthTag.setAttribute('property', 'og:image:width');
      document.head.appendChild(ogImageWidthTag);
    }
    ogImageWidthTag.setAttribute('content', '1200');

    let ogImageHeightTag = document.querySelector('meta[property="og:image:height"]');
    if (!ogImageHeightTag) {
      ogImageHeightTag = document.createElement('meta');
      ogImageHeightTag.setAttribute('property', 'og:image:height');
      document.head.appendChild(ogImageHeightTag);
    }
    ogImageHeightTag.setAttribute('content', '630');
  }

  // Update OG type
  let ogTypeTag = document.querySelector('meta[property="og:type"]');
  if (!ogTypeTag) {
    ogTypeTag = document.createElement('meta');
    ogTypeTag.setAttribute('property', 'og:type');
    document.head.appendChild(ogTypeTag);
  }
  ogTypeTag.setAttribute('content', 'website');

  // Update OG URL
  let ogUrlTag = document.querySelector('meta[property="og:url"]');
  if (!ogUrlTag) {
    ogUrlTag = document.createElement('meta');
    ogUrlTag.setAttribute('property', 'og:url');
    document.head.appendChild(ogUrlTag);
  }
  ogUrlTag.setAttribute('content', window.location.href);

  // Add Twitter Card meta tags for better Twitter sharing
  let twitterCardTag = document.querySelector('meta[name="twitter:card"]');
  if (!twitterCardTag) {
    twitterCardTag = document.createElement('meta');
    twitterCardTag.setAttribute('name', 'twitter:card');
    document.head.appendChild(twitterCardTag);
  }
  twitterCardTag.setAttribute('content', 'summary_large_image');

  let twitterTitleTag = document.querySelector('meta[name="twitter:title"]');
  if (!twitterTitleTag) {
    twitterTitleTag = document.createElement('meta');
    twitterTitleTag.setAttribute('name', 'twitter:title');
    document.head.appendChild(twitterTitleTag);
  }
  twitterTitleTag.setAttribute('content', title);

  if (description) {
    let twitterDescTag = document.querySelector('meta[name="twitter:description"]');
    if (!twitterDescTag) {
      twitterDescTag = document.createElement('meta');
      twitterDescTag.setAttribute('name', 'twitter:description');
      document.head.appendChild(twitterDescTag);
    }
    twitterDescTag.setAttribute('content', description);
  }

  if (ogImagePath) {
    const fullImageUrl = ogImagePath.startsWith('http') 
      ? ogImagePath 
      : `${BACKEND_URL}${ogImagePath}`;
    
    let twitterImageTag = document.querySelector('meta[name="twitter:image"]');
    if (!twitterImageTag) {
      twitterImageTag = document.createElement('meta');
      twitterImageTag.setAttribute('name', 'twitter:image');
      document.head.appendChild(twitterImageTag);
    }
    twitterImageTag.setAttribute('content', fullImageUrl);
  }

  // Handle index status (noindex)
  if (pageData.index_status === 'no-index') {
    let robotsTag = document.querySelector('meta[name="robots"]');
    if (!robotsTag) {
      robotsTag = document.createElement('meta');
      robotsTag.setAttribute('name', 'robots');
      document.head.appendChild(robotsTag);
    }
    robotsTag.setAttribute('content', 'noindex, nofollow');
  } else {
    // Remove noindex if it exists
    let robotsTag = document.querySelector('meta[name="robots"]');
    if (robotsTag) {
      robotsTag.remove();
    }
  }

  logger.debug(null, '✅ Page SEO meta tags injected:', {
    title: title,
    description: description,
    ogImage: ogImagePath ? `${BACKEND_URL}${ogImagePath}` : 'none',
    indexStatus: pageData.index_status
  });
};

/**
 * Fetch page data by URL slug and inject SEO meta tags
 * @param {string} urlSlug - The URL slug of the page (e.g., "/" or "/pricing")
 */
export const loadAndInjectPageSEO = async (urlSlug) => {
  try {
    const API = `${BACKEND_URL}/api`;
    const response = await fetch(`${API}/pages/public/by-slug?slug=${encodeURIComponent(urlSlug)}`);
    
    if (response.ok) {
      const pageData = await response.json();
      injectPageSEO(pageData);
      return pageData;
    } else {
      logger.debug(null, `Page not found for slug: ${urlSlug}, using default SEO`);
      return null;
    }
  } catch (error) {
    logger.error(null, 'Error loading page SEO:', error);
    return null;
  }
};
