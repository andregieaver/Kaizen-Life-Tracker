import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { findMentionTrigger, insertMention, formatMentions } from '../../utils/mentionUtils';
import { logger } from '../../utils/logger';

import { getApiUrl } from '../../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook for handling @mentions in text inputs
 * Supports searching athletes, inserting mentions, and formatting
 */
const useMentions = () => {
  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionSearchText, setMentionSearchText] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [activeMentionContext, setActiveMentionContext] = useState(null); // Track which input is active

  /**
   * Search for athletes by name
   */
  const searchAthletes = useCallback(async (searchText) => {
    if (!searchText || searchText.length < 1) {
      setMentionResults([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/community/athletes/search?q=${searchText}`);
      setMentionResults(response.data.athletes || []);
    } catch (error) {
      logger.error(null, 'Error searching athletes:', error);
      setMentionResults([]);
    }
  }, []);

  /**
   * Handle text change and detect @mention triggers
   */
  const handleTextChange = useCallback((text, cursorPosition, textareaElement, context = null) => {
    // Check for mention trigger
    const mentionTrigger = findMentionTrigger(text, cursorPosition);
    
    if (mentionTrigger.triggered) {
      setShowMentionDropdown(true);
      setMentionSearchText(mentionTrigger.searchText);
      setActiveMentionContext(context);
      searchAthletes(mentionTrigger.searchText);
      
      // Calculate dropdown position
      if (textareaElement) {
        const rect = textareaElement.getBoundingClientRect();
        setMentionPosition({
          top: rect.bottom,
          left: rect.left
        });
      }
    } else {
      setShowMentionDropdown(false);
      setMentionResults([]);
      setActiveMentionContext(null);
    }
  }, [searchAthletes]);

  /**
   * Select a mention from dropdown and insert into text
   */
  const selectMention = useCallback((currentText, cursorPosition, athlete, textareaRef) => {
    const result = insertMention(currentText, cursorPosition, athlete.id, athlete.name);
    
    setShowMentionDropdown(false);
    setMentionResults([]);
    setActiveMentionContext(null);
    
    // Set cursor position after mention
    if (textareaRef && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current.selectionStart = result.cursorPosition;
        textareaRef.current.selectionEnd = result.cursorPosition;
        textareaRef.current.focus();
      }, 0);
    }
    
    return result.text;
  }, []);

  /**
   * Close mention dropdown
   */
  const closeMentionDropdown = useCallback(() => {
    setShowMentionDropdown(false);
    setMentionResults([]);
    setMentionSearchText('');
    setActiveMentionContext(null);
  }, []);

  /**
   * Render mention dropdown component
   */
  const MentionDropdown = useCallback(({ onSelect, currentContext }) => {
    if (!showMentionDropdown || activeMentionContext !== currentContext) {
      return null;
    }

    return (
      <div
        className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
        style={{
          top: mentionPosition.top,
          left: mentionPosition.left,
          minWidth: '200px'
        }}
      >
        {mentionResults.length > 0 ? (
          mentionResults.map((athlete) => (
            <div
              key={athlete.id}
              onClick={() => onSelect(athlete)}
              className="px-4 py-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2"
            >
              {athlete.profile_image && (
                <img
                  src={athlete.profile_image}
                  alt={athlete.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              )}
              <div>
                <div className="text-sm font-medium text-white">{athlete.name}</div>
                {athlete.username && (
                  <div className="text-xs text-gray-400">@{athlete.username}</div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-2 text-sm text-gray-400">
            {mentionSearchText ? 'No athletes found' : 'Start typing to search...'}
          </div>
        )}
      </div>
    );
  }, [showMentionDropdown, mentionResults, mentionPosition, mentionSearchText, activeMentionContext]);

  return {
    // State
    showMentionDropdown,
    mentionResults,
    mentionSearchText,
    mentionPosition,
    activeMentionContext,
    
    // Functions
    searchAthletes,
    handleTextChange,
    selectMention,
    closeMentionDropdown,
    formatMentions, // Re-export utility function
    
    // Component
    MentionDropdown
  };
};

export default useMentions;
