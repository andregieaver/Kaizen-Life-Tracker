import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * SearchableSelect - Custom searchable dropdown component with theme-coherent styling
 * Used for filtering by nationality in the community feed
 */
const SearchableSelect = ({ value, onChange, options, placeholder, label, disabled = false, searchPlaceholder }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle option selection
  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Get display label for current value
  const getDisplayLabel = () => {
    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption ? selectedOption.label : placeholder || t('community.post.allNationalities');
  };

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent outline-none flex items-center justify-between transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{
          background: 'rgba(17, 24, 39, 0.5)',
          border: '1px solid rgba(71, 85, 105, 0.3)'
        }}
      >
        <span className="truncate text-sm">{getDisplayLabel()}</span>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-2xl z-50 max-h-80 overflow-hidden flex flex-col"
          style={{
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Search Input */}
          <div className="p-3 border-b border-gray-700">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder || t('community.searchNationality')}
              className="w-full px-3 py-2 text-sm text-white rounded focus:ring-2 focus:ring-[#32D3FF] focus:outline-none"
              style={{
                background: 'rgba(31, 41, 55, 0.5)',
                border: '1px solid rgba(71, 85, 105, 0.3)'
              }}
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                {t('community.noNationalitiesFound')}
              </div>
            ) : (
              <div className="py-2">
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      value === option.value
                        ? 'bg-[#32D3FF]/20 text-[#32D3FF] font-semibold'
                        : 'text-white hover:bg-gray-700/50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
