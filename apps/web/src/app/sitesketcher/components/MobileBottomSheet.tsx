'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onToggle: () => void;
  height: 'collapsed' | 'halfway' | 'expanded';
  onHeightChange: (height: 'collapsed' | 'halfway' | 'expanded') => void;
  children: React.ReactNode;
  className?: string;
}

export function MobileBottomSheet({
  isOpen = true, // Default to open
  onToggle,
  height,
  onHeightChange,
  children,
  className
}: MobileBottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  
  // Height configurations - Optimized for mobile UX
  const COLLAPSED_HEIGHT = 80; // px - Always visible peek
  const HALFWAY_HEIGHT = 0.5; // 50% of viewport - Middle position
  const EXPANDED_HEIGHT = 0.9; // 90% of viewport - Full screen
  const DRAG_THRESHOLD = 60; // px to trigger state change

  const getTranslateY = () => {
    if (height === 'collapsed') return `calc(100% - ${COLLAPSED_HEIGHT}px)`;
    if (height === 'halfway') return `${(1 - HALFWAY_HEIGHT) * 100}%`;
    return `${(1 - EXPANDED_HEIGHT) * 100}%`;
  };

  const handleDragStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentTranslateY(0);
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - dragStartY;
    setCurrentTranslateY(deltaY);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Determine if we should change state based on drag distance and velocity
    if (Math.abs(currentTranslateY) > DRAG_THRESHOLD) {
      if (currentTranslateY > 0) {
        // Dragging down
        if (height === 'expanded') {
          // Fast swipe down from expanded goes to collapsed, slower goes to halfway
          const velocity = Math.abs(currentTranslateY) / DRAG_THRESHOLD;
          onHeightChange(velocity > 2 ? 'collapsed' : 'halfway');
        } else if (height === 'halfway') {
          onHeightChange('collapsed');
        }
      } else {
        // Dragging up
        if (height === 'collapsed') {
          // Fast swipe up from collapsed goes to expanded, slower goes to halfway
          const velocity = Math.abs(currentTranslateY) / DRAG_THRESHOLD;
          onHeightChange(velocity > 2 ? 'expanded' : 'halfway');
        } else if (height === 'halfway') {
          onHeightChange('expanded');
        }
      }
    }
    
    setCurrentTranslateY(0);
  };

  // Store height preference in session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sitesketcher-mobile-height', height);
    }
  }, [height]);

  // Restore height preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHeight = sessionStorage.getItem('sitesketcher-mobile-height');
      if (savedHeight === 'expanded' || savedHeight === 'halfway' || savedHeight === 'collapsed') {
        onHeightChange(savedHeight);
      }
    }
  }, [onHeightChange]);

  return (
    <>
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden",
          "bg-white border-t shadow-2xl",
          "transition-transform duration-300 ease-out",
          "rounded-t-2xl", // Added rounded corners for modern look
          isDragging && "transition-none",
          className
        )}
        style={{
          transform: `translateY(${isDragging ? `calc(${getTranslateY()} + ${currentTranslateY}px)` : getTranslateY()})`,
          height: height === 'expanded' ? '90vh' : height === 'halfway' ? '50vh' : 'auto',
          minHeight: `${COLLAPSED_HEIGHT}px`,
          maxHeight: '90vh'
        }}
      >
        {/* Drag Handle - More prominent */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          style={{ touchAction: 'none' }}
        >
          <div className="w-16 h-1.5 bg-gray-400 rounded-full transition-colors duration-200 hover:bg-gray-600" />
        </div>
        
        {/* Content */}
        <div 
          className="overflow-y-auto px-4 pb-6 touch-auto"
          style={{ 
            maxHeight: height === 'expanded' ? 'calc(90vh - 48px)' : 
                      height === 'halfway' ? 'calc(50vh - 48px)' : 
                      `${COLLAPSED_HEIGHT - 48}px`,
            touchAction: 'auto'
          }}
        >
          {height === 'collapsed' && (
            <div className="text-center text-sm text-gray-600 py-2">
              Swipe up for more controls
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}