import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image as ImageIcon, FileText } from 'lucide-react';

interface ImageFile {
  id: string;
  name: string;
  url: string;
  caption?: string;
}

interface SimpleImageGalleryProps {
  images: ImageFile[];
  type: 'fit-outs' | 'site-plans';
  onImageClick?: (index: number) => void;
}

export function SimpleImageGallery({ images, type, onImageClick }: SimpleImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<{ [key: string]: boolean }>({});

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleImageLoad = (imageId: string) => {
    setImageLoaded(prev => ({ ...prev, [imageId]: true }));
  };

  if (!images || images.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white">
        <div className="text-center">
          {type === 'fit-outs' ? (
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          ) : (
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          )}
          <p className="text-gray-600">
            No {type === 'fit-outs' ? 'fit-out examples' : 'site plans'} available
          </p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div 
      className="relative h-full w-full overflow-hidden bg-gray-100 cursor-pointer"
      onClick={() => onImageClick?.(currentIndex)}
    >
      {/* Main Image Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Image Container */}
          <div className="relative h-full w-full flex items-center justify-center p-4">
            {!imageLoaded[currentImage.id] && (
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full"
                />
              </div>
            )}
            
            <img
              src={currentImage.url}
              alt={currentImage.name || `${type} ${currentIndex + 1}`}
              className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
              onLoad={() => handleImageLoad(currentImage.id)}
              style={{ display: imageLoaded[currentImage.id] ? 'block' : 'none' }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10
                     bg-white/90 hover:bg-white shadow-lg rounded-full p-3
                     text-gray-700 transition-all duration-200"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10
                     bg-white/90 hover:bg-white shadow-lg rounded-full p-3
                     text-gray-700 transition-all duration-200"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Image Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            {currentImage.name && (
              <h3 className="text-gray-900 font-medium truncate">
                {currentImage.name}
              </h3>
            )}
            {currentImage.caption && currentImage.caption !== currentImage.name && (
              <p className="text-gray-600 text-sm mt-1 truncate">
                {currentImage.caption}
              </p>
            )}
          </div>
          {images.length > 1 && (
            <div className="text-sm text-gray-500 ml-4 flex-shrink-0">
              {currentIndex + 1} of {images.length}
            </div>
          )}
        </div>
      </div>

      {/* Dot Indicators */}
      {images.length > 1 && images.length <= 10 && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-gray-700 w-6' 
                  : 'bg-gray-400 hover:bg-gray-500'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}