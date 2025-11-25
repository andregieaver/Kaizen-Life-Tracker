import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, Shield, User, Plus, X, Mic, MessageCircle, Menu, ArrowLeft } from 'lucide-react';
import VoiceChat from './VoiceChat';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ManagementAgentChat = ({ athleteId, scrollDirection = 'none' }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => `mgmt_session_${Date.now()}`);
  const [conversations, setConversations] = useState([]);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const voiceChatRef = useRef(null);

  useEffect(() => {
    // Load conversations list on mount
    loadConversations();
  }, [athleteId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const response = await axios.get(`${API}/management-agent/conversations/${athleteId}`);
      setConversations(response.data);
    } catch (error) {
      logger.error(null, 'Error loading conversations:', error);
    }
  };

  const loadConversation = async (convSessionId) => {
    try {
      setSessionId(convSessionId);
      const response = await axios.get(`${API}/management-agent/history/${athleteId}`);
      const history = response.data.reverse(); // Reverse to show oldest first
      setMessages(history
        .filter(msg => msg.session_id === convSessionId)
        .map(msg => [
          { type: 'user', content: msg.message, timestamp: msg.timestamp },
          { type: 'agent', content: msg.response, timestamp: msg.timestamp }
        ]).flat());
      setShowSidebar(false); // Close sidebar on mobile after selecting conversation
    } catch (error) {
      logger.error(null, 'Error loading conversation:', error);
    }
  };

  const startNewConversation = () => {
    setSessionId(`mgmt_session_${Date.now()}`);
    setMessages([]);
    setShowSidebar(false); // Close sidebar on mobile
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
      const response = await axios.post(`${API}/management-agent/chat`, {
        athlete_id: athleteId,
        message: userMessage.content,
        session_id: sessionId
      });

      // Reload conversations immediately after sending message
      await loadConversations();

      const agentMessage = {
        type: 'agent',
        content: response.data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      logger.error(null, 'Error sending message:', error);
      const errorMessage = {
        type: 'agent',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      loadConversations();
    }
  };

  const toggleVoiceMode = () => {
    setIsVoiceActive(!isVoiceActive);
  };

  return (
    <div className="flex h-screen bg-[#0B1220] relative">
      {/* Sidebar - Conversations List */}
      <div className={`
        ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative
        fixed inset-y-0 left-0 z-50
        w-80 border-r border-gray-800 flex flex-col bg-[#0B1220]
        transition-transform duration-300 ease-in-out
      `}>
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Management Agent</h2>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={() => setShowSidebar(false)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Button 
            onClick={startNewConversation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Conversation
          </Button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {conversations.map((conv) => (
            <div
              key={conv.session_id}
              onClick={() => loadConversation(conv.session_id)}
              className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                conv.session_id === sessionId ? 'bg-gray-800/70' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{conv.preview}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(conv.last_message).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2 text-xs">
                  {conv.message_count}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Menu button for mobile */}
              <button
                onClick={() => setShowSidebar(true)}
                className="md:hidden text-white hover:text-gray-300"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Management Agent</h3>
                <p className="text-sm text-gray-300 hidden sm:block">Super Admin Assistant</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={toggleVoiceMode}
                variant={isVoiceActive ? "default" : "outline"}
                size="sm"
                className={`${isVoiceActive ? "bg-red-600 hover:bg-red-700" : ""}`}
              >
                <Mic className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{isVoiceActive ? 'End Voice' : 'Voice Mode'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        {!isVoiceActive ? (
          <>
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-10 sm:mt-20 px-4">
                  <Shield className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">Welcome, Super Admin</h3>
                  <p className="text-xs sm:text-sm">
                    I'm your Management Agent with full system access.
                    <br className="hidden sm:block" />
                    Ask me anything about users, data, community content, or analytics.
                  </p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-full sm:max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.type === 'user' ? 'bg-gray-700' : 'bg-blue-600'
                    }`}>
                      {message.type === 'user' ? (
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      ) : (
                        <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      )}
                    </div>
                    <div className={`rounded-lg p-3 sm:p-4 ${
                      message.type === 'user' 
                        ? 'bg-gray-700 text-white' 
                        : message.isError
                        ? 'bg-red-900/30 text-red-200 border border-red-800'
                        : 'bg-gray-800 text-gray-100'
                    }`}>
                      <div className="prose prose-invert prose-sm max-w-none text-sm sm:text-base">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-3xl">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div className="rounded-lg p-4 bg-gray-800">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-800 p-3 sm:p-4 bg-[#0B1220]">
              <form onSubmit={sendMessage} className="flex space-x-2">
                <Input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500 text-sm sm:text-base"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || !newMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <VoiceChat
              ref={voiceChatRef}
              athleteId={athleteId}
              apiBasePath="/management-agent/voice"
              onClose={() => setIsVoiceActive(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagementAgentChat;
