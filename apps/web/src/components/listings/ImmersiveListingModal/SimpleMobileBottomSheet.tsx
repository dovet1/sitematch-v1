'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface SimpleMobileBottomSheetProps {
  children: React.ReactNode;
  onDismiss?: () => void;
}

export function SimpleMobileBottomSheet({ children, onDismiss }: SimpleMobileBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn(
      "fixed left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[10001] transition-all duration-300 flex flex-col",
      isExpanded ? "bottom-0 top-[10vh]" : "bottom-0 h-[25vh]"
    )}>
      {/* Handle */}
      <div className="flex justify-center p-3 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors"
          aria-label={isExpanded ? 'Minimize bottom sheet' : 'Expand bottom sheet'}
        >
          <div className="w-12 h-1.5 bg-gray-400 rounded-full" />
          <span className="text-xs text-gray-500">
            {isExpanded ? 'Tap to minimize' : 'Tap To See Full Requirements'}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {children}
      </div>
    </div>
  );
}