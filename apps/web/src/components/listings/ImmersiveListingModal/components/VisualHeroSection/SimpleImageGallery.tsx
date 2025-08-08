import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image as ImageIcon, FileText, Plus, Eye, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  onAddClick?: () => void;
  onDeleteImage?: (index: number, image: ImageFile) => void; // New prop for deletion
}

export function SimpleImageGallery({ images, type, onImageClick, onAddClick, onDeleteImage }: SimpleImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<{ [key: string]: boolean }>({});
  const [hasSeenFAB, setHasSeenFAB] = useState(false);

  
  // Long-press deletion states
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });

  // Mark FAB as seen after a delay for first-time users
  useEffect(() => {
    if (images.length > 0 && onAddClick) {
      const timer = setTimeout(() => {
        setHasSeenFAB(true);
      }, 2000); // Show pulsing for 2 seconds
      return () => clearTimeout(timer);
    }
  }, [images.length, onAddClick]);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleImageLoad = (imageId: string) => {
    setImageLoaded(prev => ({ ...prev, [imageId]: true }));
  };

  // Long-press handlers
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    if (!onDeleteImage) return; // Only enable long-press if deletion is supported
    
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    
    longPressTimer.current = setTimeout(() => {
      // Haptic feedback if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setSelectedImageIndex(index);
      setShowContextMenu(true);
    }, 800); // 800ms for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchMove = () => {
    // Cancel long press if user moves finger
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDeleteConfirm = () => {
    if (onDeleteImage && selectedImageIndex >= 0) {
      onDeleteImage(selectedImageIndex, images[selectedImageIndex]);
      
      // Adjust current index if needed
      if (selectedImageIndex === currentIndex && images.length > 1) {
        if (currentIndex === images.length - 1) {
          setCurrentIndex(currentIndex - 1);
        }
      } else if (selectedImageIndex < currentIndex) {
        setCurrentIndex(currentIndex - 1);
      }
    }
    
    setShowDeleteConfirm(false);
    setShowContextMenu(false);
    setSelectedImageIndex(-1);
  };

  const closeContextMenu = () => {
    setShowContextMenu(false);
    setSelectedImageIndex(-1);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  if (!images || images.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white">
        <div className="text-center max-w-xs mx-auto">
          {type === 'fit-outs' ? (
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          ) : (
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          )}
          <p className="text-gray-600 mb-6">
            No {type === 'fit-outs' ? 'fit-out examples' : 'site plans'} available
          </p>
          {onAddClick && (
            <Button
              onClick={() => {
                console.log(`SimpleImageGallery: Add ${type} button clicked`);
                onAddClick();
              }}
              className="bg-violet-600 hover:bg-violet-700 text-white transition-all duration-200 px-6 py-2.5 rounded-lg font-medium shadow-lg hover:shadow-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add {type === 'fit-outs' ? 'Fit-Out Examples' : 'Site Plans'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div 
      className="relative h-full w-full overflow-hidden bg-gray-100 cursor-pointer"
      onClick={() => onImageClick?.(currentIndex)}
      onTouchStart={(e) => handleTouchStart(e, currentIndex)}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
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


      {/* Dot Indicators */}
      {images.length > 1 && images.length <= 10 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
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

      {/* Floating Action Button (FAB) for adding more images */}
      {onAddClick && images.length > 0 && (
        <div className="absolute right-4 z-50" style={{ bottom: 'calc(88px + 16px)' }}>
          {/* Pulsing ring for first-time users */}
          {!hasSeenFAB && (
            <motion.div
              className="absolute inset-0 w-14 h-14 rounded-full bg-violet-400"
              animate={{ 
                scale: [1, 1.4, 1],
                opacity: [0.6, 0, 0.6] 
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          )}
          
          {/* Main FAB Button */}
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              setHasSeenFAB(true); // Mark as seen when clicked
              console.log(`SimpleImageGallery: Add more ${type} FAB clicked`);
              onAddClick();
            }}
            className="relative w-14 h-14 bg-violet-600 hover:bg-violet-700 
                       text-white rounded-full shadow-xl hover:shadow-2xl 
                       flex items-center justify-center
                       transition-all duration-200 hover:scale-105
                       focus:outline-none focus:ring-4 focus:ring-violet-300"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 20,
              delay: 0.3
            }}
            aria-label={`Add more ${type === 'fit-outs' ? 'fit-out examples' : 'site plans'}`}
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        </div>
      )}

      {/* Context Menu Overlay */}
      <AnimatePresence>
        {showContextMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeContextMenu}
            />
            
            {/* Context Menu */}
            <motion.div
              className="fixed z-40 bg-white rounded-2xl shadow-2xl overflow-hidden"
              style={{
                left: Math.min(touchPosition.x - 100, window.innerWidth - 220),
                top: Math.max(touchPosition.y - 100, 60),
                minWidth: '200px'
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", duration: 0.2 }}
            >
              <div className="py-2">
                <button
                  onClick={() => {
                    closeContextMenu();
                    onImageClick?.(selectedImageIndex);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">View Fullscreen</span>
                </button>
                
                <div className="h-px bg-gray-100" />
                
                <button
                  onClick={() => {
                    setShowContextMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors group"
                >
                  <Trash2 className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-600 group-hover:text-red-700">
                    Delete Image
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            
            {/* Confirmation Dialog */}
            <motion.div
              className="fixed inset-0 z-40 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", duration: 0.2 }}
              >
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Delete Image?
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  
                  {selectedImageIndex >= 0 && images[selectedImageIndex] && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {images[selectedImageIndex].name}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setSelectedImageIndex(-1);
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteConfirm}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}