import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, MessageCircle, Bot, User } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CoachChat = ({ athleteId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
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
    "How's my recovery looking?"
  ];

  const handleSuggestedQuestion = (question) => {
    setNewMessage(question);
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-display text-gray-900">
                Your AI Running Coach
              </CardTitle>
              <CardDescription className="text-gray-600">
                Ask me anything about your training, recovery, or running goals
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Chat Messages */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <div className="h-96 overflow-y-auto p-6 space-y-4" data-testid="chat-messages">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-6">Start a conversation with your AI coach!</p>
                <div className="space-y-2">
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
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 message-enter ${
                    message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
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
                  <div className={`flex-1 max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl ${
                    message.type === 'user' ? 'text-right' : 'text-left'
                  }`}>
                    <div className={`inline-block p-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.isError
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
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
        </CardContent>
      </Card>

      {/* Message Input */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachChat;
