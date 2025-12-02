'use client';

import { motion, PanInfo, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

export type SheetHeight = 'collapsed' | 'halfway' | 'expanded';

interface MobileBottomSheetProps {
  open: boolean;
  height: SheetHeight;
  onHeightChange: (height: SheetHeight) => void;
  children: React.ReactNode;
  className?: string;
}

const SHEET_HEIGHTS = {
  collapsed: 80,  // Just enough to show summary
  halfway: 40,     // 40% of screen
  expanded: 85,    // Almost full screen
};

export function MobileBottomSheet({
  open,
  height,
  onHeightChange,
  children,
  className = '',
}: MobileBottomSheetProps) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const y = useMotionValue(0);

  // Update viewport height on mount and resize
  useEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Calculate pixel heights from percentages
  const heights = {
    collapsed: viewportHeight - SHEET_HEIGHTS.collapsed,
    halfway: viewportHeight * (1 - SHEET_HEIGHTS.halfway / 100),
    expanded: viewportHeight * (1 - SHEET_HEIGHTS.expanded / 100),
  };

  // Animate to target height when height prop changes
  useEffect(() => {
    if (viewportHeight > 0) {
      animate(y, heights[height], {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      });
    }
  }, [height, heights, y, viewportHeight]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const velocity = info.velocity.y;
    const currentY = y.get();

    // Determine target height based on drag direction and velocity
    if (velocity > 500) {
      // Fast swipe down
      if (height === 'expanded') {
        onHeightChange('halfway');
      } else if (height === 'halfway') {
        onHeightChange('collapsed');
      }
    } else if (velocity < -500) {
      // Fast swipe up
      if (height === 'collapsed') {
        onHeightChange('halfway');
      } else if (height === 'halfway') {
        onHeightChange('expanded');
      }
    } else {
      // Slow drag - snap to nearest
      const distanceToCollapsed = Math.abs(currentY - heights.collapsed);
      const distanceToHalfway = Math.abs(currentY - heights.halfway);
      const distanceToExpanded = Math.abs(currentY - heights.expanded);

      const minDistance = Math.min(
        distanceToCollapsed,
        distanceToHalfway,
        distanceToExpanded
      );

      if (minDistance === distanceToCollapsed) {
        onHeightChange('collapsed');
      } else if (minDistance === distanceToHalfway) {
        onHeightChange('halfway');
      } else {
        onHeightChange('expanded');
      }
    }
  };

  // Backdrop opacity based on sheet position
  const backdropOpacity = useTransform(
    y,
    [heights.expanded, heights.halfway, heights.collapsed],
    [0.4, 0.2, 0]
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black pointer-events-none z-40"
        style={{ opacity: backdropOpacity }}
      />

      {/* Sheet */}
      <motion.div
        className={`fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 ${className}`}
        style={{
          y,
          height: viewportHeight,
        }}
        drag="y"
        dragConstraints={{
          top: heights.expanded,
          bottom: heights.collapsed,
        }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
      >
        {/* Drag Handle */}
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        <div
          className="pt-8 h-full overflow-y-auto overscroll-contain"
          onTouchStart={(e) => {
            // Prevent scroll pass-through to elements below
            const element = e.currentTarget;
            const scrollTop = element.scrollTop;
            const scrollHeight = element.scrollHeight;
            const height = element.clientHeight;
            const isAtTop = scrollTop === 0;
            const isAtBottom = scrollTop + height >= scrollHeight;

            // If at top and trying to scroll up, or at bottom and trying to scroll down, prevent
            if ((isAtTop && scrollTop < 0) || (isAtBottom && scrollTop > scrollHeight - height)) {
              e.preventDefault();
            }
          }}
        >
          {children}
        </div>
      </motion.div>
    </>
  );
}
