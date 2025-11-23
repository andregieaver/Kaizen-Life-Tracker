import React from 'react';
import './BookmarkRibbon.css';

const BookmarkRibbon = ({ isBookmarked, onClick, size = 'md' }) => {
  const sizeClasses = {
    sm: { scale: 0.5 },
    md: { scale: 0.7 },
    lg: { scale: 1 }
  };

  return (
    <label 
      className="bookmark-ribbon-wrapper" 
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ transform: `scale(${sizeClasses[size].scale})`, cursor: 'pointer' }}
    >
      <input 
        type="checkbox" 
        checked={isBookmarked} 
        onChange={onClick}
        className="bookmark-ribbon-input"
      />
      <div className="bookmark-ribbon-container">
        <div className="bookmark-shadows2"></div>
        <div className="bookmark-shadows3"></div>
        <div className="bookmark-shadows4"></div>
        <div className="bookmark-shadows"></div>
        <div className="bookmark-item"></div>
        <div className="bookmark-item-inside"></div>
        <div className="bookmark-item-outline"></div>
        <div className="bookmark-item-top-shadow"></div>
        <div className="bookmark-item-top"></div>
        <div className="bookmark-item-top-inner"></div>
      </div>
    </label>
  );
};

export default BookmarkRibbon;
