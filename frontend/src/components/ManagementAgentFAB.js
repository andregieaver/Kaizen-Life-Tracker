import React, { useState, useEffect } from 'react';
import { Shield, MessageCircle, Mic, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ManagementAgentChat from './ManagementAgentChat';
import VoiceChat from './VoiceChat';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ManagementAgentFAB = ({ athleteId, isSuperAdmin, footerProgress = 1 }) => {
  const [showMgmtMenu, setShowMgmtMenu] = useState(false);
  const [showTextChat, setShowTextChat] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const voiceChatRef = React.useRef(null);
  const navigate = useNavigate();

  // Only render for super admin
  if (!isSuperAdmin) {
    return null;
  }

  // Listen for navigation commands from voice chat
  useEffect(() => {
    const handleNavigationCommand = (event) => {
      const { command } = event.detail;
      if (command && command.startsWith('NAVIGATE:')) {
        const path = command.replace('NAVIGATE:', '');
        navigate(path);
      }
    };

    window.addEventListener('management-agent-command', handleNavigationCommand);
    return () => {
      window.removeEventListener('management-agent-command', handleNavigationCommand);
    };
  }, [navigate]);

  const openTextMode = () => {
    setShowTextChat(true);
    setShowMgmtMenu(false);
  };

  const startVoiceMode = async () => {
    setShowMgmtMenu(false);
    setIsVoiceActive(true);
    console.log('Management Agent: Voice mode activated');
    // Voice will auto-start via VoiceChat component
  };

  const stopVoice = () => {
    if (voiceChatRef.current) {
      voiceChatRef.current.stopVoiceChat();
    }
    setIsVoiceActive(false);
  };

  const handleVoiceError = (error) => {
    console.error('Management Agent Voice Error:', error);
    alert(`Voice error: ${error}`);
    setIsVoiceActive(false);
  };

  const closeTextChat = () => {
    setShowTextChat(false);
  };

  return (
    <>
      {/* Main Management Agent FAB - Bottom Left (mirroring the plus button on right) */}
      <button
        onClick={() => setShowMgmtMenu(!showMgmtMenu)}
        className="md:hidden fixed z-50 w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(96px - ${(1 - footerProgress) * 100}px)`,
          left: '16px',
          transform: `translateY(${(1 - footerProgress) * 100}px)`,
          opacity: 0.08 + footerProgress * 0.92,
          transition: 'background 300ms',
          background: showMgmtMenu ? 'var(--grad-danger)' : 'var(--grad-brand)',
          boxShadow: showMgmtMenu 
            ? 'none' 
            : '0 10px 40px rgba(50,211,255,.3)',
          pointerEvents: footerProgress > 0.1 ? 'auto' : 'none',
          willChange: 'transform, opacity'
        }}
        aria-label={showMgmtMenu ? "Close management menu" : "Open management agent"}
      >
        {showMgmtMenu ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <Shield className="w-7 h-7 text-white" />
        )}
      </button>

      {/* Backdrop when menu is open */}
      {showMgmtMenu && (
        <div 
          className="fixed inset-0 bg-black/30 z-30"
          onClick={() => setShowMgmtMenu(false)}
        />
      )}

      {/* Text Mode Button - 0° (3 o'clock - straight right) */}
      <button
        onClick={openTextMode}
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          bottom: `calc(90px - ${(1 - footerProgress) * 100}px)`,
          left: '16px',
          transform: showMgmtMenu 
            ? `translate(${110}px, ${(1 - footerProgress) * 100}px)` // 0° (3 o'clock - straight right)
            : `translate(0, ${(1 - footerProgress) * 100}px) scale(0)`,
          opacity: showMgmtMenu ? (0.08 + footerProgress * 0.92) : 0,
          pointerEvents: (showMgmtMenu && footerProgress > 0.1) ? 'auto' : 'none',
          transition: 'transform 300ms, opacity 300ms',
          transitionDelay: showMgmtMenu ? '50ms' : '0ms',
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
        title="Management Agent - Text Mode"
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
          transform: showMgmtMenu 
            ? `translate(${Math.cos(Math.PI / 6) * 110}px, calc(${-Math.sin(Math.PI / 6) * 110}px + ${(1 - footerProgress) * 100}px))` // 30° (1 o'clock)
            : `translate(0, ${(1 - footerProgress) * 100}px) scale(0)`,
          opacity: showMgmtMenu ? (0.08 + footerProgress * 0.92) : 0,
          pointerEvents: (showMgmtMenu && footerProgress > 0.1) ? 'auto' : 'none',
          transition: 'transform 300ms, opacity 300ms',
          transitionDelay: showMgmtMenu ? '100ms' : '0ms',
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
        title="Management Agent - Voice Mode"
      >
        <Mic className="w-5 h-5 text-white" />
      </button>

      {/* Voice Mode Indicator - Floating overlay when voice is active */}
      {isVoiceActive && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60]">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-full px-6 py-3 shadow-2xl flex items-center space-x-3">
            <div className="relative">
              <Mic className="w-5 h-5 text-white" />
              <div className="absolute inset-0 animate-ping">
                <Mic className="w-5 h-5 text-blue-400 opacity-75" />
              </div>
            </div>
            <span className="text-white font-medium">Management Agent Listening...</span>
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
            apiBasePath="/management-agent/voice"
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
            <ManagementAgentChat athleteId={athleteId} initialMode="text" />
          </div>
        </div>
      )}
    </>
  );
};

export default ManagementAgentFAB;
