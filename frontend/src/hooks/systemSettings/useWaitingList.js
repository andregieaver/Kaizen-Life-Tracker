import { useState, useCallback } from 'react';
import axios from 'axios';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for managing waiting list entries
 * Handles loading, filtering, and exporting waiting list data
 */
const useWaitingList = (athleteId) => {
  const [waitingListEntries, setWaitingListEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'contacted', 'converted'

  /**
   * Load waiting list entries
   */
  const loadWaitingList = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/waiting-list?athlete_id=${athleteId}`);
      const entries = response.data.entries || [];
      setWaitingListEntries(entries);
      return { success: true, entries };
    } catch (error) {
      logger.error(null, 'Error loading waiting list:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  /**
   * Get filtered entries based on current filter
   */
  const getFilteredEntries = useCallback(() => {
    if (filter === 'all') {
      return waitingListEntries;
    }
    return waitingListEntries.filter(entry => entry.status === filter);
  }, [waitingListEntries, filter]);

  /**
   * Update entry status
   */
  const updateEntryStatus = useCallback(async (entryId, newStatus) => {
    try {
      await axios.put(`${API}/waiting-list/${entryId}?athlete_id=${athleteId}`, {
        status: newStatus
      });
      
      // Update local state
      setWaitingListEntries(prev =>
        prev.map(entry =>
          entry.id === entryId ? { ...entry, status: newStatus } : entry
        )
      );
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error updating entry status:', error);
      return { success: false, error: error.message };
    }
  }, [athleteId]);

  /**
   * Delete entry
   */
  const deleteEntry = useCallback(async (entryId) => {
    try {
      await axios.delete(`${API}/waiting-list/${entryId}?athlete_id=${athleteId}`);
      
      // Update local state
      setWaitingListEntries(prev => prev.filter(entry => entry.id !== entryId));
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error deleting entry:', error);
      return { success: false, error: error.message };
    }
  }, [athleteId]);

  /**
   * Export waiting list to CSV
   */
  const exportToCSV = useCallback(() => {
    const entries = getFilteredEntries();
    
    if (entries.length === 0) {
      return { success: false, error: 'No entries to export' };
    }
    
    try {
      // Create CSV content
      const headers = ['Email', 'Name', 'Status', 'Joined Date'];
      const csvContent = [
        headers.join(','),
        ...entries.map(entry => [
          entry.email,
          entry.name || 'N/A',
          entry.status || 'pending',
          new Date(entry.created_at).toLocaleDateString()
        ].join(','))
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `waiting-list-${filter}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return { success: true };
    } catch (error) {
      logger.error(null, 'Error exporting to CSV:', error);
      return { success: false, error: error.message };
    }
  }, [getFilteredEntries, filter]);

  /**
   * Change filter
   */
  const changeFilter = useCallback((newFilter) => {
    setFilter(newFilter);
  }, []);

  return {
    // State
    waitingListEntries,
    isLoading,
    filter,
    
    // Computed
    filteredEntries: getFilteredEntries(),
    totalCount: waitingListEntries.length,
    filteredCount: getFilteredEntries().length,
    
    // Actions
    loadWaitingList,
    updateEntryStatus,
    deleteEntry,
    exportToCSV,
    changeFilter,
    
    // Setters
    setWaitingListEntries
  };
};

export default useWaitingList;
