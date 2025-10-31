/**
 * usePageViews Hook
 * Tracks SPA page views on route changes
 * Integrates with React Router
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, bootUtmAndAnon, hasAnalyticsConsent } from './analytics';
import { initAutoCapture, cleanupAutoCapture } from './autoCapture';

/**
 * Hook to track page views on route changes
 * Should be mounted once in the root component (App.js)
 */
export function usePageViews() {
  const location = useLocation();

  // Initialize UTM, Anonymous ID, and Auto-Capture on mount
  useEffect(() => {
    bootUtmAndAnon();
    initAutoCapture();
    console.log('🚀 Analytics initialized');

    // Cleanup auto-capture on unmount
    return () => {
      cleanupAutoCapture();
    };
  }, []);

  // Track page view on route change
  useEffect(() => {
    // Only track if analytics consent is granted
    if (!hasAnalyticsConsent()) {
      console.log('⏸️  Page view not tracked (no analytics consent)');
      return;
    }

    // Track the page view
    trackPageView({
      page_path: location.pathname,
      page_search: location.search,
      page_hash: location.hash
    });
  }, [location]);
}

export default usePageViews;
