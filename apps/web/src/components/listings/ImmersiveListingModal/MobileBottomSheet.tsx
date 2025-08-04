'use client';

import React, { forwardRef, useState, useEffect } from 'react';
import { useBottomSheetGestures, BottomSheetPosition } from './hooks/useBottomSheetGestures';
import { cn } from '@/lib/utils';
import styles from './MobileBottomSheet.module.css';

interface MobileBottomSheetProps {
  children: React.ReactNode;
  defaultPosition?: BottomSheetPosition;
  onPositionChange?: (position: BottomSheetPosition) => void;
  onDismiss?: () => void;
  className?: string;
  contentClassName?: string;
}

export const MobileBottomSheet = forwardRef<HTMLDivElement, MobileBottomSheetProps>(
  ({ 
    children, 
    defaultPosition = 'peek',
    onPositionChange,
    onDismiss,
    className,
    contentClassName
  }, ref) => {
    const {
      containerRef,
      position,
      setPosition,
      isDragging,
      animatedStyles,
      animated,
    } = useBottomSheetGestures({
      defaultPosition,
      onPositionChange,
      onDismiss,
    });

    return (
      <animated.div
        ref={containerRef}
        className={cn(styles.bottomSheet, className)}
        style={animatedStyles}
        data-bottom-sheet="true"
      >
        {/* Handle Area with Click Target */}
        <div className={styles.handleArea}>
          <button
            className={styles.handleButton}
            onClick={(e) => {
              e.stopPropagation();
              if (position === 'peek') {
                setPosition('full');
                onPositionChange?.('full');
              } else {
                setPosition('peek');
                onPositionChange?.('peek');
              }
            }}
            aria-label={position === 'peek' ? 'Expand bottom sheet' : 'Minimize bottom sheet'}
          >
            <div className={styles.handle} />
            <div className={styles.handleLabel}>
              {position === 'peek' ? 'Tap to expand' : 'Tap to minimize'}
            </div>
          </button>
        </div>

        {/* Content Area */}
        <div 
          className={cn(
            styles.content,
            isDragging && styles.dragging,
            contentClassName
          )}
        >
          {children}
        </div>
      </animated.div>
    );
  }
);

MobileBottomSheet.displayName = 'MobileBottomSheet';