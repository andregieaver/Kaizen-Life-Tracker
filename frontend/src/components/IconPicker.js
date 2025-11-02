import React, { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// Fallback list of common icons if dynamic import fails
const FALLBACK_ICONS = [
  'Home', 'User', 'Settings', 'Menu', 'Search', 'Bell', 'Heart', 'Star',
  'Check', 'Plus', 'Minus', 'X', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'ChevronLeft', 'ChevronRight', 'ChevronUp', 'ChevronDown', 'MessageSquare',
  'MessageCircle', 'Mail', 'Phone', 'Video', 'Mic', 'Calendar', 'Clock',
  'File', 'Folder', 'Image', 'FileText', 'Download', 'Upload', 'Share',
  'ThumbsUp', 'ThumbsDown', 'Users', 'UserPlus', 'Award', 'Trophy',
  'ShoppingCart', 'CreditCard', 'DollarSign', 'Tag', 'Package', 'TrendingUp',
  'Activity', 'BarChart', 'PieChart', 'TrendingDown', 'Zap', 'Shield',
  'Lock', 'Unlock', 'Eye', 'EyeOff', 'Edit', 'Trash', 'Copy', 'Save',
  'RefreshCw', 'RotateCw', 'Download', 'Upload', 'ExternalLink', 'Link',
  'Paperclip', 'Bookmark', 'Flag', 'MapPin', 'Navigation', 'Compass',
  'Globe', 'Wifi', 'Battery', 'Bluetooth', 'Cast', 'Monitor', 'Smartphone',
  'Tablet', 'Watch', 'Headphones', 'Camera', 'Printer', 'Server', 'Database',
  'Cloud', 'HardDrive', 'Cpu', 'Power', 'Volume', 'VolumeX', 'Play', 'Pause',
  'Square', 'Circle', 'Triangle', 'Hexagon', 'Box', 'Grid', 'List', 'Layers',
  'BookOpen', 'Book', 'Newspaper', 'Briefcase', 'Coffee', 'Gift', 'Utensils',
  'Pizza', 'Beer', 'Wine', 'Music', 'Film', 'Tv', 'Radio', 'Mic2',
  'Sun', 'Moon', 'CloudRain', 'CloudSnow', 'Wind', 'Droplet', 'Flame', 'Sparkles'
];

const IconPicker = ({ isOpen, onClose, onSelect, currentIcon }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Get all available Lucide icons (exclude React components that aren't icons)
  const availableIcons = useMemo(() => {
    try {
      // Exclude these non-icon exports
      const excludeList = [
        'createLucideIcon',
        'default',
        'Icon',
        'icons',
        'dynamicIconImports'
      ];

      const iconNames = Object.keys(LucideIcons)
        .filter(name => {
          // Exclude non-icon exports
          if (excludeList.includes(name)) return false;
          
          // Must be a function (React component)
          if (typeof LucideIcons[name] !== 'function') return false;
          
          // Icon names typically start with uppercase
          if (name[0] !== name[0].toUpperCase()) return false;
          
          return true;
        })
        .sort();

      console.log('Available icons loaded:', iconNames.length);
      
      // If no icons found, use fallback
      if (iconNames.length === 0) {
        console.warn('No icons found via dynamic import, using fallback list');
        return FALLBACK_ICONS;
      }
      
      return iconNames;
    } catch (error) {
      console.error('Error loading icons:', error);
      return FALLBACK_ICONS;
    }
  }, []);

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!searchTerm) return availableIcons;
    const term = searchTerm.toLowerCase();
    return availableIcons.filter(name => 
      name.toLowerCase().includes(term)
    );
  }, [searchTerm, availableIcons]);

  const handleSelect = (iconName) => {
    onSelect(iconName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Choose an Icon</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search icons... (e.g., home, user, calendar)"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-[#00C2A8]"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {filteredIcons.length} icons available
          </p>
        </div>

        {/* Icon Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {filteredIcons.map((iconName) => {
              const IconComponent = LucideIcons[iconName];
              const isSelected = iconName === currentIcon;
              
              return (
                <button
                  key={iconName}
                  onClick={() => handleSelect(iconName)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all hover:bg-gray-700 ${
                    isSelected ? 'bg-[#00C2A8] bg-opacity-20 border-2 border-[#00C2A8]' : 'border-2 border-transparent'
                  }`}
                  title={iconName}
                >
                  <IconComponent className={`w-6 h-6 mb-1 ${isSelected ? 'text-[#00C2A8]' : 'text-gray-300'}`} />
                  <span className="text-xs text-gray-400 text-center truncate w-full">
                    {iconName}
                  </span>
                </button>
              );
            })}
          </div>
          
          {filteredIcons.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No icons found matching "{searchTerm}"</p>
              <p className="text-sm text-gray-500 mt-2">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {currentIcon && (
              <span>
                Current: <span className="text-[#00C2A8] font-semibold">{currentIcon}</span>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onSelect('');
                onClose();
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              Clear Icon
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IconPicker;
