'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onToggle: () => void;
  height: 'collapsed' | 'expanded';
  onHeightChange: (height: 'collapsed' | 'expanded') => void;
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
  const EXPANDED_HEIGHT = 0.75; // 75% of viewport - Better proportions  
  const DRAG_THRESHOLD = 40; // px to trigger state change - More responsive

  const getTranslateY = () => {
    // Always show at least the collapsed height (never fully hidden)
    if (height === 'collapsed') return `calc(100% - ${COLLAPSED_HEIGHT}px)`;
    return `${(1 - EXPANDED_HEIGHT) * 100}%`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentTranslateY(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - dragStartY;
    setCurrentTranslateY(deltaY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Determine if we should change state based on drag distance
    if (Math.abs(currentTranslateY) > DRAG_THRESHOLD) {
      if (currentTranslateY > 0) {
        // Dragging down - only collapse, never fully close
        if (height === 'expanded') {
          onHeightChange('collapsed');
        }
      } else {
        // Dragging up
        if (height === 'collapsed') {
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
      if (savedHeight === 'expanded' || savedHeight === 'collapsed') {
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
          height: height === 'expanded' ? '75vh' : 'auto',
          minHeight: `${COLLAPSED_HEIGHT}px`,
          maxHeight: '85vh',
          touchAction: 'none'
        }}
      >
        {/* Drag Handle - More prominent */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-16 h-1.5 bg-gray-400 rounded-full transition-colors duration-200 hover:bg-gray-600" />
        </div>
        
        {/* Content */}
        <div 
          className="overflow-y-auto px-4 pb-6" // Increased bottom padding
          style={{ 
            maxHeight: height === 'expanded' ? 'calc(85vh - 48px)' : `${COLLAPSED_HEIGHT - 48}px` 
          }}
        >
          {height === 'collapsed' && (
            <div className="text-center text-sm text-gray-600 py-2">
              Drag up to expand
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}