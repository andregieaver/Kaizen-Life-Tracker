import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, MessageCircle, Bot, User, Plus, Archive, X } from 'lucide-react';
import ChartRenderer from './ChartRenderer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CoachChat = ({ athleteId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}`);
  const [showArchive, setShowArchive] = useState(false);
  const [conversations, setConversations] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
    checkOpenAIKey();
  }, [athleteId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const checkOpenAIKey = async () => {
    try {
      const response = await axios.get(`${API}/integrations/${athleteId}`);
      const integrations = response.data.integrations || [];
      const openaiIntegration = integrations.find(i => i.integration_type === 'openai' && i.is_active);
      setHasOpenAIKey(!!openaiIntegration);
    } catch (error) {
      console.error('Error checking OpenAI key:', error);
      setHasOpenAIKey(false);
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
        message: userMessage.content
      });

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
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const suggestedQuestions = [
    "How am I doing with my training this week?",
    "Should I run today based on my readiness?",
    "What should my next workout be?",
    "Show me my weekly mileage trend"
  ];

  const handleSuggestedQuestion = (question) => {
    setNewMessage(question);
    inputRef.current?.focus();
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

  return (
    <div className="flex flex-col h-full">
      {/* Simple Title Header - Only on Desktop */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <h2 className="text-2xl font-display font-bold text-gray-900">Your AI Running Coach</h2>
      </div>

      {/* Chat Messages - Maximized Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-24 md:pb-6" data-testid="chat-messages">
        <div className="max-w-7xl mx-auto space-y-4 py-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-6">Start a conversation with your AI coach!</p>
              <div className="space-y-2 max-w-2xl mx-auto">
                <p className="text-sm text-gray-600 mb-3">Try asking:</p>
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="block w-full text-left p-3 text-sm bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    data-testid={`suggested-question-${index}`}
                  >
                    "{question}"
                  </button>
                ))}
              </div>
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user'
                      ? 'bg-blue-100'
                      : message.isError
                      ? 'bg-red-100'
                      : 'bg-green-100'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Bot className={`w-4 h-4 ${message.isError ? 'text-red-600' : 'text-green-600'}`} />
                    )}
                  </div>
                  <div className={`flex-1 ${
                    message.type === 'user' ? 'text-right' : 'text-left'
                  }`}>
                    {contentParts.map((part, partIndex) => (
                      <div key={partIndex}>
                        {part.type === 'text' && part.content && (
                          <div className={`inline-block p-3 rounded-lg mb-2 ${
                            message.type === 'user'
                              ? 'bg-blue-600 text-white'
                              : message.isError
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{part.content}</p>
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

      {/* Message Input - Fixed at Bottom on Mobile, aligned with nav bar */}
      <div className="fixed md:relative bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:border-t-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <form onSubmit={sendMessage} className="flex space-x-3">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Ask your coach anything..."
              className="flex-1 input-focus"
              disabled={isLoading}
              data-testid="chat-input"
            />
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 btn-transition"
              data-testid="send-message-btn"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CoachChat;
