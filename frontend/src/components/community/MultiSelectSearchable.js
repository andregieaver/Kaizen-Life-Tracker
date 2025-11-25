import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Plus } from 'lucide-react';

/**
 * MultiSelectSearchable - Multi-select dropdown with stable positioning
 * Based on SearchableSelect but with multi-select capability
 */
const MultiSelectSearchable = ({ 
  value = [], 
  onChange, 
  options = [], 
  placeholder = 'Select options...',
  searchPlaceholder = 'Search...',
  emptyText = 'No options found',
  allowCustom = false
}) => {
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

  // Handle option toggle
  const handleToggle = (optionValue) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  // Handle adding custom value
  const handleAddCustom = () => {
    if (searchTerm.trim() && !value.includes(searchTerm.trim())) {
      onChange([...value, searchTerm.trim()]);
      setSearchTerm('');
    }
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && allowCustom && searchTerm.trim()) {
      e.preventDefault();
      handleAddCustom();
    }
  };

  // Remove selected item
  const removeItem = (optionValue, e) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  // Get selected labels
  const getSelectedLabels = () => {
    return value.map(val => {
      const option = options.find(opt => opt.value === val);
      return option ? option.label : val;
    });
  };

  // Check if should show "Add Custom" button
  const showAddCustomButton = allowCustom && searchTerm.trim() && 
    !options.some(opt => opt.label.toLowerCase() === searchTerm.toLowerCase()) &&
    !value.includes(searchTerm.trim());

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left text-white rounded-lg focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent transition-all flex items-center justify-between"
        style={{
          background: 'rgba(17, 24, 39, 0.5)',
          border: '1px solid rgba(71, 85, 105, 0.3)'
        }}
      >
        <div className="flex-1 flex flex-wrap gap-2">
          {value.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            getSelectedLabels().map((label, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                style={{
                  background: 'rgba(50, 211, 255, 0.2)',
                  color: '#32D3FF'
                }}
              >
                {label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const optionValue = value[index];
                    if (optionValue) removeItem(optionValue, e);
                  }}
                  className="ml-1 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform ml-2 flex-shrink-0 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
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
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 text-sm text-white rounded focus:ring-2 focus:ring-[#32D3FF] focus:outline-none"
              style={{
                background: 'rgba(31, 41, 55, 0.5)',
                border: '1px solid rgba(71, 85, 105, 0.3)'
              }}
            />
            {allowCustom && searchTerm.trim() && (
              <p className="text-xs text-gray-400 mt-1">
                Type to search or add your own
              </p>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {showAddCustomButton && (
              <button
                type="button"
                onClick={handleAddCustom}
                className="w-full px-4 py-3 text-left font-medium text-white hover:bg-blue-600/50 transition-colors flex items-center gap-3 border-b-2 border-[#32D3FF]/30 bg-[#32D3FF]/10"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#32D3FF]">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-[#32D3FF]">Add Custom Integration</div>
                  <div className="text-xs text-gray-400 mt-0.5">"{searchTerm}"</div>
                </div>
              </button>
            )}

            {filteredOptions.length === 0 && !showAddCustomButton ? (
              <div className="px-4 py-3 text-sm text-gray-400 text-center">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleToggle(option.value)}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-gray-700/50 transition-colors flex items-center justify-between"
                >
                  <span>{option.label}</span>
                  {value.includes(option.value) && (
                    <Check className="w-4 h-4 text-[#32D3FF]" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectSearchable;
