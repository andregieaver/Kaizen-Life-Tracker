import React, { useState } from 'react';
import { Shield, MessageCircle, Mic, X } from 'lucide-react';
import ManagementAgentChat from './ManagementAgentChat';

const ManagementAgentFAB = ({ athleteId, isSuperAdmin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [mode, setMode] = useState(null); // 'text' or 'voice'

  // Only render for super admin
  if (!isSuperAdmin) {
    return null;
  }

  const toggleModes = () => {
    if (isOpen) {
      setIsOpen(false);
      setMode(null);
    } else {
      setShowModes(!showModes);
    }
  };

  const selectMode = (selectedMode) => {
    setMode(selectedMode);
    setIsOpen(true);
    setShowModes(false);
  };

  const closeChat = () => {
    setIsOpen(false);
    setMode(null);
  };

  return (
    <>
      {/* FAB Button - Fixed to left side */}
      <div className="fixed left-6 bottom-6 z-50">
        {/* Mode Selection Buttons */}
        {showModes && !isOpen && (
          <div className="absolute bottom-20 left-0 flex flex-col space-y-3 mb-2">
            {/* Text Mode Button */}
            <button
              onClick={() => selectMode('text')}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                         text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 
                         flex items-center justify-center group relative"
              title="Text Mode"
            >
              <MessageCircle className="w-6 h-6" />
              <span className="absolute left-full ml-3 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 
                               group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Text Mode
              </span>
            </button>

            {/* Voice Mode Button */}
            <button
              onClick={() => selectMode('voice')}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 
                         text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 
                         flex items-center justify-center group relative"
              title="Voice Mode"
            >
              <Mic className="w-6 h-6" />
              <span className="absolute left-full ml-3 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 
                               group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Voice Mode
              </span>
            </button>
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={toggleModes}
          className={`w-16 h-16 rounded-full shadow-2xl transform transition-all duration-300 
                     flex items-center justify-center ${
            showModes || isOpen
              ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rotate-45'
              : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
          } hover:scale-110`}
        >
          {showModes || isOpen ? (
            <X className="w-8 h-8 text-white transform -rotate-45" />
          ) : (
            <Shield className="w-8 h-8 text-white" />
          )}
        </button>

        {/* Pulsing ring effect when closed */}
        {!showModes && !isOpen && (
          <div className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-20" />
        )}
      </div>

      {/* Full Screen Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-[#0B1220]">
          <div className="relative h-full">
            {/* Close Button */}
            <button
              onClick={closeChat}
              className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 
                         flex items-center justify-center text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Chat Component */}
            <ManagementAgentChat athleteId={athleteId} initialMode={mode} />
          </div>
        </div>
      )}
    </>
  );
};

export default ManagementAgentFAB;
