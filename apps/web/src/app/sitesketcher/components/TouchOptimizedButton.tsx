'use client';

import { forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TouchOptimizedButtonProps extends ButtonProps {
  minSize?: number;
  visualFeedback?: 'scale' | 'color';
}

export const TouchOptimizedButton = forwardRef<
  HTMLButtonElement,
  TouchOptimizedButtonProps
>(({ 
  minSize = 44, 
  visualFeedback = 'scale', 
  className, 
  children,
  ...props 
}, ref) => {
  return (
    <Button
      ref={ref}
      className={cn(
        'touch-target relative transition-all',
        visualFeedback === 'scale' && 'active:scale-95',
        visualFeedback === 'color' && 'active:bg-primary/90',
        className
      )}
      style={{
        minWidth: `${minSize}px`,
        minHeight: `${minSize}px`,
      }}
      {...props}
    >
      {children}
    </Button>
  );
});

TouchOptimizedButton.displayName = 'TouchOptimizedButton';