import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2, Play, Pause, Volume2, VolumeX } from 'lucide-react';

import { logger } from '../utils/logger';
const ImageCarousel = ({ images = [], media = [], alt = "Media" }) => {
  // Get backend URL from environment
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  
  // Helper function to normalize URLs
  const normalizeUrl = (url) => {
    if (!url) return '';
    // If URL starts with '/', prepend backend URL
    if (url.startsWith('/')) {
      return `${backendUrl}${url}`;
    }
    // Otherwise return as-is (already absolute)
    return url;
  };
  
  // Support both old images prop and new media prop, normalizing URLs
  const mediaItems = media.length > 0 
    ? media.map(item => ({ 
        ...item, 
        url: normalizeUrl(item.url),
        thumbnail: item.thumbnail ? normalizeUrl(item.thumbnail) : undefined
      }))
    : images.map(url => ({ type: 'image', url: normalizeUrl(url) }));
  
  // Debug logging
  logger.debug(null, '🔍 ImageCarousel received:', { 
    images, 
    media, 
    mediaItems,
    backendUrl,
    hasImages: images?.length > 0,
    hasMedia: media?.length > 0,
    mediaItemsCount: mediaItems?.length
  });
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [slideDirection, setSlideDirection] = useState('right');
  const [isPlaying, setIsPlaying] = useState({});
  const [isMuted, setIsMuted] = useState({});
  const [videoMuted, setVideoMuted] = useState(true); // For single video auto-play
  const [videoPlaying, setVideoPlaying] = useState(false); // Track playing state
  const [showControls, setShowControls] = useState(false); // Show/hide custom controls
  
  const videoRef = useRef(null);
  const observerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Early return if no media
  if (!mediaItems || mediaItems.length === 0) {
    logger.debug(null, '❌ ImageCarousel: No media items to display');
    return null;
  }
  
  logger.debug(null, '✅ ImageCarousel: Rendering', mediaItems.length, 'items');

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

  // Auto-play video when scrolled into view (only for single video posts)
  useEffect(() => {
    const isSingleVideo = mediaItems.length === 1 && mediaItems[0].type === 'video';
    
    if (!isSingleVideo || !videoRef.current) {
      return;
    }

    const videoElement = videoRef.current;

    // Intersection Observer to detect when video is in viewport
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Video is in viewport - auto-play muted
            videoElement.muted = true;
            videoElement.play().then(() => {
              setVideoPlaying(true);
            }).catch((error) => {
              logger.debug(null, 'Auto-play prevented:', error);
              setVideoPlaying(false);
            });
          } else {
            // Video is out of viewport - pause
            videoElement.pause();
            setVideoPlaying(false);
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of video is visible
      }
    );

    observerRef.current.observe(videoElement);

    return () => {
      if (observerRef.current && videoElement) {
        observerRef.current.unobserve(videoElement);
      }
    };
  }, [mediaItems]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setVideoMuted(!videoMuted);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setVideoPlaying(true);
      } else {
        videoRef.current.pause();
        setVideoPlaying(false);
      }
    }
  };

  const handleShowControls = () => {
    setShowControls(true);
    
    // Clear existing timeout
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    // Auto-hide controls after 3 seconds
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleHideControls = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const nextImage = () => {
    setSlideDirection('right');
    setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
  };

  const prevImage = () => {
    setSlideDirection('left');
    setCurrentIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  };

  const goToImage = (index) => {
    setSlideDirection(index > currentIndex ? 'right' : 'left');
    setCurrentIndex(index);
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
      {/* Main Media */}
      <div className={`${inFullscreen ? 'max-w-[90vw] max-h-[90vh]' : mediaItems.length === 1 ? 'w-full' : 'w-full aspect-video'} overflow-hidden relative`}>
        <div 
          key={currentIndex}
          className="flex transition-transform duration-500 ease-in-out h-full"
          style={{ 
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {mediaItems.map((item, index) => (
            <div
              key={`media-${index}`}
              className="w-full h-full flex-shrink-0"
              style={{ minWidth: '100%' }}
            >
              {item.type === 'video' ? (
                <div 
                  className="relative w-full h-full"
                  onMouseEnter={mediaItems.length === 1 && !inFullscreen ? handleShowControls : undefined}
                  onMouseLeave={mediaItems.length === 1 && !inFullscreen ? handleHideControls : undefined}
                  onMouseMove={mediaItems.length === 1 && !inFullscreen ? handleShowControls : undefined}
                  onTouchStart={mediaItems.length === 1 && !inFullscreen ? handleShowControls : undefined}
                >
                  <video
                    ref={mediaItems.length === 1 && index === 0 ? videoRef : null}
                    src={item.url}
                    poster={item.thumbnail}
                    className={`${
                      inFullscreen 
                        ? 'max-w-full max-h-full object-contain mx-auto' 
                        : mediaItems.length === 1
                          ? 'w-full object-contain'
                          : 'w-full h-full object-cover'
                    } rounded-none sm:rounded-lg`}
                    controls={mediaItems.length > 1 || inFullscreen}
                    autoPlay={mediaItems.length === 1 && !inFullscreen}
                    playsInline
                    preload="metadata"
                    loop={mediaItems.length === 1}
                    muted={mediaItems.length === 1}
                    onPlay={() => mediaItems.length === 1 && setVideoPlaying(true)}
                    onPause={() => mediaItems.length === 1 && setVideoPlaying(false)}
                    onClick={(e) => {
                      if (mediaItems.length === 1 && !inFullscreen) {
                        e.preventDefault();
                        togglePlay();
                      }
                    }}
                  />
                  
                  {/* Custom Controls - Only show for single video in feed view */}
                  {mediaItems.length === 1 && !inFullscreen && (
                    <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                      showControls ? 'opacity-100' : 'opacity-0'
                    }`}>
                      {/* Play/Pause Button - Center */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay();
                        }}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-4 rounded-full transition-all pointer-events-auto"
                        aria-label={videoPlaying ? "Pause video" : "Play video"}
                      >
                        {videoPlaying ? (
                          <Pause className="w-8 h-8" />
                        ) : (
                          <Play className="w-8 h-8" />
                        )}
                      </button>

                      {/* Mute/Unmute Button - Bottom Right */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute();
                        }}
                        className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-all pointer-events-auto"
                        aria-label={videoMuted ? "Unmute video" : "Mute video"}
                      >
                        {videoMuted ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <img
                  src={item.url}
                  alt={`${alt} ${index + 1}`}
                  className={`${
                    inFullscreen 
                      ? 'max-w-full max-h-full object-contain mx-auto' 
                      : mediaItems.length === 1
                        ? 'w-full object-contain'
                        : 'w-full h-full object-cover'
                  } rounded-none sm:rounded-lg`}
                  style={{ 
                    cursor: inFullscreen ? 'default' : 'pointer',
                    imageOrientation: 'from-image'
                  }}
                  onClick={() => !inFullscreen && setIsFullscreen(true)}
                  onError={(e) => {
                    logger.error(null, '❌ Image failed to load:', item.url);
                    logger.error(null, 'Error details:', e);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows - Only show if more than 1 item */}
      {mediaItems.length > 1 && (
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

      {/* Fullscreen Button - Only in normal view and not for single videos */}
      {!inFullscreen && !(mediaItems.length === 1 && mediaItems[0].type === 'video') && (
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
      {mediaItems.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {mediaItems.map((_, index) => (
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
              aria-label={`Go to item ${index + 1}`}
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
          {mediaItems.length > 1 && (
            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm z-10">
              {currentIndex + 1} / {mediaItems.length}
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
