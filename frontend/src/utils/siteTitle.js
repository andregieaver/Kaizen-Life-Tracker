/**
 * Site Title Utility
 * Manages fetching and caching of site title from system settings
 */

const SITE_TITLE_CACHE_KEY = 'app_site_title';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour in milliseconds

/**
 * Get cached site title from localStorage
 * @returns {string|null} Cached site title or null if not cached/expired
 */
export const getCachedSiteTitle = () => {
  try {
    const cached = localStorage.getItem(SITE_TITLE_CACHE_KEY);
    if (!cached) return null;
    
    const { title, timestamp } = JSON.parse(cached);
    
    // Check if cache is still valid (within 1 hour)
    if (Date.now() - timestamp < CACHE_DURATION) {
      return title;
    }
    
    // Cache expired, remove it
    localStorage.removeItem(SITE_TITLE_CACHE_KEY);
    return null;
  } catch (error) {
    console.error('Error reading cached site title:', error);
    return null;
  }
};

/**
 * Cache site title to localStorage
 * @param {string} title - Site title to cache
 */
export const cacheSiteTitle = (title) => {
  try {
    const cacheData = {
      title,
      timestamp: Date.now()
    };
    localStorage.setItem(SITE_TITLE_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching site title:', error);
  }
};

/**
 * Fetch site title from API and cache it
 * @returns {Promise<string>} Site title
 */
export const fetchAndCacheSiteTitle = async () => {
  try {
    import { getApiUrl } from './apiConfig';
const API = getApiUrl();
    const response = await fetch(`${BACKEND_URL}/api/system/settings/public`);
    const data = await response.json();
    
    const title = data?.seo?.siteTitle || 'TrainSmart';
    
    // Cache the fetched title
    cacheSiteTitle(title);
    
    return title;
  } catch (error) {
    console.error('Error fetching site title:', error);
    return 'TrainSmart';
  }
};

/**
 * Get site title with instant cached response and background update
 * @param {function} setSiteTitle - State setter function
 */
export const initializeSiteTitle = (setSiteTitle) => {
  // 1. Try to get cached title immediately
  const cachedTitle = getCachedSiteTitle();
  if (cachedTitle) {
    setSiteTitle(cachedTitle);
  }
  
  // 2. Fetch fresh title in background and update if different
  fetchAndCacheSiteTitle().then(freshTitle => {
    if (freshTitle !== cachedTitle) {
      setSiteTitle(freshTitle);
    }
  });
};
