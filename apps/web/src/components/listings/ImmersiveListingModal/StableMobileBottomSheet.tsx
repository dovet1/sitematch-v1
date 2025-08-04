'use client';

import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import { cn } from '@/lib/utils';
import styles from './MobileBottomSheet.module.css';

export type BottomSheetPosition = 'peek' | 'full';

interface StableMobileBottomSheetProps {
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  contentClassName?: string;
}

const SNAP_POINTS = {
  peek: 0.2,  // 20vh
  full: 0.9,  // 90vh
};

export const StableMobileBottomSheet = forwardRef<HTMLDivElement, StableMobileBottomSheetProps>(
  ({ children, onDismiss, className, contentClassName }, ref) => {
    // This state is completely isolated and won't be affected by parent re-renders
    const [position, setPosition] = useState<BottomSheetPosition>('peek');
    const containerRef = useRef<HTMLDivElement>(null);

    // Convert position to viewport height percentage
    const getHeightFromPosition = (pos: BottomSheetPosition) => {
      return SNAP_POINTS[pos] * window.innerHeight;
    };

    // Spring animation for smooth transitions
    const [{ y }, api] = useSpring(() => ({
      y: window.innerHeight - getHeightFromPosition('peek'),
      config: config.gentle,
    }));

    // Update animation when position changes
    useEffect(() => {
      const targetY = window.innerHeight - getHeightFromPosition(position);
      api.start({ y: targetY });
    }, [position, api]);

    // Handle window resize
    useEffect(() => {
      const handleResize = () => {
        const targetY = window.innerHeight - getHeightFromPosition(position);
        api.start({ y: targetY, immediate: true });
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [position, api]);

    const togglePosition = () => {
      setPosition(prev => prev === 'peek' ? 'full' : 'peek');
    };

    return (
      <animated.div
        ref={containerRef}
        className={cn(styles.bottomSheet, className)}
        style={{
          transform: y.to((y) => `translateY(${y}px)`),
        }}
        data-bottom-sheet="true"
      >
        {/* Handle Area with Click Target */}
        <div className={styles.handleArea}>
          <button
            className={styles.handleButton}
            onClick={(e) => {
              e.stopPropagation();
              togglePosition();
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
            contentClassName
          )}
        >
          {children}
        </div>
      </animated.div>
    );
  }
);

StableMobileBottomSheet.displayName = 'StableMobileBottomSheet';