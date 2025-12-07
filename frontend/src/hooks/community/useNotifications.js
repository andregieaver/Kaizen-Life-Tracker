import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for notification management
 * Handles loading, marking as read, and tracking unread count
 */
const useNotifications = (athleteId, autoLoad = false) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load notifications for the athlete
   */
  const loadNotifications = useCallback(async () => {
    if (!athleteId) return { success: false, error: 'No athlete ID' };
    
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/community/notifications/${athleteId}`);
      const loadedNotifications = response.data.notifications || [];
      
      setNotifications(loadedNotifications);
      
      // Calculate unread count
      const unread = loadedNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
      
      return { success: true, notifications: loadedNotifications, unreadCount: unread };
    } catch (error) {
      logger.error(null, 'Error loading notifications:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await axios.put(`${API}/community/notifications/${notificationId}/read`);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await axios.put(`${API}/community/notifications/${athleteId}/read-all`);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      setUnreadCount(0);
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error marking all notifications as read:', error);
      return { success: false, error: error.message };
    }
  }, [athleteId]);

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Auto-load notifications on mount if enabled
  useEffect(() => {
    if (autoLoad && athleteId) {
      loadNotifications();
    }
  }, [autoLoad, athleteId, loadNotifications]);

  return {
    // State
    notifications,
    unreadCount,
    isLoading,
    
    // Actions
    loadNotifications,
    markAsRead,
    markAllAsRead,
    clearNotifications
  };
};

export default useNotifications;
