import React, { useState, useEffect } from 'react';
import { Headphones, MessageCircle, Mic, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SupportAgentChat from './SupportAgentChat';
import VoiceChat from './VoiceChat';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

const SupportAgentFAB = ({ athleteId, isSuperAdmin, footerProgress = 1 }) => {
  const [showSupportMenu, setShowSupportMenu] = useState(false);
  const [showTextChat, setShowTextChat] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const voiceChatRef = React.useRef(null);
  const navigate = useNavigate();

  // Only render for regular users (not super admin)
  if (isSuperAdmin) {
    return null;
  }

  // Listen for navigation commands from voice chat
  useEffect(() => {
    const handleNavigationCommand = (event) => {
      const { path } = event.detail;
      console.log('Support Agent: Navigating to', path);
      navigate(path);
    };

    const handleDataCommand = async (event) => {
      const { results, command } = event.detail;
      console.log('Support Agent: Data command result', { command, results });
      
      // Display results based on action type
      if (results && results.length > 0) {
        // Check for community actions
        const communityAction = results.find(r => r.type === 'community_action');
        
        if (communityAction) {
          // Handle camera trigger for take_photo action
          if (communityAction.action === 'take_photo' && communityAction.success) {
            const caption = communityAction.caption;
            console.log('Opening camera for photo capture with caption:', caption);
            
            // Trigger camera capture
            await handleCameraCapture(caption);
            return;
          }
          
          // Show user-friendly feedback for other community actions
          if (communityAction.success) {
            let message = '';
            switch (communityAction.action) {
              case 'create_post':
                message = '✅ Post created successfully!';
                break;
              case 'edit_post':
                message = '✅ Post updated!';
                break;
              case 'delete_post':
                message = '✅ Post deleted!';
                break;
              case 'delete_post_pending':
                message = `⚠️ Confirm deletion:\n"${communityAction.post_content}..."\n\nSay "yes delete it" to confirm.`;
                break;
              default:
                message = communityAction.message || 'Action completed';
            }
            alert(message);
          } else {
            alert(`❌ ${communityAction.message || 'Action failed'}`);
          }
        } else {
          // For other data commands, show structured info
          const dataResult = results.find(r => r.type === 'inspection' || r.type === 'query' || r.type === 'statistics' || r.type === 'profile');
          if (dataResult) {
            alert(`Support Agent Results:\n${JSON.stringify(dataResult.data || dataResult, null, 2)}`);
          }
        }
      }
    };

    const handleCameraCapture = async (caption) => {
      try {
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: false 
        });
        
        // Create modal for camera preview
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.style.cssText = 'max-width:90%;max-height:70vh;border-radius:12px;';
        modal.appendChild(video);
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display:flex;gap:16px;margin-top:20px;';
        
        const captureBtn = document.createElement('button');
        captureBtn.textContent = '📸 Capture & Post';
        captureBtn.style.cssText = 'padding:12px 24px;background:#32D3FF;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-weight:600;';
        
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
          // Capture the photo
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          
          canvas.toBlob(async (blob) => {
            const file = new File([blob], `voice-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            // Upload the captured image
            const formData = new FormData();
            formData.append('files', file);
            
            try {
              const uploadResponse = await fetch(`${BACKEND_URL}/api/support-agent/upload-media/${athleteId}`, {
                method: 'POST',
                body: formData
              });
              
              const uploadData = await uploadResponse.json();
              
              if (uploadData.success && uploadData.media.length > 0) {
                // Create post with the captured image
                const postResponse = await fetch(`${BACKEND_URL}/api/support-agent/create-post/${athleteId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    content: caption,
                    media: uploadData.media
                  })
                });
                
                const postData = await postResponse.json();
                
                if (postData.success) {
                  alert('✅ Photo captured and posted successfully!');
                } else {
                  alert('❌ Failed to create post');
                }
              } else {
                alert('❌ Failed to upload photo');
              }
            } catch (error) {
              console.error('Error uploading photo:', error);
              alert('❌ Error uploading photo');
            }
            
            cleanup();
          }, 'image/jpeg', 0.9);
        };
        
        cancelBtn.onclick = cleanup;
        
      } catch (error) {
        console.error('Camera error:', error);
        alert('Could not access camera. Please check permissions.');
      }
    };

    window.addEventListener('support-agent-navigate', handleNavigationCommand);
    window.addEventListener('support-agent-data', handleDataCommand);
    
    return () => {
      window.removeEventListener('support-agent-navigate', handleNavigationCommand);
      window.removeEventListener('support-agent-data', handleDataCommand);
    };
  }, [navigate]);

  const openTextMode = () => {
    setShowTextChat(true);
    setShowSupportMenu(false);
  };

  const startVoiceMode = async () => {
    setShowSupportMenu(false);
    setIsVoiceActive(true);
    console.log('Support Agent: Voice mode activated');
    // Voice will auto-start via VoiceChat component
  };

  const stopVoice = () => {
    if (voiceChatRef.current) {
      voiceChatRef.current.stopVoiceChat();
    }
    setIsVoiceActive(false);
  };

  const handleVoiceError = (error) => {
    console.error('Support Agent Voice Error:', error);
    alert(`Voice error: ${error}`);
    setIsVoiceActive(false);
  };

  const closeTextChat = () => {
    setShowTextChat(false);
  };

  return (
    <>
      {/* Support Agent FAB - Bottom Left (same position as Management Agent) */}
      <button
        onClick={() => setShowSupportMenu(!showSupportMenu)}
        className="md:hidden fixed z-50 w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(96px - ${(1 - footerProgress) * 100}px)`,
          left: '16px',
          transform: `translateY(${(1 - footerProgress) * 100}px)`,
          opacity: 0.08 + footerProgress * 0.92,
          transition: 'background 300ms',
          background: showSupportMenu ? 'var(--grad-danger)' : 'linear-gradient(135deg, #1a4d6d 0%, #32D3FF 100%)',
          boxShadow: showSupportMenu 
            ? 'none' 
            : '0 10px 40px rgba(102,126,234,.3)',
          pointerEvents: footerProgress > 0.1 ? 'auto' : 'none',
          willChange: 'transform, opacity'
        }}
        aria-label={showSupportMenu ? "Close support menu" : "Open support agent"}
      >
        {showSupportMenu ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <Headphones className="w-7 h-7 text-white" />
        )}
      </button>

      {/* Backdrop when menu is open */}
      {showSupportMenu && (
        <div 
          className="fixed inset-0 bg-black/30 z-30"
          onClick={() => setShowSupportMenu(false)}
        />
      )}

      {/* Text Mode Button - 0° (3 o'clock - straight right) */}
      <button
        onClick={openTextMode}
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(90px - ${(1 - footerProgress) * 100}px)`,
          left: '16px',
          transform: showSupportMenu 
            ? `translate(${110}px, ${(1 - footerProgress) * 100}px)` // 0° (3 o'clock - straight right)
            : `translate(0, ${(1 - footerProgress) * 100}px) scale(0)`,
          opacity: showSupportMenu ? (0.08 + footerProgress * 0.92) : 0,
          pointerEvents: (showSupportMenu && footerProgress > 0.1) ? 'auto' : 'none',
          transition: 'transform 300ms, opacity 300ms',
          transitionDelay: showSupportMenu ? '50ms' : '0ms',
          backgroundColor: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
            inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
            inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
            inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
            inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `
        }}
        title="Support Agent - Text Mode"
      >
        <MessageCircle className="w-5 h-5 text-white" />
      </button>

      {/* Voice Mode Button - 30° (1 o'clock position) */}
      <button
        onClick={startVoiceMode}
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(90px - ${(1 - footerProgress) * 100}px)`,
          left: '16px',
          transform: showSupportMenu 
            ? `translate(${Math.cos(Math.PI / 6) * 110}px, calc(${-Math.sin(Math.PI / 6) * 110}px + ${(1 - footerProgress) * 100}px))` // 30° (1 o'clock)
            : `translate(0, ${(1 - footerProgress) * 100}px) scale(0)`,
          opacity: showSupportMenu ? (0.08 + footerProgress * 0.92) : 0,
          pointerEvents: (showSupportMenu && footerProgress > 0.1) ? 'auto' : 'none',
          transition: 'transform 300ms, opacity 300ms',
          transitionDelay: showSupportMenu ? '100ms' : '0ms',
          backgroundColor: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
          backdropFilter: 'blur(8px) saturate(150%)',
          WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
            inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
            inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
            inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
            inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
            inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
            0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `
        }}
        title="Support Agent - Voice Mode"
      >
        <Mic className="w-5 h-5 text-white" />
      </button>

      {/* Voice Mode Indicator - Floating overlay when voice is active */}
      {isVoiceActive && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60]">
          <div className="bg-gradient-to-r from-[#1a4d6d] to-[#32D3FF] rounded-full px-6 py-3 shadow-2xl flex items-center space-x-3">
            <div className="relative">
              <Mic className="w-5 h-5 text-white" />
              <div className="absolute inset-0 animate-ping">
                <Mic className="w-5 h-5 text-[#32D3FF] opacity-75" />
              </div>
            </div>
            <span className="text-white font-medium">Support Agent Listening...</span>
            <button
              onClick={stopVoice}
              className="ml-2 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden Voice Chat Component - runs in background */}
      {isVoiceActive && (
        <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
          <VoiceChat
            ref={voiceChatRef}
            athleteId={athleteId}
            apiBasePath="/support-agent/voice"
            backendUrl={BACKEND_URL}
            autoStart={true}
            onError={handleVoiceError}
          />
        </div>
      )}

      {/* Full Screen Text Chat Modal */}
      {showTextChat && (
        <div className="fixed inset-0 z-[100] bg-[#0B1220]">
          <div className="relative h-full">
            {/* Close Button */}
            <button
              onClick={closeTextChat}
              className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 
                         flex items-center justify-center text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Chat Component */}
            <SupportAgentChat athleteId={athleteId} initialMode="text" />
          </div>
        </div>
      )}
    </>
  );
};

export default SupportAgentFAB;
