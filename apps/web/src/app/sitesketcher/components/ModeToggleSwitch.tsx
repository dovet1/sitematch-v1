'use client';

import { cn } from '@/lib/utils';
import { Pencil, MousePointer } from 'lucide-react';
import type { DrawingMode } from '@/types/sitesketcher';

interface ModeToggleSwitchProps {
  mode: DrawingMode;
  onToggle: () => void;
  className?: string;
  size?: 'default' | 'large';
  showLabels?: boolean;
}

export function ModeToggleSwitch({ 
  mode, 
  onToggle, 
  className,
  size = 'default',
  showLabels = true
}: ModeToggleSwitchProps) {
  const isDrawMode = mode === 'draw';
  
  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative inline-flex items-center rounded-full p-1 group",
        "bg-gradient-to-r transition-all duration-500 ease-out",
        isDrawMode 
          ? "from-violet-100 to-violet-50 hover:from-violet-200 hover:to-violet-100" 
          : "from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        isDrawMode ? "focus:ring-violet-300" : "focus:ring-orange-300",
        showLabels 
          ? (size === 'large' ? "h-14 w-48" : "h-10 w-40")
          : (size === 'large' ? "h-12 w-24" : "h-8 w-20"),
        className
      )}
      role="switch"
      aria-checked={isDrawMode}
      aria-label={`Switch to ${isDrawMode ? 'select' : 'draw'} mode`}
      data-mode={mode}
    >
      {/* Labels Container - Fixed positioning */}
      <div className="relative w-full h-full">
        {/* Select mode label - Left side */}
        <div className={cn(
          showLabels ? "absolute left-3 top-1/2 -translate-y-1/2 z-10" : "absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10",
          "flex items-center gap-1.5 transition-all duration-500 ease-out",
          !isDrawMode ? "opacity-100 scale-100" : "opacity-40 scale-90"
        )}>
          <MousePointer className={cn(
            size === 'large' ? "h-5 w-5" : "h-4 w-4",
            "transition-colors duration-300",
            !isDrawMode ? "text-orange-600" : "text-gray-500 group-hover:text-gray-600"
          )} />
          {showLabels && (
            <span className={cn(
              "font-medium transition-colors duration-300",
              size === 'large' ? "text-base" : "text-sm",
              !isDrawMode ? "text-gray-700" : "text-gray-500"
            )}>
              Select
            </span>
          )}
        </div>

        {/* Draw mode label - Right side */}
        <div className={cn(
          showLabels ? "absolute right-3 top-1/2 -translate-y-1/2 z-10" : "absolute right-1/4 top-1/2 translate-x-1/2 -translate-y-1/2 z-10",
          "flex items-center gap-1.5 transition-all duration-500 ease-out",
          isDrawMode ? "opacity-100 scale-100" : "opacity-40 scale-90"
        )}>
          {showLabels && (
            <span className={cn(
              "font-medium transition-colors duration-300",
              size === 'large' ? "text-base" : "text-sm",
              isDrawMode ? "text-gray-700" : "text-gray-500"
            )}>
              Draw
            </span>
          )}
          <Pencil className={cn(
            size === 'large' ? "h-5 w-5" : "h-4 w-4",
            "transition-colors duration-300",
            isDrawMode ? "text-violet-600" : "text-gray-500 group-hover:text-gray-600"
          )} />
        </div>
      </div>

      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute top-1 bottom-1 rounded-full",
          "bg-white shadow-lg transition-all duration-500 ease-out",
          "border border-gray-100",
          size === 'large' ? "w-[48%]" : "w-[48%]"
        )}
        style={{
          left: isDrawMode ? '51%' : '3px',
          boxShadow: isDrawMode 
            ? '0 4px 6px -1px rgba(139, 92, 246, 0.3), 0 2px 4px -1px rgba(139, 92, 246, 0.2)' 
            : '0 4px 6px -1px rgba(251, 146, 60, 0.3), 0 2px 4px -1px rgba(251, 146, 60, 0.2)'
        }}
      >
        {/* Inner glow effect */}
        <div className={cn(
          "absolute inset-0 rounded-full opacity-50",
          "transition-all duration-500",
          isDrawMode ? "bg-violet-100" : "bg-orange-100"
        )} />
      </div>
    </button>
  );
}