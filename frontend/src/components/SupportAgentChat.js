import React, { useState, useEffect } from 'react';
import { Headphones, Send, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SupportAgentChat = ({ athleteId, initialMode = 'text' }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const navigate = useNavigate();
  const inputRef = React.useRef(null);
  const inputContainerRef = React.useRef(null);

  useEffect(() => {
    // Generate or retrieve session ID from localStorage
    const storedSessionId = localStorage.getItem('support_agent_session_id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      // Load conversation history for this session
      loadConversationHistory(storedSessionId);
    } else {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem('support_agent_session_id', newSessionId);
    }
  }, []);

  useEffect(() => {
    // Handle keyboard visibility on mobile
    const handleFocus = () => {
      setTimeout(() => {
        inputContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 300); // Wait for keyboard animation
    };

    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener('focus', handleFocus);
      return () => inputElement.removeEventListener('focus', handleFocus);
    }
  }, []);

  const loadConversationHistory = async (sessionId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/support-agent/history/${athleteId}?limit=20`);
      const history = response.data;
      
      // Convert to message format
      const formattedMessages = [];
      history.reverse().forEach(msg => {
        formattedMessages.push({
          role: 'user',
          content: msg.message,
          timestamp: msg.timestamp
        });
        formattedMessages.push({
          role: 'assistant',
          content: msg.response,
          timestamp: msg.timestamp
        });
      });
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message to display
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);

    setIsSending(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/support-agent/chat`, {
        athlete_id: athleteId,
        session_id: sessionId,
        message: userMessage
      });

      const assistantMessage = response.data.response;

      // Add assistant message to display
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString()
      }]);

      // Check for navigation commands in the response
      const navigateMatch = assistantMessage.match(/NAVIGATE:(\/[^\s]+)/);
      if (navigateMatch) {
        const path = navigateMatch[1];
        setTimeout(() => {
          navigate(path);
        }, 1500); // Give user time to read the message
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0B1220] min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#1a4d6d] to-[#32D3FF] flex items-center justify-center">
            <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Support Agent</h2>
            <p className="text-xs sm:text-sm text-gray-400">Your Personal AI Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 pb-32 md:pb-24">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1a4d6d] to-[#32D3FF] flex items-center justify-center mb-4">
              <Headphones className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Welcome to Support Agent!</h3>
            <p className="text-gray-400 max-w-md">
              I'm your personal AI assistant with access to your health data, 
              training logs, and community activity. Ask me anything!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-[#1a4d6d] to-[#32D3FF] text-white'
                    : msg.isError
                    ? 'bg-red-900/20 text-red-400 border border-red-800'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <Loader className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Message Input - Fixed at Bottom (outside flex container like CoachChat) */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 to-gray-800 border-t border-gray-700 z-50 pb-24 md:pb-0">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-end space-x-2">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your health, workouts, or data..."
              className="flex-1 bg-gray-800 text-white rounded-2xl px-3 sm:px-4 py-2 sm:py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm sm:text-base min-h-[60px] max-h-[120px]"
              rows="2"
              disabled={isSending}
              autoComplete="off"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center
                       hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportAgentChat;
