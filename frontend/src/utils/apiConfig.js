/**
 * API Configuration Utility
 * Provides dynamic API URL resolution for different deployment environments
 */

// The backend API URL - always use the Emergent preview URL for API calls
// This is required because custom domains route through different infrastructure
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://timetracker-202.preview.emergentagent.com';

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
