import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
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

interface FullscreenImageGalleryProps {
  images: ImageFile[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function FullscreenImageGallery({ 
  images, 
  currentIndex, 
  onNavigate 
}: FullscreenImageGalleryProps) {
  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const goToPrevious = () => {
    onNavigate((currentIndex - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    onNavigate((currentIndex + 1) % images.length);
  };

  // Handle swipe gestures
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (images.length > 1) {
        goToNext();
      }
    },
    onSwipedRight: () => {
      if (images.length > 1) {
        goToPrevious();
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Check if current image is an external video
  const videoUrl = currentImage.externalUrl || currentImage.url;
  const parsed = parseVideoUrl(videoUrl);
  const isExternalVideo = parsed && (parsed.provider === 'youtube' || parsed.provider === 'vimeo');

  return (
    <div
      {...handlers}
      className="absolute inset-0 flex items-center justify-center bg-black"
    >
      {/* Main Image or Video */}
      {isExternalVideo && parsed?.embedUrl ? (
        <motion.div
          key={currentImage.id}
          className="w-full h-full flex items-center justify-center px-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <div className="w-full max-w-6xl aspect-video">
            <iframe
              src={parsed.embedUrl}
              title={currentImage.name || 'Video'}
              className="w-full h-full rounded-lg"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </motion.div>
      ) : (
        <motion.img
          key={currentImage.id}
          src={currentImage.url}
          alt={currentImage.name || 'Image'}
          className="max-w-full max-h-full object-contain"
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: '100vw',
            maxHeight: '100vh'
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        />
      )}


      {/* Image Caption */}
      {currentImage.name && (
        <div className="absolute bottom-16 left-0 right-0 z-10 flex justify-center px-4">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 max-w-2xl">
            <p className="text-white text-sm text-center">{currentImage.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}