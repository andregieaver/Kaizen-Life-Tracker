import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for managing discount coupons
 * Handles coupon CRUD operations, enabling/disabling, and filtering
 */
const useCouponManagement = (athleteId) => {
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDisabledCoupons, setShowDisabledCoupons] = useState(false);
  
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    name: '',
    type: 'percentage', // 'percentage' or 'fixed'
    value: '',
    max_uses: '',
    expires_at: '',
    applies_to: 'all', // 'all' or 'specific'
    specific_plans: [],
    min_purchase_amount: ''
  });

  /**
   * Load all coupons from backend
   */
  const loadCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/coupons?athlete_id=${athleteId}`);
      const loadedCoupons = response.data.coupons || [];
      setCoupons(loadedCoupons);
      return { success: true, coupons: loadedCoupons };
    } catch (error) {
      logger.error(null, 'Error loading coupons:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Get filtered coupons based on enabled/disabled toggle
   */
  const getFilteredCoupons = useCallback(() => {
    if (showDisabledCoupons) {
      return coupons;
    }
    return coupons.filter(coupon => coupon.enabled);
  }, [coupons, showDisabledCoupons]);

  /**
   * Create a new coupon
   */
  const createCoupon = useCallback(async () => {
    try {
      // Validate required fields
      if (!newCoupon.code || !newCoupon.name || !newCoupon.value) {
        return { success: false, error: 'Please fill in all required fields' };
      }

      // Validate value based on type
      const value = parseFloat(newCoupon.value);
      if (isNaN(value) || value <= 0) {
        return { success: false, error: 'Please enter a valid discount value' };
      }

      if (newCoupon.type === 'percentage' && (value < 0 || value > 100)) {
        return { success: false, error: 'Percentage must be between 0 and 100' };
      }

      const couponData = {
        code: newCoupon.code.toUpperCase().trim(),
        name: newCoupon.name,
        type: newCoupon.type,
        value: value,
        applies_to: newCoupon.applies_to,
        enabled: true
      };

      // Add optional fields if provided
      if (newCoupon.max_uses) {
        couponData.max_uses = parseInt(newCoupon.max_uses);
      }
      if (newCoupon.expires_at) {
        couponData.expires_at = new Date(newCoupon.expires_at).toISOString();
      }
      if (newCoupon.min_purchase_amount) {
        couponData.min_purchase_amount = parseFloat(newCoupon.min_purchase_amount);
      }
      if (newCoupon.specific_plans && newCoupon.specific_plans.length > 0) {
        couponData.specific_plans = newCoupon.specific_plans;
      }

      await axios.post(`${API}/coupons?athlete_id=${athleteId}`, couponData);
      
      // Reset form
      resetNewCoupon();
      
      // Reload coupons
      await loadCoupons();
      
      return { success: true, message: 'Coupon created successfully!' };
    } catch (error) {
      logger.error(null, 'Error creating coupon:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create coupon';
      return { success: false, error: errorMessage };
    }
  }, [athleteId, newCoupon, loadCoupons]);

  /**
   * Toggle coupon enabled/disabled
   */
  const toggleCoupon = useCallback(async (code, currentlyEnabled) => {
    try {
      await axios.put(
        `${API}/coupons/${code}?athlete_id=${athleteId}`,
        { enabled: !currentlyEnabled }
      );
      await loadCoupons();
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error toggling coupon:', error);
      return { success: false, error: 'Failed to update coupon status' };
    }
  }, [athleteId, loadCoupons]);

  /**
   * Delete a coupon
   */
  const deleteCoupon = useCallback(async (code) => {
    try {
      await axios.delete(`${API}/coupons/${code}?athlete_id=${athleteId}`);
      await loadCoupons();
      return { success: true, message: 'Coupon deleted successfully' };
    } catch (error) {
      logger.error(null, 'Error deleting coupon:', error);
      return { success: false, error: 'Failed to delete coupon' };
    }
  }, [athleteId, loadCoupons]);

  /**
   * Update new coupon form field
   */
  const updateNewCoupon = useCallback((field, value) => {
    setNewCoupon(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * Reset new coupon form
   */
  const resetNewCoupon = useCallback(() => {
    setNewCoupon({
      code: '',
      name: '',
      type: 'percentage',
      value: '',
      max_uses: '',
      expires_at: '',
      applies_to: 'all',
      specific_plans: [],
      min_purchase_amount: ''
    });
  }, []);

  /**
   * Toggle showing disabled coupons
   */
  const toggleShowDisabled = useCallback(() => {
    setShowDisabledCoupons(prev => !prev);
  }, []);

  return {
    // State
    coupons,
    isLoading,
    showDisabledCoupons,
    newCoupon,
    
    // Computed
    filteredCoupons: getFilteredCoupons(),
    enabledCount: coupons.filter(c => c.enabled).length,
    disabledCount: coupons.filter(c => !c.enabled).length,
    totalCount: coupons.length,
    
    // Actions
    loadCoupons,
    createCoupon,
    toggleCoupon,
    deleteCoupon,
    updateNewCoupon,
    resetNewCoupon,
    toggleShowDisabled,
    
    // Setters
    setCoupons,
    setNewCoupon
  };
};

export default useCouponManagement;
