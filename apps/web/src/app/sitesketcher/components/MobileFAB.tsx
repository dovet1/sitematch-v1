'use client';

import { useState, useEffect } from 'react';
import { Pencil, MousePointer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DrawingMode } from '@/types/sitesketcher';

interface MobileFABProps {
  mode: DrawingMode;
  onModeToggle: () => void;
  className?: string;
}

export function MobileFAB({ mode, onModeToggle, className }: MobileFABProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  const handlePress = () => {
    setIsPressed(true);
    // Add haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    onModeToggle();
    setTimeout(() => setIsPressed(false), 150);
  };

  return (
    <button
      onClick={handlePress}
      className={cn(
        "fixed bottom-32 right-6 z-50",
        "w-16 h-16 rounded-full shadow-2xl",
        "flex items-center justify-center",
        "transition-all duration-200 ease-out",
        "active:scale-95",
        mode === 'draw' 
          ? "bg-blue-600 hover:bg-blue-700" 
          : "bg-gray-600 hover:bg-gray-700",
        isPressed && "scale-95",
        className
      )}
      style={{
        boxShadow: isPressed 
          ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
          : '0 8px 24px rgba(0, 0, 0, 0.2)',
      }}
      aria-label={`Switch to ${mode === 'draw' ? 'Select' : 'Draw'} Mode`}
    >
      {mode === 'draw' ? (
        <Pencil className="w-7 h-7 text-white" />
      ) : (
        <MousePointer className="w-7 h-7 text-white" />
      )}
      
      {/* Ripple effect */}
      <div className={cn(
        "absolute inset-0 rounded-full",
        "bg-white opacity-0 scale-0",
        "transition-all duration-300",
        isPressed && "opacity-30 scale-100"
      )} />
    </button>
  );
}