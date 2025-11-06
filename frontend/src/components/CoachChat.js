import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, MessageCircle, Bot, User, Plus, Archive, X, Trash2, ArchiveRestore, Mic } from 'lucide-react';
import ChartRenderer from './ChartRenderer';
import VoiceChat from './VoiceChat';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CoachChat = ({ athleteId, scrollDirection = 'none' }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}`);
  const [showArchive, setShowArchive] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [showArchivedList, setShowArchivedList] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  
  // Avatar and coach customization states
  const [userAvatar, setUserAvatar] = useState(null);
  const [coachAvatar, setCoachAvatar] = useState(null);
  const [coachName, setCoachName] = useState('Coach');
  
  // Subscription check states
  const [subscriptionTier, setSubscriptionTier] = useState(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('monthly');
  const [upgradeTarget, setUpgradeTarget] = useState('pro');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const voiceChatRef = useRef(null);

  useEffect(() => {
    // Load conversations list on mount
    loadConversations();
    // Check subscription tier
    checkSubscription();
    // Load athlete profile for avatars
    loadAthleteProfile();
  }, [athleteId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  // Check for action parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'voice' && voiceChatRef.current) {
      // Small delay to ensure component is fully mounted
      setTimeout(async () => {
        try {
          await voiceChatRef.current.startVoiceChat();
          setIsVoiceActive(true);
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch (error) {
          console.error('Error auto-starting voice chat:', error);
        }
      }, 500);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check subscription tier
  const checkSubscription = async () => {
    try {
      console.log('🔍 Checking subscription for athlete:', athleteId);
      const response = await axios.get(`${API}/subscriptions/status/${athleteId}`);
      console.log('📊 Subscription response:', response.data);
      setSubscriptionTier(response.data.tier);
      
      // If free tier, show upgrade dialog immediately
      if (response.data.tier === 'free') {
        console.log('🚫 Free tier detected - showing upgrade dialog');
        setShowUpgradeDialog(true);
      }
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
    }
  };

  const loadAthleteProfile = async () => {
    try {
      const response = await axios.get(`${API}/athlete/${athleteId}`);
      const athlete = response.data;
      setUserAvatar(athlete.profile_picture);
      setCoachAvatar(athlete.coach_avatar);
      setCoachName(athlete.coach_name || t('coachChat.defaultCoachName'));
    } catch (error) {
      console.error('Error loading athlete profile:', error);
    }
  };

  // Handle upgrade to paid plan
  const handleUpgrade = async () => {
    try {
      const response = await axios.post(`${API}/create-checkout-session`, {
        athlete_id: athleteId,
        plan: upgradeTarget,
        billing_cycle: selectedBillingCycle
      });
      
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert(t('coachChat.failedCheckout'));
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await axios.get(`${API}/coach/history/${athleteId}`);
      const history = response.data.reverse(); // Reverse to show oldest first
      setMessages(history.map(msg => [
        { type: 'user', content: msg.message, timestamp: msg.timestamp },
        { type: 'coach', content: msg.response, timestamp: msg.timestamp }
      ]).flat());
      setChatHistory(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };


  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    const userMessage = {
      type: 'user',
      content: newMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/coach/chat`, {
        athlete_id: athleteId,
        message: userMessage.content,
        session_id: sessionId
      });

      // Reload conversations immediately after sending message so it appears in the list
      await loadConversations();

      const coachMessage = {
        type: 'coach',
        content: response.data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, coachMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        type: 'coach',
        content: t('coachChat.connectionTrouble'),
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      loadConversations(); // Reload conversations to update the list
    }
  };

  // Parse message content to extract charts
  const parseMessageContent = (content) => {
    const parts = [];
    const chartRegex = /```chart\s*([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = chartRegex.exec(content)) !== null) {
      // Add text before chart
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index).trim()
        });
      }

      // Try to parse chart JSON
      try {
        const chartData = JSON.parse(match[1].trim());
        parts.push({
          type: 'chart',
          data: chartData
        });
      } catch (e) {
        console.error('Failed to parse chart JSON:', e);
        parts.push({
          type: 'text',
          content: match[0] // Show raw content if parse fails
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex).trim()
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  // Start a new conversation
  const startNewConversation = () => {
    setMessages([]);
    setSessionId(`session_${Date.now()}`);
    inputRef.current?.focus();
  };

  // Load past conversations
  const loadConversations = async () => {
    try {
      const response = await axios.get(`${API}/coach/conversations/${athleteId}?archived=false`);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  // Load a specific conversation
  const loadConversation = async (convSessionId) => {
    try {
      const response = await axios.get(`${API}/coach/conversation/${athleteId}/${convSessionId}`);
      setMessages(response.data.map(msg => ({
        type: 'user',
        content: msg.message,
        timestamp: msg.timestamp,
        isError: false
      })).concat(response.data.map(msg => ({
        type: 'assistant',
        content: msg.response,
        timestamp: msg.timestamp,
        isError: false
      }))).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
      
      setSessionId(convSessionId);
      setShowArchive(false);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // Archive conversation
  const archiveConversation = async (sessionId, e) => {
    e.stopPropagation();
    
    try {
      await axios.put(`${API}/coach/${athleteId}/${sessionId}/archive`, { archived: true });
      await loadConversations();
      await loadArchivedConversations();
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      alert(t('coachChat.failedArchive'));
    }
  };

  // Unarchive conversation
  const unarchiveConversation = async (sessionId, e) => {
    e.stopPropagation();
    
    try {
      await axios.put(`${API}/coach/${athleteId}/${sessionId}/archive`, { archived: false });
      await loadConversations();
      await loadArchivedConversations();
    } catch (error) {
      console.error('Failed to unarchive conversation:', error);
      alert(t('coachChat.failedUnarchive'));
    }
  };

  // Delete conversation
  const deleteConversation = async (sessionId, e, isArchived = false) => {
    e.stopPropagation();
    
    if (!window.confirm(t('coachChat.confirmDeleteConversation'))) {
      return;
    }

    try {
      await axios.delete(`${API}/coach/${athleteId}/${sessionId}`);
      
      // Reload both lists
      await loadConversations();
      await loadArchivedConversations();
      
      // If the deleted conversation is currently active, start a new one
      if (sessionId === sessionId) {
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert(t('coachChat.failedDelete'));
    }
  };

  // Load archived conversations
  const loadArchivedConversations = async () => {
    try {
      const response = await axios.get(`${API}/coach/conversations/${athleteId}?archived=true`);
      setArchivedConversations(response.data);
    } catch (error) {
      console.error('Failed to load archived conversations:', error);
    }
  };

  // Toggle archive sidebar
  const toggleArchive = () => {
    if (!showArchive) {
      loadConversations();
    }
    setShowArchive(!showArchive);
  };

  return (
    <div className="flex flex-col h-screen md:h-full relative">
      {/* Archive Sidebar */}
      {showArchive && (
        <div className="fixed inset-0 z-[60] md:fixed md:inset-y-0 md:left-0 md:w-80">
          {/* Overlay for mobile */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-[60]"
            onClick={() => setShowArchive(false)}
          />
          
          {/* Sidebar - Full viewport height on desktop with dark background */}
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-gradient-to-r from-gray-900 to-gray-800 shadow-2xl z-[60] md:fixed md:inset-y-0 md:h-screen flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{t('coach.pastConversations')}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchive(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-16">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">{t('coach.noPastConversations')}</p>
              ) : (
                conversations.map((conv, index) => (
                  <div
                    key={index}
                    className="relative"
                  >
                    <button
                      onClick={() => loadConversation(conv.session_id)}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-700 border border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium text-white truncate flex-1 pr-8">
                          {conv.preview || t('coachChat.conversationPreview')}
                        </p>
                        <span className="text-xs text-gray-400 ml-2">
                          {new Date(conv.last_message).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                          {conv.message_count} {t('coach.messages')}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => archiveConversation(conv.session_id, e)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-600"
                            title="Archive conversation"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => deleteConversation(conv.session_id, e)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                            title="Delete conversation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Fixed Bottom Navigation */}
            <div className="border-t border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowArchivedList(!showArchivedList);
                  if (!showArchivedList) {
                    loadArchivedConversations();
                  }
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-white">Archived</span>
                </div>
                <span className="text-xs text-gray-400">
                  {archivedConversations.length}
                </span>
              </Button>
            </div>

            {/* Archived Conversations Slideup */}
            {showArchivedList && (
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800 z-10 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Archive className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-white">Archived</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowArchivedList(false)}
                    className="h-8 w-8 p-0 text-white hover:bg-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Archived List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {archivedConversations.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No archived conversations</p>
                  ) : (
                    archivedConversations.map((conv, index) => (
                      <div
                        key={index}
                        className="relative"
                      >
                        <button
                          onClick={() => {
                            loadConversation(conv.session_id);
                            setShowArchivedList(false);
                          }}
                          className="w-full text-left p-3 rounded-lg hover:bg-gray-700 border border-gray-700 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-sm font-medium text-white truncate flex-1 pr-8">
                              {conv.preview || 'Conversation'}
                            </p>
                            <span className="text-xs text-gray-400 ml-2">
                              {new Date(conv.last_message).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                              {conv.message_count} {t('coach.messages')}
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => unarchiveConversation(conv.session_id, e)}
                                className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                                title="Unarchive conversation"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => deleteConversation(conv.session_id, e, true)}
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                title="Delete conversation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header with Archive and New Chat buttons */}
      <div className="hidden md:flex w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 items-center justify-between w-full">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleArchive}
            className="bg-[#374151] text-white hover:bg-[#4B5563] border-0"
            data-testid="archive-btn"
          >
            <Archive className="w-4 h-4 mr-2" />
            {t('coach.archive')}
          </Button>
          <h2 className="text-2xl font-display font-bold text-white">{t('coach.title')}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={startNewConversation}
          className="bg-[#374151] text-white hover:bg-[#4B5563] border-0"
          data-testid="new-chat-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('coach.newChat')}
        </Button>
      </div>

      {/* Mobile Header with icons */}
      <div className="flex md:hidden px-4 py-3 items-center justify-between border-b border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleArchive}
          className="h-9 w-9 p-0 text-white hover:bg-gray-700"
          data-testid="archive-btn-mobile"
        >
          <Archive className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-display font-bold text-white">{t('nav.coach')}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={startNewConversation}
          className="h-9 w-9 p-0 text-white hover:bg-gray-700"
          data-testid="new-chat-btn-mobile"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Chat Messages - Maximized Area with bottom padding for fixed input */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-32 md:pb-40" data-testid="chat-messages">
        <div className="w-full max-w-[1600px] mx-auto space-y-4 py-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-white mx-auto mb-4" />
              <p className="text-white mb-6">{t('coach.startConversation')}</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const contentParts = parseMessageContent(message.content);
              
              return (
                <div
                  key={index}
                  className={`flex items-start space-x-3 message-enter ${
                    message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden border-2 border-gray-300">
                    {message.type === 'user' ? (
                      userAvatar ? (
                        <img src={userAvatar} alt="You" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                      )
                    ) : (
                      coachAvatar ? (
                        <img src={coachAvatar} alt={coachName} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${
                          message.isError ? 'bg-red-100' : 'bg-green-100'
                        }`}>
                          <Bot className={`w-5 h-5 ${message.isError ? 'text-red-600' : 'text-green-600'}`} />
                        </div>
                      )
                    )}
                  </div>
                  <div className={`flex-1 ${
                    message.type === 'user' ? 'text-right' : 'text-left'
                  }`}>
                    {contentParts.map((part, partIndex) => (
                      <div key={partIndex}>
                        {part.type === 'text' && part.content && (
                          <div className={`inline-block p-3 rounded-lg mb-2 max-w-none ${
                            message.type === 'user'
                              ? 'bg-blue-600 text-white'
                              : message.isError
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            {message.type === 'user' ? (
                              <p className="text-sm whitespace-pre-wrap">{part.content}</p>
                            ) : (
                              <div className="text-sm markdown-content">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                  li: ({node, ...props}) => <li className="ml-2" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                                  em: ({node, ...props}) => <em className="italic" {...props} />,
                                  code: ({node, inline, ...props}) => 
                                    inline ? (
                                      <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                                    ) : (
                                      <code className="block bg-gray-200 p-2 rounded text-xs font-mono overflow-x-auto my-2" {...props} />
                                    ),
                                  h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1" {...props} />,
                                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />,
                                  a: ({node, ...props}) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                }}
                                >
                                  {part.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}
                        {part.type === 'chart' && (
                          <div className={message.type === 'user' ? 'text-left' : ''}>
                            <ChartRenderer chartData={part.data} />
                          </div>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          
          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-3 bg-gray-100 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Hidden Voice Chat Component - Mounted but not visible */}
      <div style={{ display: 'none' }}>
        <VoiceChat 
          ref={voiceChatRef}
          backendUrl={BACKEND_URL}
          athleteId={athleteId}
          onError={(error) => console.error('Voice chat error:', error)}
        />
      </div>

      {/* Voice Mode Overlay - Full Screen */}
      {isVoiceActive && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#272727] to-[#4b7d81] z-[70] flex flex-col">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-[#61a59c] to-[#e9f0c7] p-6 shadow-lg">
            <h2 className="text-2xl md:text-3xl font-bold text-white text-center">Voice Mode Active</h2>
          </div>

          {/* Main Content - Centered */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {/* Animated Circle */}
            <div className="relative mb-12">
              {/* Outer pulsing rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 rounded-full bg-[#61a59c] opacity-20 animate-ping"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-56 h-56 rounded-full bg-[#e9f0c7] opacity-30 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              </div>
              
              {/* Main circle */}
              <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-[#61a59c] to-[#e9f0c7] shadow-2xl flex items-center justify-center animate-pulse">
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#e9f0c7] to-[#61a59c] flex items-center justify-center">
                  <Mic className="w-16 h-16 text-white" />
                </div>
              </div>
              
              {/* Radiating circles */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-52 h-52 rounded-full border-4 border-[#61a59c] opacity-50 animate-ping" style={{ animationDuration: '2s' }}></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-60 h-60 rounded-full border-2 border-[#e9f0c7] opacity-30 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }}></div>
              </div>
            </div>

            {/* Status Text */}
            <div className="text-center">
              <p className="text-white text-xl md:text-2xl font-medium mb-2">Listening...</p>
              <p className="text-[#e9f0c7] text-lg">Speak to your AI coach</p>
            </div>
          </div>

          {/* End Voice Mode Button - Fixed at Bottom */}
          <div className="p-6 flex justify-center">
            <Button
              onClick={async () => {
                console.log('End voice mode clicked');
                try {
                  if (voiceChatRef.current) {
                    await voiceChatRef.current.stopVoiceChat();
                  }
                  setIsVoiceActive(false);
                } catch (error) {
                  console.error('Error stopping voice chat:', error);
                  setIsVoiceActive(false);
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full text-lg shadow-2xl flex items-center gap-3"
            >
              <X className="w-6 h-6" />
              End Voice Mode
            </Button>
          </div>
        </div>
      )}

      {/* Message Input - Fixed at Bottom */}
      <div className={`fixed bottom-16 md:bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 to-gray-800 border-t border-gray-700 z-50 transition-transform duration-300 ease-in-out md:translate-y-0 ${
        scrollDirection === 'down' ? 'translate-y-[calc(100%+4rem)] md:translate-y-0' : 'translate-y-0'
      }`}>
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={sendMessage} className="space-y-3">
            {/* Textarea Input */}
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                // Send on Enter, new line on Shift+Enter
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              placeholder={t('coach.placeholder')}
              className="w-full p-3 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[80px] max-h-[200px] placeholder-gray-400"
              disabled={isLoading}
              data-testid="chat-input"
              rows={3}
            />
            
            {/* Button Row */}
            <div className="flex justify-end items-center gap-2">
              {/* Voice Mode Button */}
              <Button
                type="button"
                onClick={async () => {
                  console.log('=== MIC BUTTON CLICKED ===');
                  console.log('voiceChatRef.current:', voiceChatRef.current);
                  console.log('isVoiceActive:', isVoiceActive);
                  
                  if (!voiceChatRef.current) {
                    console.error('❌ VoiceChat ref is null!');
                    alert('Voice chat component not initialized. Please refresh the page.');
                    return;
                  }
                  
                  try {
                    if (isVoiceActive) {
                      console.log('🛑 Stopping voice chat...');
                      await voiceChatRef.current.stopVoiceChat();
                      setIsVoiceActive(false);
                      console.log('✅ Voice chat stopped');
                    } else {
                      console.log('🎤 Starting voice chat...');
                      await voiceChatRef.current.startVoiceChat();
                      setIsVoiceActive(true);
                      console.log('✅ Voice chat started');
                    }
                  } catch (error) {
                    console.error('❌ Error toggling voice chat:', error);
                    alert(`Voice chat error: ${error.message}`);
                    setIsVoiceActive(false);
                  }
                }}
                className={`border-0 ${isVoiceActive ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                title={isVoiceActive ? 'Stop Voice Chat' : 'Start Voice Chat'}
              >
                <Mic className="w-4 h-4" />
              </Button>
              
              {/* Send Button */}
              <Button 
                type="submit" 
                disabled={!newMessage.trim() || isLoading}
                className="text-white btn-transition border-0"
                style={{ backgroundColor: '#00C2A8', color: 'white' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
                data-testid="send-message-btn"
              >
                <Send className="w-4 h-4 mr-2" />
                {isLoading ? t('coach.sending') : t('coach.send')}
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Upgrade Dialog for Free Users */}
      {showUpgradeDialog && subscriptionTier === 'free' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4 border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl border border-gray-700" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>Upgrade Required</h3>
              <p className="text-sm" style={{ color: 'var(--text-med)' }}>
                AI Coach is available for Pro and Premium subscribers
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* Billing Cycle Toggle */}
              <div className="flex items-center justify-center space-x-4 bg-gray-900 rounded-full p-2">
                <button
                  onClick={() => setSelectedBillingCycle('monthly')}
                  className={`px-6 py-2 rounded-full font-medium transition-all ${
                    selectedBillingCycle === 'monthly'
                      ? 'bg-[#00C2A8] text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setSelectedBillingCycle('annual')}
                  className={`px-6 py-2 rounded-full font-medium transition-all flex items-center ${
                    selectedBillingCycle === 'annual'
                      ? 'bg-[#00C2A8] text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Annual
                  <Badge variant="default" className="ml-2 bg-green-500 text-white border-0">
                    Save 17%
                  </Badge>
                </button>
              </div>

              {/* Pricing Display */}
              <div className="p-4 bg-[#00C2A8]/20 border border-[#00C2A8] rounded-lg">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">
                    {selectedBillingCycle === 'monthly' ? '€9.99/mo' : '€99/year'}
                  </p>
                  {selectedBillingCycle === 'annual' && (
                    <p className="text-sm text-green-400 mt-2">
                      Save €20.88 per year!
                    </p>
                  )}
                  <p className="text-sm text-gray-400 mt-2">Pro Plan includes:</p>
                  <ul className="text-sm text-gray-300 mt-2 space-y-1">
                    <li>✓ AI Running Coach</li>
                    <li>✓ Unlimited Chat History</li>
                    <li>✓ Advanced Analytics</li>
                    <li>✓ Training Plans</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white border-0"
                  onClick={() => {
                    setShowUpgradeDialog(false);
                    window.location.href = '/';
                  }}
                >
                  Go Back
                </Button>
                <Button 
                  className="flex-1 bg-[#00C2A8] hover:bg-[#00a890] text-white"
                  onClick={handleUpgrade}
                >
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachChat;
