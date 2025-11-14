/**
 * Auto-Capture Click Tracking
 * Automatically tracks clicks on elements with data-track attribute
 */

import { track, hasAnalyticsConsent } from './analytics';

import { logger } from '../utils/logger';
/**
 * Initialize auto-capture click tracking
 * Listens for clicks on elements with data-track attribute
 */
export function initAutoCapture() {
  if (typeof window === 'undefined') return;

  // Add click listener to document
  document.addEventListener('click', handleAutoCapture, true);
  
  logger.debug(null, '🎯 Auto-capture click tracking initialized');
}

/**
 * Handle auto-capture click events
 * @param {Event} event - Click event
 */
function handleAutoCapture(event) {
  // Check consent
  if (!hasAnalyticsConsent()) {
    return;
  }

  // Find the clicked element or its parent with data-track
  let element = event.target;
  let maxDepth = 5; // Don't traverse too far up
  let depth = 0;

  while (element && depth < maxDepth) {
    if (element.dataset && element.dataset.track) {
      // Found element with data-track attribute
      const eventName = element.dataset.track;
      
      // Parse additional properties from data-props
      let props = {};
      if (element.dataset.props) {
        try {
          props = JSON.parse(element.dataset.props);
        } catch (e) {
          logger.error(null, 'Failed to parse data-props:', e);
        }
      }
      
      // Auto-extract common properties
      const autoProps = {
        element_type: element.tagName.toLowerCase(),
        element_id: element.id || undefined,
        element_class: element.className || undefined,
        element_text: element.textContent?.trim().substring(0, 100) || undefined,
        element_href: element.href || undefined
      };
      
      // Track the event
      track(eventName, {
        ...autoProps,
        ...props
      });
      
      break; // Stop after finding the first tracked element
    }
    
    element = element.parentElement;
    depth++;
  }
}

/**
 * Cleanup auto-capture
 * Removes event listener
 */
export function cleanupAutoCapture() {
  if (typeof window === 'undefined') return;
  
  document.removeEventListener('click', handleAutoCapture, true);
  logger.debug(null, '🎯 Auto-capture click tracking cleaned up');
}

export default {
  initAutoCapture,
  cleanupAutoCapture
};
