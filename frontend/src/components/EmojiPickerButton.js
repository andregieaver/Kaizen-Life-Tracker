import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Smile } from 'lucide-react';

const EmojiPickerButton = ({ onEmojiSelect }) => {
  const { i18n } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);
  
  // Custom translations for emoji picker
  const getEmojiPickerTranslations = () => {
    const translations = {
      'no': {
        search: 'Søk',
        search_no_results_1: 'Åh nei!',
        search_no_results_2: 'Ingen emoji funnet',
        pick: 'Velg en emoji…',
        add_custom: 'Legg til egen emoji',
        categories: {
          activity: 'Aktivitet',
          custom: 'Tilpasset',
          flags: 'Flagg',
          foods: 'Mat og drikke',
          frequent: 'Ofte brukt',
          nature: 'Dyr og natur',
          objects: 'Objekter',
          people: 'Smilefjes og personer',
          places: 'Reise og steder',
          search: 'Søkeresultater',
          symbols: 'Symboler'
        },
        skins: {
          choose: 'Velg standard hudtone',
          1: 'Standard',
          2: 'Lys',
          3: 'Middels-lys',
          4: 'Middels',
          5: 'Middels-mørk',
          6: 'Mørk'
        }
      },
      'en': {
        search: 'Search',
        search_no_results_1: 'Oh no!',
        search_no_results_2: 'That emoji couldn\'t be found',
        pick: 'Pick an emoji…',
        categories: {
          activity: 'Activity',
          flags: 'Flags',
          foods: 'Food & Drink',
          frequent: 'Frequently used',
          nature: 'Animals & Nature',
          objects: 'Objects',
          people: 'Smileys & People',
          places: 'Travel & Places',
          symbols: 'Symbols'
        }
      }
    };
    
    return translations[i18n.language] || translations['en'];
  };

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
        <Smile className="w-5 h-5 text-[#32D3FF]" />
      </button>

      {showPicker && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-[60] bg-black/50 md:hidden"
            onClick={() => setShowPicker(false)}
            role="presentation"
            aria-label="Close emoji picker"
          />
          
          {/* Picker Container */}
          <div 
            className="fixed left-1/2 top-1/2 z-[65] md:absolute md:left-0 md:bottom-12 md:top-auto"
            style={{
              transform: 'translate(-50%, -50%)',
            }}
          >
            <style>{`
              @media (min-width: 768px) {
                div[data-picker-container] {
                  transform: none !important;
                }
              }
            `}</style>
            <div data-picker-container className="bg-gray-800 rounded-xl border-2 border-gray-600 shadow-2xl overflow-hidden">
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
                i18n={getEmojiPickerTranslations()}
                style={{
                  width: '320px',
                  backgroundColor: '#1f2937',
                  border: 'none',
                  '--rgb-background': '31, 41, 55',
                  '--rgb-accent': '50, 211, 255',
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
