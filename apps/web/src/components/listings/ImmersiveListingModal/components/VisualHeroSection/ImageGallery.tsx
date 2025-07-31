import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image as ImageIcon, FileText } from 'lucide-react';

interface ImageFile {
  id: string;
  name: string;
  url: string;
  caption?: string;
}

interface ImageGalleryProps {
  images: ImageFile[];
  type: 'fit-outs' | 'site-plans';
}

export function ImageGallery({ images, type }: ImageGalleryProps) {
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
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          {type === 'fit-outs' ? (
            <ImageIcon className="w-16 h-16 text-violet-300 mx-auto mb-4" />
          ) : (
            <FileText className="w-16 h-16 text-violet-300 mx-auto mb-4" />
          )}
          <p className="text-violet-200">
            No {type === 'fit-outs' ? 'fit-out examples' : 'site plans'} available
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
            
            <img
              src={currentImage.url}
              alt={currentImage.name || `${type} ${currentIndex + 1}`}
              className="w-full h-full object-cover"
              onLoad={() => handleImageLoad(currentImage.id)}
              style={{ display: imageLoaded[currentImage.id] ? 'block' : 'none' }}
            />
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
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

      {/* Image Info Overlay */}
      <motion.div
        className="absolute bottom-6 left-6 right-6 z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="bg-white/20 backdrop-blur-md rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            {type === 'fit-outs' ? (
              <ImageIcon className="w-4 h-4 text-white" />
            ) : (
              <FileText className="w-4 h-4 text-white" />
            )}
            <span className="text-white text-sm font-medium">
              {type === 'fit-outs' ? 'Fit-Out Example' : 'Site Plan'}
            </span>
          </div>
          
          {currentImage.name && (
            <h4 className="text-white font-medium mb-1">
              {currentImage.name}
            </h4>
          )}
          
          {currentImage.caption && (
            <p className="text-white/80 text-sm">
              {currentImage.caption}
            </p>
          )}
        </div>
      </motion.div>

      {/* Image Counter */}
      {images.length > 1 && (
        <motion.div
          className="absolute top-6 right-6 z-10 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <span className="text-white text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </span>
        </motion.div>
      )}

      {/* Thumbnail Strip (for desktop) */}
      {images.length > 1 && (
        <div className="absolute bottom-20 left-6 right-6 z-10 hidden md:block">
          <div className="flex gap-2 justify-center">
            {images.map((image, index) => (
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
                  src={image.url}
                  alt={`${type} ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}