import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image as ImageIcon, FileText, Maximize2, X, Play } from 'lucide-react';
import { parseVideoUrl } from '@/lib/video-utils';

interface ImageFile {
  id: string;
  name: string;
  url: string;
  caption?: string;
  isExternal?: boolean;
  externalUrl?: string;
  videoProvider?: 'youtube' | 'vimeo' | 'direct';
}

interface ImageGalleryProps {
  images: ImageFile[];
  type: 'photos' | 'videos';
}

export function ImageGallery({ images, type }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<{ [key: string]: boolean }>({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoToPlay, setVideoToPlay] = useState<string | null>(null);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleImageLoad = (imageId: string) => {
    setImageLoaded(prev => ({ ...prev, [imageId]: true }));
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      } else if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  if (!images || images.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          {type === 'photos' ? (
            <ImageIcon className="w-16 h-16 text-violet-300 mx-auto mb-4" />
          ) : (
            <FileText className="w-16 h-16 text-violet-300 mx-auto mb-4" />
          )}
          <p className="text-violet-200">
            No {type === 'photos' ? 'photos' : 'videos'} available
          </p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Main Image Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
        >
          {/* Image */}
          <div className="relative h-full w-full">
            {!imageLoaded[currentImage.id] && (
              <div className="absolute inset-0 flex items-center justify-center bg-violet-800">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full"
                />
              </div>
            )}

            {/* Handle external videos (YouTube, Vimeo) */}
            {(() => {
              // Try to detect external video
              if (type === 'videos') {
                const videoUrl = currentImage.externalUrl || currentImage.url;
                const parsed = parseVideoUrl(videoUrl);

                // If it's a valid external video (YouTube, Vimeo, etc.)
                if (parsed && (parsed.provider === 'youtube' || parsed.provider === 'vimeo')) {
                  // Show YouTube thumbnail as preview image
                  if (parsed.thumbnailUrl) {
                    return (
                      <div className="relative w-full h-full cursor-pointer group" onClick={() => {
                        setVideoToPlay(parsed.embedUrl);
                        setShowVideoPlayer(true);
                      }}>
                        <img
                          src={parsed.thumbnailUrl}
                          alt={currentImage.name || `Video ${currentIndex + 1}`}
                          className="w-full h-full object-cover"
                          onLoad={() => handleImageLoad(currentImage.id)}
                          style={{ display: imageLoaded[currentImage.id] ? 'block' : 'none' }}
                        />
                        {/* Play button overlay */}
                        {imageLoaded[currentImage.id] && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                              className="bg-white/20 backdrop-blur-sm rounded-full p-6 group-hover:bg-white/30 transition-all"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Play className="w-12 h-12 text-white fill-white" />
                            </motion.div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Fallback to iframe if no thumbnail
                  return (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-full max-w-4xl aspect-video">
                        <iframe
                          src={parsed.embedUrl}
                          title={currentImage.name || `Video ${currentIndex + 1}`}
                          className="w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          onLoad={() => handleImageLoad(currentImage.id)}
                        />
                      </div>
                    </div>
                  );
                }
              }

              // Default: show as regular image
              return (
                <img
                  src={currentImage.url}
                  alt={currentImage.name || `${type} ${currentIndex + 1}`}
                  className="w-full h-full object-cover"
                  onLoad={() => handleImageLoad(currentImage.id)}
                  style={{ display: imageLoaded[currentImage.id] ? 'block' : 'none' }}
                />
              );
            })()}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      {images.length > 1 && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10
                     bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-3
                     text-white transition-all duration-200"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={nextImage}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10
                     bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-3
                     text-white transition-all duration-200"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}


      {/* Image Counter and Full Screen Button */}
      <motion.div
        className="absolute top-6 right-6 z-10 flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {images.length > 1 && (
          <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
            <span className="text-white text-sm font-medium">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        )}
        <button
          onClick={toggleFullScreen}
          className="bg-black/40 backdrop-blur-md p-2 rounded-full hover:bg-black/60 transition-colors"
          aria-label="Toggle full screen"
        >
          <Maximize2 className="w-4 h-4 text-white" />
        </button>
      </motion.div>

      {/* Thumbnail Strip (for desktop) */}
      {images.length > 1 && (
        <div className="absolute bottom-20 left-6 right-6 z-10 hidden md:block">
          <div className="flex gap-2 justify-center">
            {images.map((image, index) => {
              // Get thumbnail URL for external videos
              let thumbnailUrl = image.url;
              if (type === 'videos') {
                const videoUrl = image.externalUrl || image.url;
                const parsed = parseVideoUrl(videoUrl);
                if (parsed?.thumbnailUrl) {
                  thumbnailUrl = parsed.thumbnailUrl;
                }
              }

              return (
                <button
                  key={image.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-16 h-12 rounded overflow-hidden transition-all duration-200 ${
                    index === currentIndex
                      ? 'ring-2 ring-white scale-110'
                      : 'opacity-60 hover:opacity-80'
                  }`}
                >
                  <img
                    src={thumbnailUrl}
                    alt={`${type} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Screen Overlay */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Close Button */}
            <button
              onClick={toggleFullScreen}
              className="absolute top-6 right-6 z-50 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-3 text-white transition-all duration-200"
              aria-label="Exit full screen"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Full Screen Image */}
            <div className="relative h-full w-full flex items-center justify-center">
              {/* Handle external videos in full screen */}
              {(() => {
                if (type === 'videos') {
                  const videoUrl = currentImage.externalUrl || currentImage.url;
                  const parsed = parseVideoUrl(videoUrl);

                  if (parsed && (parsed.provider === 'youtube' || parsed.provider === 'vimeo')) {
                    // Show YouTube thumbnail in full screen
                    if (parsed.thumbnailUrl) {
                      return (
                        <img
                          src={parsed.thumbnailUrl}
                          alt={currentImage.name || `Video ${currentIndex + 1}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      );
                    }

                    // Fallback to iframe
                    return (
                      <div className="w-full max-w-6xl aspect-video">
                        <iframe
                          src={parsed.embedUrl}
                          title={currentImage.name || `Video ${currentIndex + 1}`}
                          className="w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    );
                  }
                }

                // Default: show as image
                return (
                  <img
                    src={currentImage.url}
                    alt={currentImage.name || `${type} ${currentIndex + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                );
              })()}

              {/* Navigation Controls */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-6 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-4 text-white transition-all duration-200"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  
                  <button
                    onClick={nextImage}
                    className="absolute right-6 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-4 text-white transition-all duration-200"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Image Info */}
              <div className="absolute bottom-6 left-6 right-6 text-center">
                {currentImage.name && (
                  <h3 className="text-white text-xl font-medium mb-2">
                    {currentImage.name}
                  </h3>
                )}
                {currentImage.caption && (
                  <p className="text-white/80">
                    {currentImage.caption}
                  </p>
                )}
                {images.length > 1 && (
                  <p className="text-white/60 mt-4">
                    {currentIndex + 1} of {images.length}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Player Modal */}
      <AnimatePresence>
        {showVideoPlayer && videoToPlay && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowVideoPlayer(false);
              setVideoToPlay(null);
            }}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowVideoPlayer(false);
                setVideoToPlay(null);
              }}
              className="absolute top-6 right-6 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-3 text-white transition-all duration-200"
              aria-label="Close video"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Video player */}
            <motion.div
              className="w-full max-w-6xl aspect-video mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={videoToPlay}
                title="Video player"
                className="w-full h-full rounded-lg shadow-2xl"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}