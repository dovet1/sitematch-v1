import { useRef, useState, useCallback, useEffect } from 'react';
import { useSpring, animated, config } from '@react-spring/web';

export type BottomSheetPosition = 'peek' | 'full';

interface UseBottomSheetGesturesConfig {
  snapPoints?: {
    peek: number; // 0.2 = 20vh
    full: number; // 0.9 = 90vh
  };
  defaultPosition?: BottomSheetPosition;
  onPositionChange?: (position: BottomSheetPosition) => void;
  onDismiss?: () => void;
}

const DEFAULT_SNAP_POINTS = {
  peek: 0.2,  // 20vh - just enough to show tabs and company info
  full: 0.9,  // 90vh - nearly full screen but leave room for header
};

export function useBottomSheetGestures({
  snapPoints = DEFAULT_SNAP_POINTS,
  defaultPosition = 'peek',
  onPositionChange,
  onDismiss,
}: UseBottomSheetGesturesConfig = { snapPoints: DEFAULT_SNAP_POINTS }) {
  const [position, setPosition] = useState<BottomSheetPosition>(defaultPosition);
  const [isDragging] = useState(false); // No longer used
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert position to viewport height percentage
  const getHeightFromPosition = useCallback((pos: BottomSheetPosition) => {
    return snapPoints[pos] * window.innerHeight;
  }, [snapPoints]);

  // Spring animation for smooth transitions
  const [{ y }, api] = useSpring(() => ({
    y: window.innerHeight - getHeightFromPosition(defaultPosition),
    config: config.gentle,
  }));

  // No gesture handling - click-only interaction

  // Update animation when position changes
  useEffect(() => {
    const targetY = window.innerHeight - getHeightFromPosition(position);
    api.start({ y: targetY });
  }, [position, api, getHeightFromPosition]);

  // Programmatic position control
  const setSheetPosition = useCallback((newPosition: BottomSheetPosition) => {
    setPosition(newPosition);
    onPositionChange?.(newPosition);
  }, [onPositionChange]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const targetY = window.innerHeight - getHeightFromPosition(position);
      api.start({ y: targetY, immediate: true });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, api, getHeightFromPosition]);

  return {
    containerRef,
    position,
    setPosition: setSheetPosition,
    isDragging,
    animatedStyles: {
      transform: y.to((y) => `translateY(${y}px)`),
    },
    animated,
  };
}