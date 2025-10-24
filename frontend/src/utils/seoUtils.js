const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Inject SEO meta tags into the document head based on page data
 * @param {Object} pageData - Page data from CMS with SEO fields
 */
export const injectPageSEO = (pageData) => {
  if (!pageData) return;

  // Update document title
  if (pageData.meta_title || pageData.title) {
    document.title = pageData.meta_title || pageData.title;
  }

  // Update meta description
  if (pageData.meta_description) {
    let metaDescTag = document.querySelector('meta[name="description"]');
    if (!metaDescTag) {
      metaDescTag = document.createElement('meta');
      metaDescTag.setAttribute('name', 'description');
      document.head.appendChild(metaDescTag);
    }
    metaDescTag.setAttribute('content', pageData.meta_description);
  }

  // Update OG title
  let ogTitleTag = document.querySelector('meta[property="og:title"]');
  if (!ogTitleTag) {
    ogTitleTag = document.createElement('meta');
    ogTitleTag.setAttribute('property', 'og:title');
    document.head.appendChild(ogTitleTag);
  }
  ogTitleTag.setAttribute('content', pageData.meta_title || pageData.title || '');

  // Update OG description
  if (pageData.meta_description) {
    let ogDescTag = document.querySelector('meta[property="og:description"]');
    if (!ogDescTag) {
      ogDescTag = document.createElement('meta');
      ogDescTag.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescTag);
    }
    ogDescTag.setAttribute('content', pageData.meta_description);
  }

  // Update OG image
  if (pageData.og_image) {
    let ogImageTag = document.querySelector('meta[property="og:image"]');
    if (!ogImageTag) {
      ogImageTag = document.createElement('meta');
      ogImageTag.setAttribute('property', 'og:image');
      document.head.appendChild(ogImageTag);
    }
    // Use full URL for OG image
    const fullImageUrl = pageData.og_image.startsWith('http') 
      ? pageData.og_image 
      : `${BACKEND_URL}${pageData.og_image}`;
    ogImageTag.setAttribute('content', fullImageUrl);

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

  console.log('✅ Page SEO meta tags injected:', {
    title: pageData.meta_title || pageData.title,
    description: pageData.meta_description,
    ogImage: pageData.og_image,
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
      console.log(`Page not found for slug: ${urlSlug}, using default SEO`);
      return null;
    }
  } catch (error) {
    console.error('Error loading page SEO:', error);
    return null;
  }
};
