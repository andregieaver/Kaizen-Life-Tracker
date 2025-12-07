import React, { useState, useEffect } from 'react';
import { Headphones, Send, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

const SupportAgentChat = ({ athleteId, initialMode = 'text' }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [attachedMedia, setAttachedMedia] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const inputRef = React.useRef(null);
  const inputContainerRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const videoInputRef = React.useRef(null);

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
    if ((!inputMessage.trim() && attachedMedia.length === 0) || isSending) return;

    const userMessage = inputMessage.trim();
    const mediaToSend = [...attachedMedia];
    
    setInputMessage('');
    setAttachedMedia([]);
    
    // Add user message to display
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage || '📎 Media attached',
      timestamp: new Date().toISOString(),
      media: mediaToSend
    }]);

    setIsSending(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/support-agent/chat`, {
        athlete_id: athleteId,
        session_id: sessionId,
        message: userMessage || 'Post with media',
        media: mediaToSend
      });

      const assistantMessage = response.data.response;
      const actionTaken = response.data.action_taken;
      const actionResult = response.data.action_result;

      console.log('Support Agent Response:', { actionTaken, actionResult });

      // Add assistant message to display with action metadata
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString(),
        actionTaken: actionTaken,
        actionResult: actionResult,
        showDeleteButton: actionTaken === 'pending_delete' && actionResult?.pending === true
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

  const handleFileUpload = async (files) => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/support-agent/upload-media/${athleteId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setAttachedMedia(prev => [...prev, ...response.data.media]);
      }
    } catch (error) {
      console.error('Failed to upload media:', error);
      alert('Failed to upload media. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Create video element for preview
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // Create canvas for capture
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Simple modal for camera
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
      
      video.style.cssText = 'max-width:90%;max-height:70vh;';
      modal.appendChild(video);
      
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display:flex;gap:16px;margin-top:20px;';
      
      const captureBtn = document.createElement('button');
      captureBtn.textContent = '📸 Capture';
      captureBtn.style.cssText = 'padding:12px 24px;background:#32D3FF;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '❌ Cancel';
      cancelBtn.style.cssText = 'padding:12px 24px;background:#666;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;';
      
      buttonContainer.appendChild(captureBtn);
      buttonContainer.appendChild(cancelBtn);
      modal.appendChild(buttonContainer);
      
      document.body.appendChild(modal);
      
      const cleanup = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
      };
      
      captureBtn.onclick = async () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob(async (blob) => {
          const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          await handleFileUpload([file]);
          cleanup();
        }, 'image/jpeg', 0.9);
      };
      
      cancelBtn.onclick = cleanup;
      
    } catch (error) {
      console.error('Camera error:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const removeMedia = (index) => {
    setAttachedMedia(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full flex flex-col bg-[#0B1220] min-h-0 relative">
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 pb-40 md:pb-32">
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
              <div className="flex flex-col max-w-[80%] gap-2">
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-[#1a4d6d] to-[#32D3FF] text-white'
                      : msg.isError
                      ? 'bg-red-900/20 text-red-400 border border-red-800'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  
                  {/* Show attached media */}
                  {msg.media && msg.media.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.media.map((item, idx) => (
                        <div key={idx} className="relative">
                          {item.type === 'image' ? (
                            <img 
                              src={`${BACKEND_URL}${item.url}`} 
                              alt="Attached" 
                              className="w-24 h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-24 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                              <span className="text-3xl">🎥</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Show confirmation buttons for pending deletions */}
                {msg.showDeleteButton && (
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={async () => {
                        // Send "yes" automatically without populating input
                        setIsSending(true);
                        try {
                          const response = await axios.post(`${BACKEND_URL}/api/support-agent/chat`, {
                            athlete_id: athleteId,
                            session_id: sessionId,
                            message: 'yes'
                          });

                          const assistantMessage = response.data.response;
                          const actionTaken = response.data.action_taken;
                          const actionResult = response.data.action_result;

                          setMessages(prev => [...prev, 
                            { role: 'user', content: 'yes', timestamp: new Date().toISOString() },
                            { 
                              role: 'assistant', 
                              content: assistantMessage, 
                              timestamp: new Date().toISOString(),
                              actionTaken: actionTaken,
                              actionResult: actionResult
                            }
                          ]);
                        } catch (error) {
                          console.error('Failed to confirm:', error);
                        } finally {
                          setIsSending(false);
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors shadow-lg"
                    >
                      Yes
                    </button>
                    <button
                      onClick={async () => {
                        // Send "no" automatically without populating input
                        setIsSending(true);
                        try {
                          const response = await axios.post(`${BACKEND_URL}/api/support-agent/chat`, {
                            athlete_id: athleteId,
                            session_id: sessionId,
                            message: 'no'
                          });

                          const assistantMessage = response.data.response;

                          setMessages(prev => [...prev, 
                            { role: 'user', content: 'no', timestamp: new Date().toISOString() },
                            { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
                          ]);
                        } catch (error) {
                          console.error('Failed to cancel:', error);
                        } finally {
                          setIsSending(false);
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors shadow-lg"
                    >
                      No
                    </button>
                  </div>
                )}
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

      {/* Message Input - Fixed at Bottom (scoped to this container) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 to-gray-800 border-t border-gray-700 z-10">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
          {/* Media Preview */}
          {attachedMedia.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedMedia.map((media, index) => (
                <div key={index} className="relative">
                  {media.type === 'image' ? (
                    <img 
                      src={`${BACKEND_URL}${media.url}`} 
                      alt="Attached" 
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">🎥</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeMedia(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Media Buttons */}
          <div className="mb-2 flex gap-2">
            <button
              onClick={handleCamera}
              disabled={isUploading || isSending}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              📷 Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSending}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              🖼️ Images
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading || isSending}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              🎥 Video
            </button>
            {isUploading && <span className="text-gray-400 text-sm self-center">Uploading...</span>}
          </div>

          {/* Hidden File Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          {/* Message Input */}
          <div className="flex items-end space-x-2">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your health, workouts, or data..."
              className="flex-1 bg-gray-800 text-white rounded-2xl px-3 sm:px-4 py-2 sm:py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#32D3FF] text-sm sm:text-base min-h-[60px] max-h-[120px]"
              rows="2"
              disabled={isSending}
              autoComplete="off"
            />
            <button
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && attachedMedia.length === 0) || isSending}
              className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-full bg-gradient-to-br from-[#1a4d6d] to-[#32D3FF] flex items-center justify-center
                       hover:from-[#2a5d7d] hover:to-[#42E3FF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
