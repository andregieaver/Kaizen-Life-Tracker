import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Send, Bot, MessageCircle, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ChatbotWidget = ({ isLoggedIn = false, athleteId = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const messagesEndRef = useRef(null);

  // Determine which agents to fetch based on login status
  const accessibilityLevel = isLoggedIn ? 'logged_in' : 'frontend';

  useEffect(() => {
    loadAgents();
  }, [accessibilityLevel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadAgents = async () => {
    try {
      // For now, get all agents and filter by accessibility
      // In production, use the by-accessibility endpoint
      const response = await axios.get(`${API}/agents?athlete_id=guest`);
      const filteredAgents = response.data.filter(
        agent => agent.accessibility === accessibilityLevel && agent.is_active
      );
      setAgents(filteredAgents);
      
      // Auto-select first agent if available
      if (filteredAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(filteredAgents[0]);
        // Add welcome message
        setMessages([{
          type: 'agent',
          content: `Hi! I'm ${filteredAgents[0].name}. How can I help you today?`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !selectedAgent) return;

    const userMessage = {
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // TODO: Replace with actual agent chat endpoint
      // For now, simulate a response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const agentMessage = {
        type: 'agent',
        content: `Thank you for your message! I'm ${selectedAgent.name}, and I'm here to help. This is a placeholder response. The actual chat functionality will be implemented with the agent's custom instructions.`,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        type: 'agent',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const switchAgent = (agent) => {
    setSelectedAgent(agent);
    setMessages([{
      type: 'agent',
      content: `Hi! I'm ${agent.name}. How can I help you today?`,
      timestamp: new Date().toISOString()
    }]);
    setShowAgentSelector(false);
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen && agents.length === 0) {
      loadAgents();
    }
  };

  if (agents.length === 0) {
    return null; // Don't show widget if no agents available
  }

  return (
    <>
      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 md:right-6 w-[calc(100vw-2rem)] md:w-96 h-[600px] max-h-[calc(100vh-8rem)] bg-gray-900 rounded-lg shadow-2xl flex flex-col z-[9999] border border-gray-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {selectedAgent?.profile_image_url ? (
                <img
                  src={selectedAgent.profile_image_url}
                  alt={selectedAgent.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1">
                <button
                  onClick={() => setShowAgentSelector(!showAgentSelector)}
                  className="flex items-center space-x-1 text-white hover:text-gray-200 transition-colors"
                >
                  <h3 className="font-semibold">{selectedAgent?.name}</h3>
                  {agents.length > 1 && <ChevronDown className="w-4 h-4" />}
                </button>
                <p className="text-xs text-white/80">AI Assistant</p>
              </div>
            </div>
            <button
              onClick={toggleWidget}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Agent Selector Dropdown */}
          {showAgentSelector && agents.length > 1 && (
            <div className="bg-gray-800 border-b border-gray-700">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => switchAgent(agent)}
                  className={`w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-700 transition-colors ${
                    agent.id === selectedAgent?.id ? 'bg-gray-700' : ''
                  }`}
                >
                  {agent.profile_image_url ? (
                    <img
                      src={agent.profile_image_url}
                      alt={agent.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white">{agent.name}</p>
                    {agent.personality && (
                      <p className="text-xs text-gray-400 capitalize">{agent.personality}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-800">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[85%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {message.type === 'agent' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.isError
                      ? 'bg-red-900/30 text-red-200 border border-red-800'
                      : 'bg-gray-700 text-gray-100'
                  }`}>
                    <div className="prose prose-invert prose-sm max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="rounded-lg p-3 bg-gray-700">
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

          {/* Input */}
          <div className="p-4 bg-gray-900 border-t border-gray-700 rounded-b-lg">
            <form onSubmit={sendMessage} className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={toggleWidget}
        className="fixed bottom-4 right-4 md:right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-110 z-[9999]"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>
    </>
  );
};

export default ChatbotWidget;
