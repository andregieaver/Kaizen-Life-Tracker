import React from 'react';

const LoadingSpinner = ({ size = 'md', className = '', withBackground = false }) => {
  const sizeClasses = {
    sm: 'w-8 h-6',
    md: 'w-16 h-12',
    lg: 'w-24 h-18',
    xl: 'w-32 h-24'
  };

  const spinner = (
    <svg 
      viewBox="0 0 64 48" 
      className={`${sizeClasses[size]} ${className}`}
      style={{ color: '#32D3FF' }}
    >
      <style>{`
        .heartbeat-back {
          fill: none;
          stroke: white;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: 0.1;
        }

        .heartbeat-front {
          fill: none;
          stroke: currentColor;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 48, 144;
          stroke-dashoffset: 192;
          animation: heartbeat-dash 1.4s linear infinite;
        }

        @keyframes heartbeat-dash {
          72.5% {
            opacity: 0;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
      <polyline 
        points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" 
        className="heartbeat-back"
      />
      <polyline 
        points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" 
        className="heartbeat-front"
      />
    </svg>
  );
};

export default LoadingSpinner;
