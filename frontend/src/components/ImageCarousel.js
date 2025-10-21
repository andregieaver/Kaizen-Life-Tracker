import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';

const ImageCarousel = ({ images = [], alt = "Image" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Early return with no message if no images
  if (!images || images.length === 0) {
    return null;
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isFullscreen) {
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'ArrowRight') nextImage();
        if (e.key === 'Escape') setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullscreen, currentIndex]);

  // Disable body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  const nextImage = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 300);
    }
  };

  const prevImage = () => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 300);
    }
  };

  const goToImage = (index) => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(index);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 300);
    }
  };

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 50) {
      // Swipe left
      nextImage();
    }
    if (touchStart - touchEnd < -50) {
      // Swipe right
      prevImage();
    }
  };

  const ImageDisplay = ({ inFullscreen = false }) => (
    <div 
      className={`relative ${inFullscreen ? 'w-full h-full flex items-center justify-center' : 'w-full'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Image */}
      <div className={`${inFullscreen ? 'max-w-[90vw] max-h-[90vh]' : 'w-full aspect-video'} overflow-hidden relative`}>
        <img
          src={images[currentIndex]}
          alt={`${alt} ${currentIndex + 1}`}
          className={`${
            inFullscreen 
              ? 'max-w-full max-h-full object-contain' 
              : 'w-full h-full object-cover'
          } rounded-lg transition-all duration-300 ease-in-out ${
            isTransitioning ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'
          }`}
          onClick={() => !inFullscreen && setIsFullscreen(true)}
          style={{ cursor: inFullscreen ? 'default' : 'pointer' }}
        />
      </div>

      {/* Navigation Arrows - Only show if more than 1 image */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Fullscreen Button - Only in normal view */}
      {!inFullscreen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFullscreen(true);
          }}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
          aria-label="View fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}

      {/* Dot Indicators - Overlaid at bottom */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                goToImage(index);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Normal View */}
      <ImageDisplay inFullscreen={false} />

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-all z-10"
            aria-label="Close fullscreen"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image Counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm z-10">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Image Display */}
          <div onClick={(e) => e.stopPropagation()}>
            <ImageDisplay inFullscreen={true} />
          </div>
        </div>
      )}
    </>
  );
};

export default ImageCarousel;
