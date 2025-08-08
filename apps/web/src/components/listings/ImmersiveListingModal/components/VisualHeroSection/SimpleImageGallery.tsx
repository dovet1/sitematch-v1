import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image as ImageIcon, FileText, Plus, Eye, Trash2, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';

interface ImageFile {
  id: string;
  name: string;
  url: string;
  caption?: string;
}

interface SimpleImageGalleryProps {
  images: ImageFile[];
  type: 'fit-outs' | 'site-plans';
  onImageClick?: (index: number, onClose?: () => void) => void;
  onAddClick?: () => void;
  onDeleteImage?: (index: number, image: ImageFile) => void; // New prop for deletion
}

export function SimpleImageGallery({ images, type, onImageClick, onAddClick, onDeleteImage }: SimpleImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<{ [key: string]: boolean }>({});
  const [showManageModal, setShowManageModal] = useState(false);
  const [wasFromManageModal, setWasFromManageModal] = useState(false);
  const [showManageDeleteConfirm, setShowManageDeleteConfirm] = useState(false);
  const [selectedManageImageIndex, setSelectedManageImageIndex] = useState(-1);

  
  // Long-press deletion states
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });


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

      {/* Manage Uploads Button */}
      {images.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowManageModal(true);
          }}
          className="absolute top-4 right-4 bg-violet-600 hover:bg-violet-700 backdrop-blur-sm
                     text-white rounded-lg px-3 py-2 shadow-lg
                     flex items-center gap-2 text-sm font-medium transition-all duration-200
                     hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-violet-300 z-10"
          aria-label="Manage uploads"
        >
          <Settings className="w-4 h-4" />
          Manage Uploads
        </button>
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

      {/* Portal-based Manage Uploads Modal */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {showManageModal && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black/50 z-[99998]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowManageModal(false);
                }}
              />
              
              {/* Modal */}
              <motion.div
                className="fixed inset-0 z-[99999] bg-white"
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Manage {type === 'fit-outs' ? 'Fit-Out Examples' : 'Site Plans'}
                    </h3>
                    <button
                      onClick={() => setShowManageModal(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 overflow-y-auto bg-gray-50">
                    <div className="p-6 space-y-4">
                      {/* Upload new button */}
                      {onAddClick && (
                        <Button
                          onClick={() => {
                            setShowManageModal(false);
                            onAddClick();
                          }}
                          className="w-full bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2 py-3"
                        >
                          <Plus className="w-4 h-4" />
                          Add New {type === 'fit-outs' ? 'Fit-Out Example' : 'Site Plan'}
                        </Button>
                      )}
                      
                      {/* Divider */}
                      {onAddClick && <div className="h-px bg-gray-200" />}
                      
                      {/* Image list */}
                      <div className="space-y-3">
                        {images.map((image, index) => (
                          <div
                            key={image.id}
                            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            {/* Thumbnail */}
                            <img
                              src={image.url}
                              alt={image.name}
                              className="w-12 h-12 object-cover rounded-md bg-gray-100"
                            />
                            
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {image.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                Image {index + 1} of {images.length}
                              </p>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setWasFromManageModal(true);
                                  setShowManageModal(false);
                                  // Defer the onImageClick to avoid render phase updates
                                  setTimeout(() => {
                                    onImageClick?.(index, () => {
                                      // Also defer the callback to avoid render phase updates
                                      setTimeout(() => {
                                        setShowManageModal(true);
                                        setWasFromManageModal(false);
                                      }, 0);
                                    });
                                  }, 0);
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-600 transition-colors"
                                aria-label="View fullscreen"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              
                              {onDeleteImage && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedManageImageIndex(index);
                                    setShowManageDeleteConfirm(true);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-red-600 transition-colors"
                                  aria-label="Delete image"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Manage Modal Delete Confirmation - also in portal */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {showManageDeleteConfirm && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black/50 z-[99999]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              
              {/* Confirmation Dialog */}
              <motion.div
                className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
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
                  onClick={(e) => e.stopPropagation()}
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
                    
                    {selectedManageImageIndex >= 0 && images[selectedManageImageIndex] && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {images[selectedManageImageIndex].name}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowManageDeleteConfirm(false);
                          setSelectedManageImageIndex(-1);
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (onDeleteImage && selectedManageImageIndex >= 0) {
                            onDeleteImage(selectedManageImageIndex, images[selectedManageImageIndex]);
                          }
                          setShowManageDeleteConfirm(false);
                          setSelectedManageImageIndex(-1);
                        }}
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
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}