'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Pencil, MousePointer } from 'lucide-react';
import type { DrawingMode } from '@/types/sitesketcher';

interface ModeIndicatorProps {
  mode: DrawingMode;
  className?: string;
}

export function ModeIndicator({ mode, className }: ModeIndicatorProps) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  if (!isMobile) return null;
  
  return (
    <div className={cn(
      "fixed top-4 left-16 z-50", // Move right to avoid back button
      "bg-white/95 backdrop-blur-sm rounded-full shadow-lg px-4 py-2",
      "flex items-center gap-2 border border-gray-200",
      className
    )}>
      {mode === 'draw' ? (
        <>
          <Pencil className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">Draw Mode</span>
        </>
      ) : (
        <>
          <MousePointer className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium">Select Mode</span>
        </>
      )}
    </div>
  );
}