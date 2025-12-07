import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();
const API = `${BACKEND_URL}/api`;

/**
 * Custom hook for athlete profile operations
 * Handles loading profiles, following/unfollowing, and searching athletes
 */
const useAthleteProfile = (athleteId) => {
  const [profile, setProfile] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingAthletes, setIsLoadingAthletes] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  /**
   * Load an athlete's profile
   */
  const loadProfile = useCallback(async (targetAthleteId) => {
    setIsLoadingProfile(true);
    try {
      const response = await axios.get(
        `${API}/community/profile/${targetAthleteId}?viewer_athlete_id=${athleteId}`
      );
      const profileData = response.data;
      setProfile(profileData);
      return { success: true, profile: profileData };
    } catch (error) {
      logger.error(null, 'Error loading athlete profile:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoadingProfile(false);
    }
  }, [athleteId]);

  /**
   * Toggle follow/unfollow for a specific athlete
   */
  const toggleFollow = useCallback(async (targetAthleteId) => {
    setIsFollowing(true);
    try {
      const response = await axios.post(
        `${API}/community/follow/${targetAthleteId}?athlete_id=${athleteId}`
      );
      
      // Update profile state if it's the same athlete
      if (profile && profile.id === targetAthleteId) {
        setProfile(prev => ({
          ...prev,
          is_following: response.data.following,
          follower_count: response.data.follower_count
        }));
      }
      
      return { 
        success: true, 
        following: response.data.following,
        follower_count: response.data.follower_count 
      };
    } catch (error) {
      logger.error(null, 'Error toggling follow:', error);
      return { success: false, error: error.message };
    } finally {
      setIsFollowing(false);
    }
  }, [athleteId, profile]);

  /**
   * Search for athletes
   */
  const searchAthletes = useCallback(async (searchQuery = '', limit = 50) => {
    setIsLoadingAthletes(true);
    try {
      const response = await axios.get(
        `${API}/athletes?athlete_id=${athleteId}&limit=${limit}${
          searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''
        }`
      );
      const athletesList = response.data.athletes || [];
      setAthletes(athletesList);
      return { success: true, athletes: athletesList };
    } catch (error) {
      logger.error(null, 'Error searching athletes:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoadingAthletes(false);
    }
  }, [athleteId]);

  /**
   * Load athlete's posts
   */
  const loadAthletePosts = useCallback(async (targetAthleteId, limit = 20) => {
    try {
      const response = await axios.get(
        `${API}/community/user/${targetAthleteId}/posts?viewer_athlete_id=${athleteId}&limit=${limit}`
      );
      return { success: true, posts: response.data.posts || [] };
    } catch (error) {
      logger.error(null, 'Error loading athlete posts:', error);
      return { success: false, error: error.message };
    }
  }, [athleteId]);

  /**
   * Get follower/following counts
   */
  const loadFollowCounts = useCallback(async (targetAthleteId) => {
    try {
      const response = await axios.get(
        `${API}/community/profile/${targetAthleteId}/follow-counts`
      );
      return { 
        success: true, 
        follower_count: response.data.follower_count,
        following_count: response.data.following_count
      };
    } catch (error) {
      logger.error(null, 'Error loading follow counts:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Clear profile state
   */
  const clearProfile = useCallback(() => {
    setProfile(null);
  }, []);

  /**
   * Clear athletes list
   */
  const clearAthletes = useCallback(() => {
    setAthletes([]);
  }, []);

  return {
    // State
    profile,
    athletes,
    isLoadingProfile,
    isLoadingAthletes,
    isFollowing,
    
    // Actions
    loadProfile,
    toggleFollow,
    searchAthletes,
    loadAthletePosts,
    loadFollowCounts,
    clearProfile,
    clearAthletes,
    
    // Setters
    setProfile,
    setAthletes
  };
};

export default useAthleteProfile;
