/**
 * Utility functions for formatting distances, pace, and dates based on user preferences
 */

/**
 * Convert distance from miles to target unit
 * @param {number} distanceMiles - Distance in miles
 * @param {string} targetUnit - 'miles' or 'km'
 * @returns {number} - Converted distance
 */
export const convertDistance = (distanceMiles, targetUnit = 'miles') => {
  if (!distanceMiles) return 0;
  if (targetUnit === 'km') {
    return distanceMiles * 1.60934;
  }
  return distanceMiles;
};

/**
 * Format distance with appropriate unit
 * @param {number} distance - Distance value (assumes miles if no unit specified)
 * @param {string} unit - 'miles' or 'km'
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} - Formatted distance string (e.g., "5.0 mi" or "8.0 km")
 */
export const formatDistance = (distance, unit = 'miles', decimals = 1) => {
  if (!distance || distance === 0) return `0 ${unit === 'km' ? 'km' : 'mi'}`;
  
  const unitLabel = unit === 'km' ? 'km' : 'mi';
  return `${parseFloat(distance).toFixed(decimals)} ${unitLabel}`;
};

/**
 * Convert distance from one unit to another
 * @param {number} value - Distance value
 * @param {string} fromUnit - Source unit ('miles' or 'km')
 * @param {string} toUnit - Target unit ('miles' or 'km')
 * @returns {number} - Converted distance
 */
export const convertDistanceUnits = (value, fromUnit, toUnit) => {
  if (!value) return 0;
  if (fromUnit === toUnit) return value;
  
  if (fromUnit === 'miles' && toUnit === 'km') {
    return value * 1.60934;
  } else if (fromUnit === 'km' && toUnit === 'miles') {
    return value / 1.60934;
  }
  return value;
};

/**
 * Format pace based on duration and distance
 * @param {number} durationMinutes - Duration in minutes
 * @param {number} distance - Distance (in the unit specified)
 * @param {string} unit - 'miles' or 'km'
 * @returns {string} - Formatted pace string (e.g., "7:30/mi" or "4:40/km")
 */
export const formatPace = (durationMinutes, distance, unit = 'miles') => {
  if (!durationMinutes || !distance || distance === 0) return '--:--';
  
  const pace = durationMinutes / distance;
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  const unitLabel = unit === 'km' ? 'km' : 'mi';
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}/${unitLabel}`;
};

/**
 * Format date based on user preferences
 * @param {string|Date} dateString - Date to format
 * @param {object} preferences - User preferences object
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateString, preferences = {}) => {
  if (!dateString) return '';
  
  const { timezone = 'UTC', language = 'en' } = preferences;
  
  try {
    return new Intl.DateTimeFormat(language, {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(dateString));
  } catch (error) {
    // Fallback to simple format if timezone is invalid
    return new Date(dateString).toLocaleDateString();
  }
};

/**
 * Format time based on user preferences
 * @param {string|Date} dateString - Date/time to format
 * @param {object} preferences - User preferences object
 * @returns {string} - Formatted time string
 */
export const formatTime = (dateString, preferences = {}) => {
  if (!dateString) return '';
  
  const { timezone = 'UTC', time_format = '12h', language = 'en' } = preferences;
  
  try {
    return new Intl.DateTimeFormat(language, {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: time_format === '12h'
    }).format(new Date(dateString));
  } catch (error) {
    // Fallback to simple format
    return new Date(dateString).toLocaleTimeString();
  }
};

/**
 * Format date and time based on user preferences
 * @param {string|Date} dateString - Date/time to format
 * @param {object} preferences - User preferences object
 * @returns {string} - Formatted date and time string
 */
export const formatDateTime = (dateString, preferences = {}) => {
  if (!dateString) return '';
  
  const { timezone = 'UTC', time_format = '12h', language = 'en' } = preferences;
  
  try {
    return new Intl.DateTimeFormat(language, {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: time_format === '12h'
    }).format(new Date(dateString));
  } catch (error) {
    // Fallback to simple format
    return new Date(dateString).toLocaleString();
  }
};

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 * @param {string|Date} dateString - Date to format
 * @returns {string} - Relative time string
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
};

/**
 * Get distance unit label
 * @param {string} unit - 'miles' or 'km'
 * @returns {string} - Unit label ('mi' or 'km')
 */
export const getDistanceUnitLabel = (unit = 'miles') => {
  return unit === 'km' ? 'km' : 'mi';
};

/**
 * Get distance unit label (long form)
 * @param {string} unit - 'miles' or 'km'
 * @returns {string} - Unit label ('miles' or 'kilometers')
 */
export const getDistanceUnitLabelLong = (unit = 'miles') => {
  return unit === 'km' ? 'kilometers' : 'miles';
};
