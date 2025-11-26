import React, { useState, useEffect } from 'react';
import { Headphones, MessageCircle, Mic, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SupportAgentChat from './SupportAgentChat';
import VoiceChat from './VoiceChat';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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

    const handleDataCommand = (event) => {
      const { results, command } = event.detail;
      console.log('Support Agent: Data command result', { command, results });
      
      // Display results in a modal or notification
      // For now, just log to console - can be enhanced later
      if (results && results.length > 0) {
        alert(`Support Agent Results:\n${JSON.stringify(results, null, 2)}`);
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
          background: showSupportMenu ? 'var(--grad-danger)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-full px-6 py-3 shadow-2xl flex items-center space-x-3">
            <div className="relative">
              <Mic className="w-5 h-5 text-white" />
              <div className="absolute inset-0 animate-ping">
                <Mic className="w-5 h-5 text-purple-400 opacity-75" />
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
