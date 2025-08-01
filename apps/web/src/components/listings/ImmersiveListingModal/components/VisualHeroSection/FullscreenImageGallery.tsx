import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImageFile {
  id: string;
  name: string;
  url: string;
  caption?: string;
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

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      {/* Main Image */}
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

      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
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