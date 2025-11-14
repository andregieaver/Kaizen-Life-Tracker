import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Custom hook for managing cookie consent settings
 * Handles cookie categories, scanning, and saving preferences
 */
const useCookieSettings = (athleteId) => {
  const [cookieSettings, setCookieSettings] = useState({
    enabled: false,
    bannerText: '',
    categories: {
      necessary: {
        enabled: true,
        locked: true,
        cookies: []
      },
      functional: {
        enabled: true,
        cookies: []
      },
      analytics: {
        enabled: true,
        cookies: []
      },
      marketing: {
        enabled: true,
        cookies: []
      }
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });

  /**
   * Load cookie settings from backend
   */
  const loadCookieSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/system/cookie-settings?athlete_id=${athleteId}`);
      if (response.data.cookieSettings) {
        setCookieSettings(response.data.cookieSettings);
      }
      return { success: true, settings: response.data.cookieSettings };
    } catch (error) {
      logger.error(null, 'Error loading cookie settings:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Save cookie settings to backend
   */
  const saveCookieSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      await axios.post(`${API}/system/cookie-settings?athlete_id=${athleteId}`, {
        cookieSettings
      });
      
      setSaveStatus({
        message: 'Cookie settings saved successfully!',
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error saving cookie settings:', error);
      setSaveStatus({
        message: 'Failed to save cookie settings',
        type: 'error'
      });
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [athleteId, cookieSettings]);

  /**
   * Scan for cookies on the website
   */
  const scanCookies = useCallback(async () => {
    setIsScanning(true);
    try {
      const response = await axios.post(`${API}/system/scan-cookies?athlete_id=${athleteId}`);
      
      if (response.data.cookies) {
        // Update cookie settings with scanned cookies
        setCookieSettings(prev => ({
          ...prev,
          categories: {
            ...prev.categories,
            necessary: {
              ...prev.categories.necessary,
              cookies: response.data.cookies.necessary || []
            },
            functional: {
              ...prev.categories.functional,
              cookies: response.data.cookies.functional || []
            },
            analytics: {
              ...prev.categories.analytics,
              cookies: response.data.cookies.analytics || []
            },
            marketing: {
              ...prev.categories.marketing,
              cookies: response.data.cookies.marketing || []
            }
          }
        }));
      }
      
      return { success: true, cookies: response.data.cookies };
    } catch (error) {
      logger.error(null, 'Error scanning cookies:', error);
      return { success: false, error: error.message };
    } finally {
      setIsScanning(false);
    }
  }, [athleteId]);

  /**
   * Toggle cookie consent banner enabled/disabled
   */
  const toggleCookieConsent = useCallback(() => {
    setCookieSettings(prev => ({
      ...prev,
      enabled: !prev.enabled
    }));
  }, []);

  /**
   * Update banner text
   */
  const updateBannerText = useCallback((text) => {
    setCookieSettings(prev => ({
      ...prev,
      bannerText: text
    }));
  }, []);

  /**
   * Toggle category enabled/disabled
   */
  const toggleCategory = useCallback((category) => {
    setCookieSettings(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          enabled: !prev.categories[category].enabled
        }
      }
    }));
  }, []);

  /**
   * Add cookie to category
   */
  const addCookie = useCallback((category, cookie) => {
    setCookieSettings(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          cookies: [...prev.categories[category].cookies, cookie]
        }
      }
    }));
  }, []);

  /**
   * Remove cookie from category
   */
  const removeCookie = useCallback((category, cookieIndex) => {
    setCookieSettings(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          cookies: prev.categories[category].cookies.filter((_, i) => i !== cookieIndex)
        }
      }
    }));
  }, []);

  /**
   * Clear save status
   */
  const clearSaveStatus = useCallback(() => {
    setSaveStatus({ message: '', type: '' });
  }, []);

  return {
    // State
    cookieSettings,
    isLoading,
    isSaving,
    isScanning,
    saveStatus,
    
    // Actions
    loadCookieSettings,
    saveCookieSettings,
    scanCookies,
    toggleCookieConsent,
    updateBannerText,
    toggleCategory,
    addCookie,
    removeCookie,
    clearSaveStatus,
    
    // Setters
    setCookieSettings
  };
};

export default useCookieSettings;
