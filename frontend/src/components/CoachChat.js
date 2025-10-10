import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, MessageCircle, Bot, User, Plus, Archive, X } from 'lucide-react';
import ChartRenderer from './ChartRenderer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CoachChat = ({ athleteId, scrollDirection = 'up' }) => {
  const { t } = useTranslation();
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
        message: userMessage.content,
        session_id: sessionId
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
    t('coach.suggestedQuestions.q1'),
    t('coach.suggestedQuestions.q2'),
    t('coach.suggestedQuestions.q3'),
    t('coach.suggestedQuestions.q4')
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

  // Start a new conversation
  const startNewConversation = () => {
    setMessages([]);
    setSessionId(`session_${Date.now()}`);
    inputRef.current?.focus();
  };

  // Load past conversations
  const loadConversations = async () => {
    try {
      const response = await axios.get(`${API}/coach/conversations/${athleteId}`);
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

  // Toggle archive sidebar
  const toggleArchive = () => {
    if (!showArchive) {
      loadConversations();
    }
    setShowArchive(!showArchive);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Archive Sidebar */}
      {showArchive && (
        <div className="fixed inset-0 z-50 md:relative md:inset-auto">
          {/* Overlay for mobile */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 md:hidden"
            onClick={() => setShowArchive(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 overflow-y-auto md:absolute md:left-0 md:top-0 md:bottom-0">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">{t('coach.pastConversations')}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchive(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">{t('coach.noPastConversations')}</p>
              ) : (
                conversations.map((conv, index) => (
                  <button
                    key={index}
                    onClick={() => loadConversation(conv.session_id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate flex-1">
                        {conv.preview || 'Conversation'}
                      </p>
                      <span className="text-xs text-gray-500 ml-2">
                        {new Date(conv.last_message).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {conv.message_count} {t('coach.messages')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header with Archive and New Chat buttons */}
      <div className="hidden md:flex w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 items-center justify-between w-full">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleArchive}
            className="btn-transition"
            data-testid="archive-btn"
          >
            <Archive className="w-4 h-4 mr-2" />
            {t('coach.archive')}
          </Button>
          <h2 className="text-2xl font-display font-bold text-gray-900">{t('coach.title')}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={startNewConversation}
          className="btn-transition"
          data-testid="new-chat-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('coach.newChat')}
        </Button>
      </div>

      {/* Mobile Header with icons */}
      <div className="flex md:hidden px-4 py-3 items-center justify-between border-b border-gray-200 bg-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleArchive}
          className="h-9 w-9 p-0"
          data-testid="archive-btn-mobile"
        >
          <Archive className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-display font-bold text-gray-900">{t('nav.coach')}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={startNewConversation}
          className="h-9 w-9 p-0"
          data-testid="new-chat-btn-mobile"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Chat Messages - Maximized Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-24 md:pb-6" data-testid="chat-messages">
        <div className="w-full max-w-[1600px] mx-auto space-y-4 py-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-6">{t('coach.startConversation')}</p>
              <div className="space-y-2 max-w-2xl mx-auto">
                <p className="text-sm text-gray-600 mb-3">{t('coach.tryAsking')}</p>
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

      {/* Message Input - Fixed at Bottom on Mobile, aligned with nav bar */}
      <div className={`fixed md:relative bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:border-t-0 transition-transform duration-300 ease-in-out md:translate-y-0 ${
        scrollDirection === 'up' ? 'translate-y-[calc(100%+4rem)] md:translate-y-0' : 'translate-y-0'
      }`}>
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <form onSubmit={sendMessage} className="flex space-x-3">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('coach.placeholder')}
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
