import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for managing advanced system settings
 * Handles SEO, Stripe, integrations (Strava, Oura, etc.), and API keys
 */
const useAdvancedSettings = (athleteId) => {
  const [advancedSettings, setAdvancedSettings] = useState({
    seo: {
      siteTitle: '',
      metaDescription: '',
      faviconUrl: '',
      logoUrl: '',
      ogImage: ''
    },
    openaiApiKey: '',
    showKey: false,
    stripe: {
      mode: 'test', // 'test' or 'live'
      live: {
        publishableKey: '',
        apiKey: '',
        webhookSecret: ''
      },
      sandbox: {
        publishableKey: '',
        apiKey: '',
        webhookSecret: ''
      }
    },
    showStripeLiveKey: false,
    showStripeLiveWebhook: false,
    showStripeSandboxKey: false,
    showStripeSandboxWebhook: false,
    sendgrid: {
      apiKey: '',
      senderEmail: '',
      senderName: ''
    },
    showSendgridKey: false,
    googleTagManager: {
      headCode: '',
      bodyCode: ''
    },
    microsoftClarity: {
      scriptCode: ''
    },
    strava: {
      clientId: '',
      clientSecret: '',
      webhookVerifyToken: '',
      callbackDomain: ''
    },
    showStravaSecret: false,
    showStravaVerifyToken: false,
    oura: {
      clientId: '',
      clientSecret: '',
      callbackDomain: ''
    },
    polar: {
      clientId: '',
      clientSecret: '',
      callbackDomain: ''
    },
    fitbit: {
      clientId: '',
      clientSecret: '',
      callbackDomain: ''
    },
    garmin: {
      clientId: '',
      clientSecret: '',
      callbackDomain: ''
    },
    coros: {
      clientId: '',
      clientSecret: '',
      callbackDomain: ''
    },
    whoop: {
      clientId: '',
      clientSecret: '',
      callbackDomain: ''
    },
    suunto: {
      clientId: '',
      clientSecret: '',
      callbackDomain: ''
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });

  /**
   * Load advanced settings from backend
   */
  const loadAdvancedSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/system/settings?athlete_id=${athleteId}`);
      if (response.data.advanced) {
        setAdvancedSettings(prev => ({
          ...prev,
          ...response.data.advanced
        }));
      }
      return { success: true, settings: response.data.advanced };
    } catch (error) {
      logger.error(null, 'Error loading advanced settings:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Save advanced settings to backend
   */
  const saveAdvancedSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      await axios.post(`${API}/system/settings?athlete_id=${athleteId}`, {
        advanced: {
          seo: advancedSettings.seo,
          openaiApiKey: advancedSettings.openaiApiKey,
          stripe: {
            mode: advancedSettings.stripe.mode,
            live: advancedSettings.stripe.live,
            sandbox: advancedSettings.stripe.sandbox
          },
          sendgrid: advancedSettings.sendgrid,
          googleTagManager: advancedSettings.googleTagManager,
          microsoftClarity: advancedSettings.microsoftClarity,
          strava: advancedSettings.strava,
          oura: advancedSettings.oura,
          polar: advancedSettings.polar,
          fitbit: advancedSettings.fitbit,
          garmin: advancedSettings.garmin,
          coros: advancedSettings.coros,
          whoop: advancedSettings.whoop,
          suunto: advancedSettings.suunto
        }
      });
      
      setSaveStatus({
        message: 'Advanced settings saved successfully!',
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error saving advanced settings:', error);
      setSaveStatus({
        message: 'Failed to save advanced settings',
        type: 'error'
      });
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [athleteId, advancedSettings]);

  /**
   * Update SEO settings
   */
  const updateSEOSetting = useCallback((field, value) => {
    setAdvancedSettings(prev => ({
      ...prev,
      seo: {
        ...prev.seo,
        [field]: value
      }
    }));
  }, []);

  /**
   * Update simple top-level settings (like openaiApiKey)
   */
  const updateSimpleSetting = useCallback((field, value) => {
    setAdvancedSettings(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);


  /**
   * Update Stripe mode (test/live)
   */
  const updateStripeMode = useCallback((mode) => {
    setAdvancedSettings(prev => ({
      ...prev,
      stripe: {
        ...prev.stripe,
        mode
      }
    }));
  }, []);

  /**
   * Update Stripe credentials
   */
  const updateStripeCredentials = useCallback((environment, field, value) => {
    setAdvancedSettings(prev => ({
      ...prev,
      stripe: {
        ...prev.stripe,
        [environment]: {
          ...prev.stripe[environment],
          [field]: value
        }
      }
    }));
  }, []);

  /**
   * Update integration credentials
   */
  const updateIntegration = useCallback((integration, field, value) => {
    setAdvancedSettings(prev => ({
      ...prev,
      [integration]: {
        ...prev[integration],
        [field]: value
      }
    }));
  }, []);

  /**
   * Toggle visibility of sensitive fields
   */
  const toggleVisibility = useCallback((field) => {
    setAdvancedSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  }, []);

  /**
   * Upload SEO image (favicon, logo, ogImage)
   */
  const uploadSEOImage = useCallback(async (imageType, file) => {
    if (!file) return { success: false, error: 'No file provided' };

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Map frontend field names to backend types
      const typeMap = {
        'faviconUrl': 'favicon',
        'logoUrl': 'logo',
        'ogImage': 'og_image'
      };
      const backendType = typeMap[imageType] || imageType;

      // Send image_type as query parameter, not in FormData
      const response = await axios.post(
        `${API}/system/upload-seo-image?athlete_id=${athleteId}&image_type=${backendType}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      // Backend returns 'path', not 'url'
      const imageUrl = response.data.path;
      
      // Update the appropriate SEO field
      updateSEOSetting(imageType, imageUrl);
      
      return { success: true, url: imageUrl };
    } catch (error) {
      logger.error(null, `Error uploading ${imageType}:`, error);
      return { success: false, error: error.message };
    }
  }, [athleteId, updateSEOSetting]);

  /**
   * Clear save status
   */
  const clearSaveStatus = useCallback(() => {
    setSaveStatus({ message: '', type: '' });
  }, []);

  /**
   * Get integration status (configured or not)
   */
  const getIntegrationStatus = useCallback((integration) => {
    const config = advancedSettings[integration];
    if (!config) return false;
    
    // Check if at least clientId is set
    return Boolean(config.clientId && config.clientId.trim());
  }, [advancedSettings]);

  return {
    // State
    advancedSettings,
    isLoading,
    isSaving,
    saveStatus,
    
    // Actions
    loadAdvancedSettings,
    saveAdvancedSettings,
    updateSEOSetting,
    updateSimpleSetting,
    updateStripeMode,
    updateStripeCredentials,
    updateIntegration,
    toggleVisibility,
    uploadSEOImage,
    clearSaveStatus,
    getIntegrationStatus,
    
    // Setters
    setAdvancedSettings
  };
};

export default useAdvancedSettings;
