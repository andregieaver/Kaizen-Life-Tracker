import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for managing system module settings
 * Handles enabling/disabling modules and their configurations
 */
const useModuleSettings = (athleteId) => {
  const [moduleSettings, setModuleSettings] = useState({
    affiliateProgram: {
      enabled: true,
      expanded: true
    },
    community: {
      enabled: true,
      expanded: true
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });

  /**
   * Toggle module enabled/disabled
   */
  const toggleModule = useCallback((moduleName) => {
    setModuleSettings(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        enabled: !prev[moduleName].enabled,
        expanded: !prev[moduleName].enabled // Auto-expand when enabling, collapse when disabling
      }
    }));
  }, []);

  /**
   * Toggle module expansion state (collapsed/expanded UI)
   */
  const toggleModuleExpansion = useCallback((moduleName) => {
    setModuleSettings(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        expanded: !prev[moduleName].expanded
      }
    }));
  }, []);

  /**
   * Save module settings to backend
   */
  const saveModuleSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      await axios.post(`${API}/system/settings?athlete_id=${athleteId}`, {
        modules: moduleSettings
      });
      
      setSaveStatus({
        message: 'Module settings saved successfully!',
        type: 'success'
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error saving module settings:', error);
      setSaveStatus({
        message: 'Failed to save module settings',
        type: 'error'
      });
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [athleteId, moduleSettings]);

  /**
   * Load module settings from backend
   */
  const loadModuleSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/system/settings?athlete_id=${athleteId}`);
      if (response.data.modules) {
        setModuleSettings(response.data.modules);
      }
      return { success: true, modules: response.data.modules };
    } catch (error) {
      logger.error(null, 'Error loading module settings:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Clear save status message
   */
  const clearSaveStatus = useCallback(() => {
    setSaveStatus({ message: '', type: '' });
  }, []);

  return {
    // State
    moduleSettings,
    isLoading,
    isSaving,
    saveStatus,
    
    // Actions
    toggleModule,
    toggleModuleExpansion,
    saveModuleSettings,
    loadModuleSettings,
    clearSaveStatus,
    
    // Direct setter (if needed)
    setModuleSettings
  };
};

export default useModuleSettings;
