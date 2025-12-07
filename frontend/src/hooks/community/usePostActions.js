import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for post CRUD operations
 * Handles creating, editing, deleting, liking, and sharing posts
 */
const usePostActions = (athleteId) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  /**
   * Create a new post
   */
  const createPost = useCallback(async (postData) => {
    setIsCreating(true);
    try {
      const response = await axios.post(
        `${API}/community/posts?athlete_id=${athleteId}`,
        postData
      );
      return { success: true, post: response.data };
    } catch (error) {
      logger.error(null, 'Error creating post:', error);
      return { success: false, error: error.message };
    } finally {
      setIsCreating(false);
    }
  }, [athleteId]);

  /**
   * Update an existing post
   */
  const updatePost = useCallback(async (postId, postData) => {
    setIsUpdating(true);
    try {
      const response = await axios.put(
        `${API}/community/posts/${postId}?athlete_id=${athleteId}`,
        postData
      );
      return { success: true, post: response.data };
    } catch (error) {
      logger.error(null, 'Error updating post:', error);
      return { success: false, error: error.message };
    } finally {
      setIsUpdating(false);
    }
  }, [athleteId]);

  /**
   * Delete a post
   */
  const deletePost = useCallback(async (postId) => {
    setIsDeleting(true);
    try {
      await axios.delete(`${API}/community/posts/${postId}?athlete_id=${athleteId}`);
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error deleting post:', error);
      return { success: false, error: error.message };
    } finally {
      setIsDeleting(false);
    }
  }, [athleteId]);

  /**
   * Toggle like on a post
   */
  const toggleLike = useCallback(async (postId) => {
    setIsLiking(true);
    try {
      const response = await axios.post(
        `${API}/community/posts/${postId}/like?athlete_id=${athleteId}`
      );
      return { 
        success: true, 
        liked: response.data.liked,
        likes_count: response.data.likes_count 
      };
    } catch (error) {
      logger.error(null, 'Error toggling like:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLiking(false);
    }
  }, [athleteId]);

  /**
   * Share a post with optional commentary
   */
  const sharePost = useCallback(async (postId, commentary = '') => {
    setIsSharing(true);
    try {
      const response = await axios.post(
        `${API}/community/posts/${postId}/share?athlete_id=${athleteId}`,
        { content: commentary }
      );
      return { 
        success: true, 
        shares_count: response.data.shares_count,
        shared_post: response.data.shared_post 
      };
    } catch (error) {
      logger.error(null, 'Error sharing post:', error);
      return { success: false, error: error.message };
    } finally {
      setIsSharing(false);
    }
  }, [athleteId]);

  /**
   * Load posts feed
   */
  const loadPosts = useCallback(async (type = 'feed', limit = 50, skip = 0) => {
    try {
      let endpoint;
      if (type === 'feed') {
        endpoint = `${API}/community/feed/${athleteId}?limit=${limit}&skip=${skip}`;
      } else if (type === 'following') {
        endpoint = `${API}/community/following-feed/${athleteId}?limit=${limit}&skip=${skip}`;
      } else {
        throw new Error('Invalid feed type');
      }

      const response = await axios.get(endpoint);
      return { success: true, posts: response.data.posts || [] };
    } catch (error) {
      logger.error(null, 'Error loading posts:', error);
      return { success: false, error: error.message };
    }
  }, [athleteId]);

  return {
    // State
    isCreating,
    isUpdating,
    isDeleting,
    isLiking,
    isSharing,
    
    // Actions
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    sharePost,
    loadPosts
  };
};

export default usePostActions;
