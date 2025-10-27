'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, MapPin, FileText, Home, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { InteractiveMapView } from './components/VisualHeroSection/InteractiveMapView';
import { NationwideHeroVisual } from './components/VisualHeroSection/NationwideHeroVisual';
import { SimpleImageGallery } from './components/VisualHeroSection/SimpleImageGallery';
import { FullscreenImageGallery } from './components/VisualHeroSection/FullscreenImageGallery';

interface MobileMediaViewerProps {
  listing: any;
  isLoading: boolean;
  className?: string;
  onAddLocations?: () => void;
  onAddPhotos?: () => void;
  onAddVideos?: () => void;
  onDeletePhoto?: (index: number, file: any) => void;
  onDeleteVideo?: (index: number, file: any) => void;
}

export function MobileMediaViewer({ listing, isLoading, className, onAddLocations, onAddPhotos, onAddVideos, onDeletePhoto, onDeleteVideo }: MobileMediaViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);
  const [fullscreenImages, setFullscreenImages] = useState<any[]>([]);
  const [customCloseHandler, setCustomCloseHandler] = useState<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if we should show map or nationwide view
  const hasLocations = listing?.locations?.all && listing.locations.all.length > 0;

  const mediaItems = [
    {
      type: 'coverage',
      label: 'Coverage',
      icon: MapPin,
      available: true,
      hasContent: hasLocations
    },
    {
      type: 'photos',
      label: 'Photos',
      icon: FileText,
      available: true, // Always show
      hasContent: listing?.files?.photos && listing.files.photos.length > 0
    },
    {
      type: 'videos',
      label: 'Videos',
      icon: Home,
      available: true, // Always show
      hasContent: listing?.files?.videos && listing.files.videos.length > 0
    }
  ]; // Remove filter - show all tabs

  // Handle swipe gestures
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeIndex < mediaItems.length - 1) {
        setActiveIndex(activeIndex + 1);
      }
    },
    onSwipedRight: () => {
      if (activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Reset active index if it's out of bounds
  useEffect(() => {
    if (activeIndex >= mediaItems.length && mediaItems.length > 0) {
      setActiveIndex(0);
    }
  }, [activeIndex, mediaItems.length]);

  // Handle escape key for fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setFullscreenImages([]);
        setFullscreenImageIndex(0);
        if (customCloseHandler) {
          customCloseHandler();
          setCustomCloseHandler(null);
        }
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFullscreen, customCloseHandler]);

  const renderMediaContent = (type: string) => {
    if (isLoading || !listing) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-gray-300 rounded-lg" />
          </div>
        </div>
      );
    }

    switch (type) {
      case 'coverage':
        if (hasLocations) {
          return (
            <InteractiveMapView
              locations={listing.locations.all}
              onMapStateChange={() => {}}
            />
          );
        } else {
          return <NationwideHeroVisual company={listing?.company || { name: 'Company' }} onAddLocations={onAddLocations} />;
        }

      case 'photos':
        const photos = listing.files?.photos?.map((file: any, index: number) => ({
          id: file.id || `photo-${index}`,
          name: file.name || 'Photo',
          url: file.url,
          caption: file.name
        })) || [];

        return (
          <SimpleImageGallery
            images={photos}
            type="photos"
            onImageClick={(index, onClose) => {
              setFullscreenImages(photos);
              setFullscreenImageIndex(index);
              setCustomCloseHandler(onClose || null);
              setIsFullscreen(true);
            }}
            onAddClick={onAddPhotos}
            onDeleteImage={onDeletePhoto ? (index, image) => {
              // Convert back to original file format for the handler
              const originalFile = listing.files?.photos?.[index];
              onDeletePhoto(index, originalFile || image);
            } : undefined}
          />
        );

      case 'videos':
        const videos = listing.files?.videos?.map((file: any, index: number) => ({
          id: file.id || `video-${index}`,
          name: file.name || 'Video',
          url: file.url || file.externalUrl,
          caption: file.name,
          isExternal: !!file.externalUrl,
          videoProvider: file.videoProvider
        })) || [];

        return (
          <SimpleImageGallery
            images={videos}
            type="videos"
            onImageClick={(index, onClose) => {
              setFullscreenImages(videos);
              setFullscreenImageIndex(index);
              setCustomCloseHandler(onClose || null);
              setIsFullscreen(true);
            }}
            onAddClick={onAddVideos}
            onDeleteImage={onDeleteVideo ? (index, image) => {
              // Convert back to original file format for the handler
              const originalFile = listing.files?.videos?.[index];
              onDeleteVideo(index, originalFile || image);
            } : undefined}
          />
        );

      default:
        return null;
    }
  };

  if (mediaItems.length === 0) {
    return (
      <div className={cn("w-full h-full bg-gray-100 flex items-center justify-center", className)}>
        <p className="text-gray-500">No media available</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full overflow-hidden", className)}
    >

      {/* Main Content Area */}
      <div className="h-full flex flex-col bg-white">
        {/* Tab Navigation */}
        <div className={cn(
          "border-b border-gray-200",
          isFullscreen && "hidden"
        )}>
          <div className="flex">
            {mediaItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "flex-1 relative py-3 px-4 text-sm font-medium transition-colors",
                    "focus:outline-none",
                    activeIndex === index
                      ? "text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {activeIndex === index && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Swipeable Content Area */}
        <div 
          {...handlers}
          className={cn(
            "relative flex-1 overflow-hidden",
            !isFullscreen && "bg-white"
          )}
          onClick={(e) => {
            // Maps don't need fullscreen - only images are handled by SimpleImageGallery
          }}
        >
          <div 
            className="flex transition-transform duration-300 h-full"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {mediaItems.map((item, index) => (
              <div key={item.type} className="w-full h-full flex-shrink-0">
                {renderMediaContent(item.type)}
              </div>
            ))}
          </div>

          {/* Dot Indicators */}
          {!isFullscreen && mediaItems.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {mediaItems.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(index);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    activeIndex === index 
                      ? "bg-white w-6 shadow-lg" 
                      : "bg-white/50"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Portal-based Fullscreen Overlay */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {isFullscreen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black"
              style={{ zIndex: 99999 }}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setIsFullscreen(false);
                  setFullscreenImages([]);
                  setFullscreenImageIndex(0);
                  if (customCloseHandler) {
                    customCloseHandler();
                    setCustomCloseHandler(null);
                  }
                }}
                className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
                style={{ zIndex: 100000 }}
                aria-label="Close fullscreen"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* Fullscreen Image Gallery */}
              <div className="w-full h-full">
                <FullscreenImageGallery
                  images={fullscreenImages}
                  currentIndex={fullscreenImageIndex}
                  onNavigate={setFullscreenImageIndex}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}