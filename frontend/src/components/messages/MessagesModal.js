import React, { useState, useEffect } from 'react';
import { X, Search, Send, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import OnlineStatusIndicator from '../OnlineStatusIndicator';
import axios from 'axios';
import { logger } from '../../utils/logger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MessagesModal = ({ athleteId, onClose, initialConversationId = null, initialUserId = null }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(() => {
      if (selectedConversation) {
        loadMessages(selectedConversation.id, true); // Silent reload
      } else {
        loadConversations(true); // Silent reload
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [selectedConversation]);
  
  // Load initial conversation if provided
  useEffect(() => {
    if (initialConversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === initialConversationId);
      if (conv) {
        handleSelectConversation(conv);
      }
    }
  }, [initialConversationId, conversations]);
  
  // Start conversation with specific user if provided
  useEffect(() => {
    if (initialUserId && athleteId) {
      startConversationWithUser(initialUserId);
    }
  }, [initialUserId, athleteId]);
  
  const startConversationWithUser = async (userId) => {
    try {
      // Check if conversation already exists
      const existingConv = conversations.find(c => c.other_user.id === userId);
      if (existingConv) {
        handleSelectConversation(existingConv);
        return;
      }
      
      // Start new conversation
      const response = await axios.post(`${API}/messages/conversation/start?sender_id=${athleteId}&receiver_id=${userId}`);
      
      // Reload conversations to get the new one
      await loadConversations();
      
      // Select the conversation
      const newConvs = await axios.get(`${API}/messages/conversations?athlete_id=${athleteId}`);
      const newConv = newConvs.data.conversations.find(c => c.other_user.id === userId);
      if (newConv) {
        handleSelectConversation(newConv);
      }
    } catch (error) {
      logger.error(null, 'Error starting conversation:', error);
    }
  };
  
  const loadConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await axios.get(`${API}/messages/conversations?athlete_id=${athleteId}`);
      setConversations(response.data.conversations);
    } catch (error) {
      logger.error(null, 'Error loading conversations:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  
  const loadMessages = async (conversationId, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await axios.get(`${API}/messages/conversation/${conversationId}?athlete_id=${athleteId}`);
      setMessages(response.data.messages);
      
      // Update conversation unread count to 0
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ));
    } catch (error) {
      logger.error(null, 'Error loading messages:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
  };
  
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;
    
    try {
      setSending(true);
      await axios.post(`${API}/messages/send`, {
        sender_id: athleteId,
        receiver_id: selectedConversation.other_user.id,
        content: messageText
      });
      
      setMessageText('');
      // Reload messages
      await loadMessages(selectedConversation.id);
      await loadConversations(true); // Update conversation list
    } catch (error) {
      logger.error(null, 'Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleBack = () => {
    setSelectedConversation(null);
    setMessages([]);
  };
  
  const filteredConversations = conversations.filter(c =>
    c.other_user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-2 md:p-4" onClick={onClose}>
      <div 
        className="rounded-none md:rounded-3xl w-full h-full md:max-w-5xl md:h-[80vh] flex flex-col overflow-hidden"
        style={{ background: 'var(--grad-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Messages</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Conversation List - Hide on mobile when conversation selected */}
          <div className={`w-full md:w-1/3 border-r border-gray-700 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            {/* Search */}
            <div className="p-3 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-3 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C2A8]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            {/* Conversations */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading && conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Loading...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  {searchQuery ? 'No conversations found' : 'No messages yet'}
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-700/30 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-gray-700/50' : ''
                    }`}
                    onClick={() => handleSelectConversation(conv)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        {conv.other_user.profile_picture ? (
                          <img
                            src={conv.other_user.profile_picture}
                            alt={conv.other_user.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-[#00C2A8] rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">
                              {conv.other_user.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <OnlineStatusIndicator last_active_at={conv.other_user.last_active_at} size="small" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-white font-semibold truncate">{conv.other_user.name}</p>
                          <span className="text-xs text-gray-400">{formatTime(conv.last_message_at)}</span>
                        </div>
                        <p className="text-sm text-gray-400 truncate">{conv.last_message_preview || 'No messages yet'}</p>
                      </div>
                      
                      {conv.unread_count > 0 && (
                        <div className="w-6 h-6 bg-[#00C2A8] rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{conv.unread_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Chat Thread - Show when conversation selected */}
          <div className={`flex-1 flex flex-col ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-700 flex items-center space-x-3">
                  <button
                    onClick={handleBack}
                    className="md:hidden p-2 hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  
                  <div className="relative">
                    {selectedConversation.other_user.profile_picture ? (
                      <img
                        src={selectedConversation.other_user.profile_picture}
                        alt={selectedConversation.other_user.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[#00C2A8] rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">
                          {selectedConversation.other_user.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <OnlineStatusIndicator last_active_at={selectedConversation.other_user.last_active_at} size="small" />
                  </div>
                  
                  <div>
                    <p className="text-white font-semibold">{selectedConversation.other_user.name}</p>
                  </div>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-8">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === athleteId ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-2xl ${
                            msg.sender_id === athleteId
                              ? 'bg-[#00C2A8] text-white'
                              : 'bg-gray-700 text-white'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Message Input */}
                <div className="p-4 border-t border-gray-700">
                  <div className="flex items-center space-x-2">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 p-3 bg-gray-800 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#00C2A8]"
                      rows="1"
                      disabled={sending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || sending}
                      className="p-3 bg-[#00C2A8] hover:bg-[#00a890] text-white rounded-lg disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <p>Select a conversation to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesModal;
