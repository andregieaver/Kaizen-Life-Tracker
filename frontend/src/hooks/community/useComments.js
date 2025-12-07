import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for comment operations
 * Handles adding, deleting, and loading comments
 */
const useComments = (athleteId) => {
  const [comments, setComments] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Load comments for a post
   */
  const loadComments = useCallback(async (postId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/community/posts/${postId}/comments`);
      const loadedComments = response.data.comments || [];
      
      setComments(prev => ({
        ...prev,
        [postId]: loadedComments
      }));
      
      return { success: true, comments: loadedComments };
    } catch (error) {
      logger.error(null, 'Error loading comments:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Add a comment to a post
   */
  const addComment = useCallback(async (postId, content) => {
    if (!content.trim()) {
      return { success: false, error: 'Comment cannot be empty' };
    }

    setIsAdding(true);
    try {
      const response = await axios.post(
        `${API}/community/posts/${postId}/comments?athlete_id=${athleteId}`,
        { content }
      );
      
      const newComment = response.data.comment;
      
      // Update local comments state
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));
      
      return { success: true, comment: newComment };
    } catch (error) {
      logger.error(null, 'Error adding comment:', error);
      return { success: false, error: error.message };
    } finally {
      setIsAdding(false);
    }
  }, [athleteId]);

  /**
   * Delete a comment
   */
  const deleteComment = useCallback(async (postId, commentId) => {
    setIsDeleting(true);
    try {
      await axios.delete(
        `${API}/community/comments/${commentId}?athlete_id=${athleteId}`
      );
      
      // Update local comments state
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
      }));
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error deleting comment:', error);
      return { success: false, error: error.message };
    } finally {
      setIsDeleting(false);
    }
  }, [athleteId]);

  /**
   * Get comments for a specific post
   */
  const getPostComments = useCallback((postId) => {
    return comments[postId] || [];
  }, [comments]);

  /**
   * Clear comments for a specific post
   */
  const clearPostComments = useCallback((postId) => {
    setComments(prev => {
      const newComments = { ...prev };
      delete newComments[postId];
      return newComments;
    });
  }, []);

  return {
    // State
    comments,
    isLoading,
    isAdding,
    isDeleting,
    
    // Actions
    loadComments,
    addComment,
    deleteComment,
    getPostComments,
    clearPostComments
  };
};

export default useComments;
