import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for challenge CRUD operations and participation
 * Handles creating, editing, deleting challenges and managing participation
 */
const useChallengeActions = (athleteId) => {
  const [challenges, setChallenges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  /**
   * Load challenges with optional filter
   * @param {string} filter - 'all', 'active', 'completed', 'my'
   */
  const loadChallenges = useCallback(async (filter = 'all', limit = 20) => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${API}/community/challenges?athlete_id=${athleteId}&filter_type=${filter}&limit=${limit}`
      );
      const loadedChallenges = response.data.challenges || [];
      setChallenges(loadedChallenges);
      return { success: true, challenges: loadedChallenges };
    } catch (error) {
      logger.error(null, 'Error loading challenges:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Create a new challenge
   */
  const createChallenge = useCallback(async (challengeData) => {
    if (!challengeData.name?.trim()) {
      return { success: false, error: 'Challenge name is required' };
    }

    setIsCreating(true);
    try {
      logger.debug(null, '🔍 Creating challenge:', challengeData);
      const response = await axios.post(
        `${API}/community/challenges?athlete_id=${athleteId}`,
        challengeData
      );
      logger.debug(null, '✅ Challenge created:', response.data);
      return { success: true, challenge: response.data };
    } catch (error) {
      logger.error(null, '❌ Error creating challenge:', error);
      return { success: false, error: error.response?.data?.detail || error.message };
    } finally {
      setIsCreating(false);
    }
  }, [athleteId]);

  /**
   * Update an existing challenge
   */
  const updateChallenge = useCallback(async (challengeId, challengeData) => {
    if (!challengeData.name?.trim()) {
      return { success: false, error: 'Challenge name is required' };
    }

    setIsUpdating(true);
    try {
      const response = await axios.put(
        `${API}/community/challenges/${challengeId}?athlete_id=${athleteId}`,
        challengeData
      );
      return { success: true, challenge: response.data };
    } catch (error) {
      logger.error(null, 'Error updating challenge:', error);
      return { success: false, error: error.message };
    } finally {
      setIsUpdating(false);
    }
  }, [athleteId]);

  /**
   * Delete a challenge
   */
  const deleteChallenge = useCallback(async (challengeId) => {
    setIsDeleting(true);
    try {
      await axios.delete(`${API}/community/challenges/${challengeId}?athlete_id=${athleteId}`);
      
      // Update local state
      setChallenges(prev => prev.filter(c => c.id !== challengeId));
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error deleting challenge:', error);
      return { success: false, error: error.message };
    } finally {
      setIsDeleting(false);
    }
  }, [athleteId]);

  /**
   * Join a challenge
   */
  const joinChallenge = useCallback(async (challengeId) => {
    setIsJoining(true);
    try {
      logger.debug(null, '🔍 Joining challenge:', challengeId);
      logger.debug(null, '🔍 AthleteId:', athleteId);
      
      const response = await axios.post(
        `${API}/community/challenges/${challengeId}/join?athlete_id=${athleteId}`
      );
      
      logger.debug(null, '✅ Join response:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error(null, '❌ Error joining challenge:', error);
      logger.error(null, '❌ Error details:', error.response?.data);
      return { success: false, error: error.response?.data?.detail || error.message };
    } finally {
      setIsJoining(false);
    }
  }, [athleteId]);

  /**
   * Leave a challenge
   */
  const leaveChallenge = useCallback(async (challengeId) => {
    setIsLeaving(true);
    try {
      await axios.post(
        `${API}/community/challenges/${challengeId}/leave?athlete_id=${athleteId}`
      );
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error leaving challenge:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLeaving(false);
    }
  }, [athleteId]);

  /**
   * Load challenge details with leaderboard
   */
  const loadChallengeDetails = useCallback(async (challengeId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${API}/community/challenges/${challengeId}?athlete_id=${athleteId}`
      );
      return { success: true, challenge: response.data };
    } catch (error) {
      logger.error(null, 'Error loading challenge details:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  return {
    // State
    challenges,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isJoining,
    isLeaving,
    
    // Actions
    loadChallenges,
    createChallenge,
    updateChallenge,
    deleteChallenge,
    joinChallenge,
    leaveChallenge,
    loadChallengeDetails,
    
    // Setters
    setChallenges
  };
};

export default useChallengeActions;
