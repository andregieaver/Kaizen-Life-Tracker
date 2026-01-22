/**
 * API Configuration Utility
 * Provides dynamic API URL resolution for different deployment environments
 */

// The backend API URL - use production URL for deployed apps
// REACT_APP_BACKEND_URL should be set to https://timetracker-202.emergent.host for production
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://timetracker-202.emergent.host';

/**
 * Get the backend API base URL
 */
export const getApiBaseUrl = () => {
  return BACKEND_URL;
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
