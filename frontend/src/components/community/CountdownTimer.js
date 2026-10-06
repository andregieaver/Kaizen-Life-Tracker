import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

const CountdownTimer = ({ endDate, className = '', showIcon = true }) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(endDate));

  useEffect(() => {
    // Update countdown every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(endDate));
    }, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(timer);
  }, [endDate]);

  function calculateTimeLeft(targetDate) {
    const difference = new Date(targetDate) - new Date();

    if (difference <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true
      };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isExpired: false
    };
  }

  if (timeLeft.isExpired) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 ${className}`}>
        {showIcon && <Calendar className="w-4 h-4" />}
        <span className="text-sm">Challenge Ended</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && <Clock className="w-4 h-4 text-[#32D3FF]" />}
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {timeLeft.days > 0 && (
          <div className="flex items-baseline gap-0.5">
            <span className="text-[#32D3FF] text-lg font-bold">{timeLeft.days}</span>
            <span className="text-gray-400 text-xs">d</span>
          </div>
        )}
        <div className="flex items-baseline gap-0.5">
          <span className="text-[#32D3FF] text-lg font-bold">
            {String(timeLeft.hours).padStart(2, '0')}
          </span>
          <span className="text-gray-400 text-xs">h</span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-[#32D3FF] text-lg font-bold">
            {String(timeLeft.minutes).padStart(2, '0')}
          </span>
          <span className="text-gray-400 text-xs">m</span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-[#32D3FF] text-lg font-bold">
            {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span className="text-gray-400 text-xs">s</span>
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;
