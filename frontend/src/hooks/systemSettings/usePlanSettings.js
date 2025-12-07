import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for managing subscription plan settings
 * Handles plan CRUD, features management, and drag-and-drop reordering
 */
const usePlanSettings = (athleteId) => {
  const [planSettings, setPlanSettings] = useState({
    free: {
      title: 'Free',
      description: 'Get started with basic features',
      features: ['Basic training plans', '30-day history', 'Community access']
    },
    pro: {
      title: 'Pro',
      description: 'Advanced features for serious runners',
      features: ['Everything in Free', 'Unlimited history', 'AI coach chat', 'Advanced analytics']
    },
    premium: {
      title: 'Premium',
      description: 'Complete running coaching experience',
      features: ['Everything in Pro', 'Custom training plans', 'Nutrition guidance', 'Priority support']
    }
  });

  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedFeature, setDraggedFeature] = useState({ plan: null, index: null });
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });
  
  // Modal states
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [showCreateVariationModal, setShowCreateVariationModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  /**
   * Load subscription plans from backend
   */
  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/subscription/plans?athlete_id=${athleteId}`);
      const plans = response.data.plans || [];
      setSubscriptionPlans(plans);
      return { success: true, plans };
    } catch (error) {
      logger.error(null, 'Error loading subscription plans:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Load plan settings from backend
   */
  const loadPlanSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/system/settings?athlete_id=${athleteId}`);
      if (response.data.plans) {
        setPlanSettings(response.data.plans);
      }
      return { success: true, settings: response.data.plans };
    } catch (error) {
      logger.error(null, 'Error loading plan settings:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Save plan settings to backend
   */
  const savePlanSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      await axios.post(`${API}/system/settings?athlete_id=${athleteId}`, {
        plans: planSettings
      });
      
      setSaveStatus({
        message: 'Plan settings saved successfully!',
        type: 'success'
      });
      
      setTimeout(() => {
        setSaveStatus({ message: '', type: '' });
      }, 3000);
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error saving plan settings:', error);
      setSaveStatus({
        message: 'Failed to save plan settings',
        type: 'error'
      });
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [athleteId, planSettings]);

  /**
   * Update plan field (title, description)
   */
  const updatePlanField = useCallback((planType, field, value) => {
    setPlanSettings(prev => ({
      ...prev,
      [planType]: {
        ...prev[planType],
        [field]: value
      }
    }));
  }, []);

  /**
   * Add feature to plan
   */
  const addFeature = useCallback((planType) => {
    setPlanSettings(prev => ({
      ...prev,
      [planType]: {
        ...prev[planType],
        features: [...prev[planType].features, '']
      }
    }));
  }, []);

  /**
   * Remove feature from plan
   */
  const removeFeature = useCallback((planType, index) => {
    setPlanSettings(prev => ({
      ...prev,
      [planType]: {
        ...prev[planType],
        features: prev[planType].features.filter((_, i) => i !== index)
      }
    }));
  }, []);

  /**
   * Update feature text
   */
  const updateFeature = useCallback((planType, index, value) => {
    setPlanSettings(prev => {
      const newFeatures = [...prev[planType].features];
      newFeatures[index] = value;
      return {
        ...prev,
        [planType]: {
          ...prev[planType],
          features: newFeatures
        }
      };
    });
  }, []);

  /**
   * Drag handlers for feature reordering
   */
  const handleFeatureDragStart = useCallback((e, planType, index) => {
    setDraggedFeature({ plan: planType, index });
    e.dataTransfer.effectAllowed = 'move';
    
    // Set drag image to prevent default ghost image
    const dragImg = e.target.cloneNode(true);
    dragImg.style.opacity = '0';
    document.body.appendChild(dragImg);
    e.dataTransfer.setDragImage(dragImg, 0, 0);
    setTimeout(() => document.body.removeChild(dragImg), 0);
  }, []);

  const handleFeatureDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleFeatureDrop = useCallback((e, planType, dropIndex) => {
    e.preventDefault();
    
    const { plan: dragPlan, index: dragIndex } = draggedFeature;
    
    // Only allow reordering within the same plan
    if (dragPlan !== planType || dragIndex === null || dragIndex === dropIndex) {
      setDraggedFeature({ plan: null, index: null });
      return;
    }

    setPlanSettings(prev => {
      const features = [...prev[planType].features];
      const [draggedItem] = features.splice(dragIndex, 1);
      features.splice(dropIndex, 0, draggedItem);
      
      return {
        ...prev,
        [planType]: {
          ...prev[planType],
          features
        }
      };
    });
    
    setDraggedFeature({ plan: null, index: null });
  }, [draggedFeature]);

  const handleFeatureDragEnd = useCallback(() => {
    setDraggedFeature({ plan: null, index: null });
  }, []);

  /**
   * Clear save status
   */
  const clearSaveStatus = useCallback(() => {
    setSaveStatus({ message: '', type: '' });
  }, []);

  return {
    // State
    planSettings,
    subscriptionPlans,
    isLoading,
    isSaving,
    draggedFeature,
    saveStatus,
    
    // Modal states
    showCreatePlanModal,
    showEditPlanModal,
    showCreateVariationModal,
    selectedPlan,
    
    // Actions
    loadPlans,
    loadPlanSettings,
    savePlanSettings,
    updatePlanField,
    addFeature,
    removeFeature,
    updateFeature,
    clearSaveStatus,
    
    // Drag & Drop
    dragHandlers: {
      handleFeatureDragStart,
      handleFeatureDragOver,
      handleFeatureDrop,
      handleFeatureDragEnd
    },
    
    // Modal setters
    setShowCreatePlanModal,
    setShowEditPlanModal,
    setShowCreateVariationModal,
    setSelectedPlan,
    
    // Direct setters
    setPlanSettings,
    setSubscriptionPlans
  };
};

export default usePlanSettings;
