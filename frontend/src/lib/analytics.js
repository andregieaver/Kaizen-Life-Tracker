/**
import { logger } from '../utils/logger';

 * Analytics Library for TrainSmart
 * Integrates with Google Tag Manager and Google Analytics 4
 * Supports Consent Mode v2 and privacy-first tracking
 */

/**
 * Push data to GTM dataLayer
 * @param {Object} obj - Data to push to dataLayer
 */
export function dlPush(obj) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(obj);
}

/**
 * Track a custom event
 * @param {string} event - Event name (snake_case)
 * @param {Object} props - Event properties
 */
export function track(event, props = {}) {
  if (typeof window === 'undefined') return;
  
  // Get base properties (UTM, anon_id, etc.)
  const baseProperties = baseProps();
  
  // Combine with custom properties
  const eventData = {
    event,
    ...baseProperties,
    ...props,
    timestamp: new Date().toISOString()
  };
  
  // Push to dataLayer
  dlPush(eventData);
  
  logger.debug(null, '📊 Analytics Event:', event, eventData);
}

/**
 * Set user ID after authentication
 * @param {string} userId - User ID (no PII)
 */
export function setUserId(userId) {
  if (typeof window === 'undefined') return;
  
  dlPush({
    event: 'set_user',
    user_id: userId
  });
  
  // Store in localStorage for persistence
  try {
    localStorage.setItem('analytics_user_id', userId);
  } catch (e) {
    logger.error(null, 'Failed to store user_id:', e);
  }
  
  logger.debug(null, '👤 User ID set:', userId);
}

/**
 * Clear user ID on logout
 */
export function clearUserId() {
  if (typeof window === 'undefined') return;
  
  dlPush({
    event: 'clear_user',
    user_id: undefined
  });
  
  try {
    localStorage.removeItem('analytics_user_id');
  } catch (e) {
    logger.error(null, 'Failed to remove user_id:', e);
  }
  
  logger.debug(null, '👤 User ID cleared');
}

/**
 * Initialize UTM parameters and anonymous ID
 * Should be called on app load
 */
export function bootUtmAndAnon() {
  if (typeof window === 'undefined') return;
  
  try {
    const url = new URL(window.location.href);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    
    // Load existing UTM parameters
    const stored = JSON.parse(localStorage.getItem('utm') || '{}');
    
    // Update with current URL parameters (if present)
    let hasNewUtm = false;
    utmKeys.forEach(key => {
      const value = url.searchParams.get(key);
      if (value) {
        stored[key] = value;
        hasNewUtm = true;
      }
    });
    
    // Save updated UTM parameters
    if (hasNewUtm) {
      localStorage.setItem('utm', JSON.stringify(stored));
      logger.debug(null, '🎯 UTM parameters captured:', stored);
    }
    
    // Generate anonymous ID if not exists
    if (!localStorage.getItem('anon_id')) {
      const anonId = generateUUID();
      localStorage.setItem('anon_id', anonId);
      logger.debug(null, '🔑 Anonymous ID generated:', anonId);
    }
    
    // Track first session timestamp
    if (!localStorage.getItem('first_session')) {
      localStorage.setItem('first_session', new Date().toISOString());
    }
  } catch (e) {
    logger.error(null, 'Failed to boot UTM and Anon ID:', e);
  }
}

/**
 * Get base properties for all events
 * @returns {Object} Base properties (UTM, anon_id, user_id)
 */
export function baseProps() {
  if (typeof window === 'undefined') return {};
  
  try {
    const utm = JSON.parse(localStorage.getItem('utm') || '{}');
    const anon_id = localStorage.getItem('anon_id');
    const user_id = localStorage.getItem('analytics_user_id');
    const first_session = localStorage.getItem('first_session');
    
    return {
      ...utm,
      anon_id,
      ...(user_id && { user_id }),
      ...(first_session && { first_session })
    };
  } catch (e) {
    logger.error(null, 'Failed to get base props:', e);
    return {};
  }
}

/**
 * Update consent state and notify GTM
 * @param {Object} consent - Consent state object
 */
export function updateConsent(consent) {
  if (typeof window === 'undefined') return;
  
  const consentState = {
    ad_storage: consent.marketing ? 'granted' : 'denied',
    ad_user_data: consent.marketing ? 'granted' : 'denied',
    ad_personalization: consent.marketing ? 'granted' : 'denied',
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    functionality_storage: consent.functional ? 'granted' : 'denied',
    personalization_storage: consent.functional ? 'granted' : 'denied',
    security_storage: 'granted' // Always granted for necessary cookies
  };
  
  dlPush({
    event: 'consent_update',
    consent: consentState
  });
  
  // Also update via gtag if available
  if (window.gtag) {
    window.gtag('consent', 'update', consentState);
  }
  
  logger.debug(null, '🍪 Consent updated:', consentState);
}

/**
 * Track page view (for SPA navigation)
 * @param {Object} props - Page properties
 */
export function trackPageView(props = {}) {
  if (typeof window === 'undefined') return;
  
  const pageData = {
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
    page_referrer: document.referrer,
    ...props
  };
  
  track('page_view', pageData);
}

/**
 * Track ecommerce events (for subscriptions)
 */
export const ecommerce = {
  /**
   * View item list (plan list)
   */
  viewItemList: (items, listName = 'Plans') => {
    track('view_item_list', {
      item_list_name: listName,
      items: items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        currency: item.currency || 'USD'
      }))
    });
  },
  
  /**
   * Select item (plan selected)
   */
  selectItem: (item) => {
    track('select_item', {
      item_list_name: 'Plans',
      items: [{
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        currency: item.currency || 'USD'
      }]
    });
  },
  
  /**
   * Begin checkout
   */
  beginCheckout: (item, value, currency = 'USD') => {
    track('begin_checkout', {
      value: parseFloat(value),
      currency,
      items: [{
        item_id: item.id,
        item_name: item.name,
        price: parseFloat(item.price),
        quantity: 1
      }]
    });
  },
  
  /**
   * Purchase completed
   */
  purchase: (transactionId, value, currency, items, coupon = null) => {
    track('purchase', {
      transaction_id: transactionId,
      value: parseFloat(value),
      currency,
      ...(coupon && { coupon }),
      items: items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity || 1
      }))
    });
  }
};

/**
 * Generate UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Check if analytics consent is granted
 * @returns {boolean}
 */
export function hasAnalyticsConsent() {
  if (typeof window === 'undefined') return false;
  
  try {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) return false;
    
    const parsed = JSON.parse(consent);
    return parsed.preferences?.analytics === true;
  } catch (e) {
    return false;
  }
}

/**
 * Track form interactions
 */
export const forms = {
  start: (formName, formId) => {
    track('form_start', { form_name: formName, form_id: formId });
  },
  
  submit: (formName, formId) => {
    track('form_submit', { form_name: formName, form_id: formId });
  },
  
  error: (formName, formId, errorMessage) => {
    track('form_error', { 
      form_name: formName, 
      form_id: formId, 
      error_message: errorMessage 
    });
  }
};

// Export default object for convenience
export default {
  dlPush,
  track,
  setUserId,
  clearUserId,
  bootUtmAndAnon,
  baseProps,
  updateConsent,
  trackPageView,
  hasAnalyticsConsent,
  ecommerce,
  forms
};

// Export all tracking hooks and utilities
export * from './autoCapture';
export * from './useViewTracker';
