import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for group CRUD operations and membership
 * Handles creating, editing, deleting groups and managing membership
 */
const useGroupActions = (athleteId) => {
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  /**
   * Load all available groups
   */
  const loadAllGroups = useCallback(async (limit = 15) => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${API}/community/groups?athlete_id=${athleteId}&limit=${limit}&exclude_images=false`
      );
      const loadedGroups = response.data.groups || [];
      setGroups(loadedGroups);
      return { success: true, groups: loadedGroups };
    } catch (error) {
      logger.error(null, 'Error loading groups:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Load groups the athlete is a member of
   */
  const loadMyGroups = useCallback(async (limit = 15) => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${API}/community/mygroups?athlete_id=${athleteId}&limit=${limit}&exclude_images=false`
      );
      const loadedGroups = response.data.groups || [];
      setMyGroups(loadedGroups);
      return { success: true, groups: loadedGroups };
    } catch (error) {
      logger.error(null, 'Error loading my groups:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Create a new group
   */
  const createGroup = useCallback(async (groupData) => {
    if (!groupData.name?.trim()) {
      return { success: false, error: 'Group name is required' };
    }

    setIsCreating(true);
    try {
      const response = await axios.post(
        `${API}/community/groups?athlete_id=${athleteId}`,
        groupData
      );
      return { success: true, group: response.data };
    } catch (error) {
      logger.error(null, 'Error creating group:', error);
      return { success: false, error: error.message };
    } finally {
      setIsCreating(false);
    }
  }, [athleteId]);

  /**
   * Update an existing group
   */
  const updateGroup = useCallback(async (groupId, groupData) => {
    if (!groupData.name?.trim()) {
      return { success: false, error: 'Group name is required' };
    }

    setIsUpdating(true);
    try {
      const response = await axios.put(
        `${API}/community/groups/${groupId}?athlete_id=${athleteId}`,
        groupData
      );
      return { success: true, group: response.data };
    } catch (error) {
      logger.error(null, 'Error updating group:', error);
      return { success: false, error: error.message };
    } finally {
      setIsUpdating(false);
    }
  }, [athleteId]);

  /**
   * Delete a group
   */
  const deleteGroup = useCallback(async (groupId) => {
    setIsDeleting(true);
    try {
      await axios.delete(`${API}/community/groups/${groupId}?athlete_id=${athleteId}`);
      
      // Update local state
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setMyGroups(prev => prev.filter(g => g.id !== groupId));
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error deleting group:', error);
      return { success: false, error: error.message };
    } finally {
      setIsDeleting(false);
    }
  }, [athleteId]);

  /**
   * Join a group
   */
  const joinGroup = useCallback(async (groupId) => {
    setIsJoining(true);
    try {
      await axios.post(`${API}/community/groups/${groupId}/join?athlete_id=${athleteId}`);
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error joining group:', error);
      return { success: false, error: error.message };
    } finally {
      setIsJoining(false);
    }
  }, [athleteId]);

  /**
   * Leave a group
   */
  const leaveGroup = useCallback(async (groupId) => {
    setIsLeaving(true);
    try {
      await axios.post(`${API}/community/groups/${groupId}/leave?athlete_id=${athleteId}`);
      
      // Update local state
      setMyGroups(prev => prev.filter(g => g.id !== groupId));
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error leaving group:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLeaving(false);
    }
  }, [athleteId]);

  return {
    // State
    groups,
    myGroups,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isJoining,
    isLeaving,
    
    // Actions
    loadAllGroups,
    loadMyGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    joinGroup,
    leaveGroup,
    
    // Setters (for manual state management if needed)
    setGroups,
    setMyGroups
  };
};

export default useGroupActions;
