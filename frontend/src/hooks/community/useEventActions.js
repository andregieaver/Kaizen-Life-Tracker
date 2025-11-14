import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Custom hook for event CRUD operations and RSVP
 * Handles creating, editing, deleting events and managing RSVPs
 */
const useEventActions = (athleteId) => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRSVPing, setIsRSVPing] = useState(false);

  /**
   * Load events
   */
  const loadEvents = useCallback(async (limit = 10, groupId = null) => {
    setIsLoading(true);
    try {
      let url = `${API}/community/events?athlete_id=${athleteId}&limit=${limit}&exclude_images=false`;
      if (groupId) {
        url += `&group_id=${groupId}`;
      }
      
      const response = await axios.get(url);
      const loadedEvents = response.data.events || [];
      setEvents(loadedEvents);
      return { success: true, events: loadedEvents };
    } catch (error) {
      logger.error(null, 'Error loading events:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Create a new event
   */
  const createEvent = useCallback(async (eventData) => {
    if (!eventData.name?.trim()) {
      return { success: false, error: 'Event name is required' };
    }

    setIsCreating(true);
    try {
      const response = await axios.post(
        `${API}/community/events?athlete_id=${athleteId}`,
        eventData
      );
      return { success: true, event: response.data };
    } catch (error) {
      logger.error(null, 'Error creating event:', error);
      return { success: false, error: error.message };
    } finally {
      setIsCreating(false);
    }
  }, [athleteId]);

  /**
   * Update an existing event
   */
  const updateEvent = useCallback(async (eventId, eventData) => {
    if (!eventData.name?.trim()) {
      return { success: false, error: 'Event name is required' };
    }

    setIsUpdating(true);
    try {
      const response = await axios.put(
        `${API}/community/events/${eventId}?athlete_id=${athleteId}`,
        eventData
      );
      return { success: true, event: response.data };
    } catch (error) {
      logger.error(null, 'Error updating event:', error);
      return { success: false, error: error.message };
    } finally {
      setIsUpdating(false);
    }
  }, [athleteId]);

  /**
   * Delete an event
   */
  const deleteEvent = useCallback(async (eventId) => {
    setIsDeleting(true);
    try {
      await axios.delete(`${API}/community/events/${eventId}?athlete_id=${athleteId}`);
      
      // Update local state
      setEvents(prev => prev.filter(e => e.id !== eventId));
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error deleting event:', error);
      return { success: false, error: error.message };
    } finally {
      setIsDeleting(false);
    }
  }, [athleteId]);

  /**
   * RSVP to an event
   * @param {string} eventId - Event ID
   * @param {string} status - 'going' or 'interested'
   */
  const handleRSVP = useCallback(async (eventId, status) => {
    setIsRSVPing(true);
    try {
      const response = await axios.post(
        `${API}/community/events/${eventId}/rsvp?athlete_id=${athleteId}`,
        { status }
      );
      
      return { 
        success: true, 
        status: response.data.status,
        going_count: response.data.going_count,
        interested_count: response.data.interested_count
      };
    } catch (error) {
      logger.error(null, 'Error updating RSVP:', error);
      return { success: false, error: error.message };
    } finally {
      setIsRSVPing(false);
    }
  }, [athleteId]);

  /**
   * Load event details with attendees
   */
  const loadEventDetails = useCallback(async (eventId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${API}/community/events/${eventId}?athlete_id=${athleteId}&exclude_images=false`
      );
      return { success: true, event: response.data };
    } catch (error) {
      logger.error(null, 'Error loading event details:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  return {
    // State
    events,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isRSVPing,
    
    // Actions
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    handleRSVP,
    loadEventDetails,
    
    // Setters
    setEvents
  };
};

export default useEventActions;
