import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
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
    onEmojiSelect(emojiData.emoji);
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
        <div className="absolute bottom-12 left-0 z-50">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={320}
            height={400}
            theme="dark"
            searchDisabled={false}
            skinTonesDisabled={false}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
};

export default EmojiPickerButton;
