import React, { useState, useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Smile } from 'lucide-react';

const EmojiPickerButton = ({ onEmojiSelect }) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  const handleEmojiClick = (emojiData) => {
    onEmojiSelect(emojiData.native);
    setShowPicker(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
      >
        <Smile className="w-5 h-5 text-[#00C2A8]" />
      </button>

      {showPicker && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-[60] md:hidden"
            onClick={() => setShowPicker(false)}
          />
          
          {/* Picker - Centered on mobile, positioned above button on desktop */}
          <div className="fixed md:absolute bottom-1/2 md:bottom-12 left-1/2 md:left-0 transform -translate-x-1/2 translate-y-1/2 md:translate-x-0 md:translate-y-0 z-[65]">
            <div className="bg-gray-800 rounded-xl border-2 border-gray-600 shadow-2xl overflow-hidden">
              <Picker
                data={data}
                onEmojiSelect={handleEmojiClick}
                theme="dark"
                previewPosition="none"
                skinTonePosition="none"
                set="native"
                emojiSize={20}
                emojiButtonSize={36}
                maxFrequentRows={2}
                perLine={8}
                style={{
                  width: '320px',
                  backgroundColor: '#1f2937',
                  border: 'none',
                  '--rgb-background': '31, 41, 55',
                  '--rgb-accent': '0, 194, 168',
                  '--rgb-input': '55, 65, 81',
                  '--rgb-color': '255, 255, 255',
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmojiPickerButton;
