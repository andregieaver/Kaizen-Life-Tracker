/**
 * API Configuration Utility
 * Provides dynamic API URL resolution for different deployment environments
 */

/**
 * Get the backend API base URL
 * - In development: uses REACT_APP_BACKEND_URL from .env
 * - In production: uses the current origin (same domain deployment)
 */
export const getApiBaseUrl = () => {
  // If REACT_APP_BACKEND_URL is set and not empty, use it
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl;
  }
  
  // In production builds, use the current origin (relative URLs)
  // This works because frontend and backend are served from the same domain
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }
  
  // Fallback for development without env var
  return 'http://localhost:8001';
};

/**
 * Get the full API URL (base URL + /api)
 */
export const getApiUrl = () => {
  return `${getApiBaseUrl()}/api`;
};

// Export default API URL for easy import
export const API_BASE_URL = getApiBaseUrl();
export const API_URL = getApiUrl();
