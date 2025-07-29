'use client';

import { cn } from '@/lib/utils';
import type { DrawingMode } from '@/types/sitesketcher';
import { ModeToggleSwitch } from './ModeToggleSwitch';

interface FloatingModeIndicatorProps {
  mode: DrawingMode;
  onToggle: () => void;
  className?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function FloatingModeIndicator({ 
  mode, 
  onToggle,
  className,
  position = 'top-right'
}: FloatingModeIndicatorProps) {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  return (
    <div className={cn(
      "fixed z-40",
      positionClasses[position],
      "floating-mode-indicator",
      className
    )}>
      <ModeToggleSwitch 
        mode={mode}
        onToggle={onToggle}
        size="default"
        showLabels={false}
        className="shadow-xl border border-gray-200 w-24"
      />
      
      {/* Mode hint text */}
      <div className={cn(
        "mt-2 px-4 py-2 text-xs text-center rounded-lg",
        "bg-white shadow-md border",
        "transition-all duration-300",
        mode === 'draw' 
          ? "border-violet-200 text-violet-700" 
          : "border-orange-200 text-orange-700"
      )}>
        {mode === 'draw' 
          ? "Click and drag to draw" 
          : "Click to select polygons"
        }
      </div>
    </div>
  );
}