import React from 'react';

// Get online status based on last_active_at
export const getOnlineStatus = (last_active_at) => {
  if (!last_active_at) {
    return 'offline'; // Dark gray - logged out or never logged in
  }
  
  const lastActive = new Date(last_active_at);
  const now = new Date();
  const diffMinutes = (now - lastActive) / (1000 * 60);
  
  if (diffMinutes <= 30) {
    return 'online'; // Green - active in last 30 minutes
  } else {
    return 'away'; // Yellow - logged in but not active in last 30 minutes
  }
};

const OnlineStatusIndicator = ({ last_active_at, size = 'medium' }) => {
  const status = getOnlineStatus(last_active_at);
  
  // Size variants
  const sizeClasses = {
    small: 'w-2.5 h-2.5 border',
    medium: 'w-3.5 h-3.5 border-2',
    large: 'w-4 h-4 border-2'
  };
  
  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-600'
  };
  
  const statusTitles = {
    online: 'Active now',
    away: 'Away',
    offline: 'Offline'
  };
  
  return (
    <div 
      className={`absolute top-0 right-0 rounded-full border-gray-800 ${sizeClasses[size]} ${statusColors[status]}`}
      title={statusTitles[status]}
    />
  );
};

export default OnlineStatusIndicator;
