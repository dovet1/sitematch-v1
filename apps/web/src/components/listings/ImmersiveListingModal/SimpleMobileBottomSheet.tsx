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
      "fixed left-0 right-0 bg-white shadow-2xl z-[10001] transition-all duration-500 ease-out flex flex-col",
      "rounded-t-[32px]", // Larger radius for more modern look
      isExpanded ? "bottom-0 top-[10vh]" : "bottom-0 h-[88px]"
    )}>
      {/* Premium Handle Area */}
      <div className={cn(
        "relative flex-shrink-0 transition-all duration-300",
        "bg-gradient-to-b from-gray-50/50 to-white",
        isExpanded && "border-b border-gray-100"
      )}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex flex-col items-center gap-2 py-4 px-6",
            "transition-all duration-200",
            "hover:bg-gray-50/50 active:bg-gray-100/50",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-inset",
            "group"
          )}
          aria-label={isExpanded ? 'Minimize bottom sheet' : 'Expand bottom sheet'}
        >
          {/* Enhanced Handle Bar */}
          <div className="relative">
            <div className={cn(
              "w-12 h-1.5 rounded-full transition-all duration-300",
              "bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300",
              "group-hover:w-16 group-hover:shadow-sm",
              "relative overflow-hidden"
            )}>
              {/* Shimmer effect */}
              <div className={cn(
                "absolute inset-0 -translate-x-full",
                "bg-gradient-to-r from-transparent via-white/50 to-transparent",
                "group-hover:animate-shimmer"
              )} />
            </div>
          </div>

          {/* Text and Chevron Container */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium transition-all duration-200",
              isExpanded ? "text-gray-600" : "text-gray-700",
              "group-hover:text-gray-900"
            )}>
              {isExpanded ? 'Tap to minimize' : 'Tap to see full requirements'}
            </span>
            
            {/* Animated Chevron */}
            <svg 
              className={cn(
                "w-4 h-4 transition-transform duration-300",
                isExpanded ? "rotate-180" : "rotate-0",
                "text-gray-400 group-hover:text-gray-600"
              )}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Pulse indicator for first-time users */}
          {!hasBeenExpanded && !isExpanded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-blue-400/20 animate-ping" />
            </div>
          )}
        </button>

        {/* Subtle shadow gradient */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-px",
          "bg-gradient-to-r from-transparent via-gray-200 to-transparent",
          "opacity-0 transition-opacity duration-300",
          isExpanded && "opacity-100"
        )} />
      </div>

      {/* Content Area with Smooth Transitions */}
      <div className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden min-h-0",
        "transition-opacity duration-300",
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