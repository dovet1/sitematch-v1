'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SimpleMobileBottomSheetProps {
  peekContent: React.ReactNode;
  fullContent: React.ReactNode;
  onDismiss?: () => void;
}

export function SimpleMobileBottomSheet({ peekContent, fullContent, onDismiss }: SimpleMobileBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasBeenExpanded, setHasBeenExpanded] = useState(false);

  useEffect(() => {
    if (isExpanded && !hasBeenExpanded) {
      setHasBeenExpanded(true);
    }
  }, [isExpanded, hasBeenExpanded]);

  return (
    <div className={cn(
      "fixed left-0 right-0 bg-white z-[10001] transition-all duration-500 ease-out flex flex-col",
      "shadow-[0_-4px_20px_rgba(0,0,0,0.1)]",
      isExpanded ? "bottom-0 top-[10vh]" : "bottom-0 h-[88px]"
    )}>
      {/* Handle Area */}
      <div className="flex-shrink-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full py-4 px-6",
            "transition-all duration-200",
            "hover:bg-gray-50/50",
            "group"
          )}
          aria-label={isExpanded ? 'Minimize bottom sheet' : 'Expand bottom sheet'}
        >
          <div className="flex flex-col items-center gap-2">
            {/* Handle bar */}
            <div className="w-12 h-1 rounded-full bg-gray-300" />
            
            {/* Text with icon */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                {isExpanded ? 'Tap to minimize' : 'Tap to see full requirements'}
              </span>
              <svg 
                className={cn(
                  "w-4 h-4 text-gray-500 transition-transform duration-300",
                  isExpanded ? "rotate-180" : "rotate-0"
                )}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Pulse indicator for first-time users */}
          {!hasBeenExpanded && !isExpanded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 animate-ping" />
            </div>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className={cn(
        "flex-1 overflow-hidden bg-gray-50",
        isExpanded ? "opacity-100" : "opacity-0"
      )}>
        {isExpanded ? fullContent : peekContent}
      </div>

      {/* Add custom shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(200%);
          }
        }
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}