/**
 * useViewTracker Hook
 * Tracks when an element comes into view using IntersectionObserver
 * Useful for tracking section visibility, scroll-based engagement
 */

import { useEffect, useRef } from 'react';
import { track, hasAnalyticsConsent } from './analytics';

import { logger } from '../utils/logger';
/**
 * Hook to track when an element comes into view
 * @param {string} eventName - Event name to track (e.g., 'section_view')
 * @param {Object} eventProps - Properties to include with the event
 * @param {Object} options - IntersectionObserver options
 * @returns {React.Ref} - Ref to attach to the element
 */
export function useViewTracker(
  eventName = 'section_view',
  eventProps = {},
  options = {}
) {
  const elementRef = useRef(null);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Check if analytics consent is granted
    if (!hasAnalyticsConsent()) {
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    // Default options: trigger when 50% of element is visible
    const observerOptions = {
      threshold: 0.5, // 50% visible
      rootMargin: '0px',
      ...options
    };

    // Create IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // Only track once per element
        if (entry.isIntersecting && !hasTrackedRef.current) {
          hasTrackedRef.current = true;
          
          // Track the view event
          track(eventName, {
            ...eventProps,
            element_id: element.id || undefined,
            element_class: element.className || undefined,
            visibility_ratio: entry.intersectionRatio,
            viewport_height: window.innerHeight,
            element_height: entry.boundingClientRect.height
          });
          
          logger.debug(null, `👁️ View tracked: ${eventName}`, eventProps);
          
          // Unobserve after tracking (track only once)
          observer.unobserve(element);
        }
      });
    }, observerOptions);

    // Start observing
    observer.observe(element);

    // Cleanup
    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [eventName, eventProps, options]);

  return elementRef;
}

/**
 * Hook to track scroll depth milestones
 * Tracks 25%, 50%, 75%, 100% scroll depth
 */
export function useScrollDepth() {
  const milestonesRef = useRef({
    25: false,
    50: false,
    75: false,
    100: false
  });

  useEffect(() => {
    // Check if analytics consent is granted
    if (!hasAnalyticsConsent()) {
      return;
    }

    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Calculate scroll percentage
      const scrollableHeight = documentHeight - windowHeight;
      const scrollPercentage = (scrollTop / scrollableHeight) * 100;

      // Check milestones
      [25, 50, 75, 100].forEach(milestone => {
        if (scrollPercentage >= milestone && !milestonesRef.current[milestone]) {
          milestonesRef.current[milestone] = true;
          
          track('scroll_depth', {
            depth_percentage: milestone,
            page_path: window.location.pathname,
            document_height: documentHeight,
            viewport_height: windowHeight
          });
          
          logger.debug(null, `📜 Scroll depth: ${milestone}%`);
        }
      });
    };

    // Add scroll listener with throttling
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll);

    // Cleanup
    return () => {
      window.removeEventListener('scroll', throttledScroll);
    };
  }, []);
}

/**
 * Hook to track time spent on page
 * Tracks when user spends significant time (engaged)
 * @param {number} threshold - Time threshold in seconds (default: 30)
 */
export function useTimeOnPage(threshold = 30) {
  useEffect(() => {
    // Check if analytics consent is granted
    if (!hasAnalyticsConsent()) {
      return;
    }

    const startTime = Date.now();
    let hasTracked = false;

    const checkTimeSpent = () => {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      
      if (timeSpent >= threshold && !hasTracked) {
        hasTracked = true;
        
        track('engaged_time', {
          page_path: window.location.pathname,
          time_seconds: timeSpent,
          threshold_seconds: threshold
        });
        
        logger.debug(null, `⏱️ Engaged time: ${timeSpent}s`);
      }
    };

    // Check every 5 seconds
    const interval = setInterval(checkTimeSpent, 5000);

    // Track on unmount as well
    return () => {
      clearInterval(interval);
      
      const finalTimeSpent = Math.floor((Date.now() - startTime) / 1000);
      
      if (finalTimeSpent >= 5 && !hasTracked) {
        track('time_on_page', {
          page_path: window.location.pathname,
          time_seconds: finalTimeSpent
        });
      }
    };
  }, [threshold]);
}

/**
 * Hook to track video interactions
 * @param {React.Ref} videoRef - Reference to video element
 */
export function useVideoTracking(videoRef, videoId = 'unknown') {
  useEffect(() => {
    if (!hasAnalyticsConsent()) {
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const trackedMilestones = {
      started: false,
      25: false,
      50: false,
      75: false,
      completed: false
    };

    const handlePlay = () => {
      if (!trackedMilestones.started) {
        trackedMilestones.started = true;
        track('video_start', { video_id: videoId });
      }
    };

    const handlePause = () => {
      const progress = (video.currentTime / video.duration) * 100;
      track('video_pause', { 
        video_id: videoId,
        progress_percentage: Math.floor(progress)
      });
    };

    const handleEnded = () => {
      if (!trackedMilestones.completed) {
        trackedMilestones.completed = true;
        track('video_complete', { video_id: videoId });
      }
    };

    const handleTimeUpdate = () => {
      const progress = (video.currentTime / video.duration) * 100;
      
      [25, 50, 75].forEach(milestone => {
        if (progress >= milestone && !trackedMilestones[milestone]) {
          trackedMilestones[milestone] = true;
          track('video_progress', { 
            video_id: videoId,
            progress_percentage: milestone
          });
        }
      });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, videoId]);
}

export default {
  useViewTracker,
  useScrollDepth,
  useTimeOnPage,
  useVideoTracking
};
