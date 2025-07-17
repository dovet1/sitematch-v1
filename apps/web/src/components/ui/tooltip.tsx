'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipProviderProps {
  children: React.ReactNode;
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  return <>{children}</>;
};

interface TooltipProps {
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  return <div className="relative inline-block">{children}</div>;
};

interface TooltipTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export const TooltipTrigger: React.FC<TooltipTriggerProps> = ({ 
  asChild = false, 
  children 
}) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  
  if (asChild) {
    return React.cloneElement(children as React.ReactElement, {
      onMouseEnter: () => setShowTooltip(true),
      onMouseLeave: () => setShowTooltip(false),
      'data-tooltip-trigger': true
    });
  }
  
  return (
    <div
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      data-tooltip-trigger
    >
      {children}
    </div>
  );
};

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
}

export const TooltipContent: React.FC<TooltipContentProps> = ({ 
  children, 
  className = '' 
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  
  React.useEffect(() => {
    const trigger = document.querySelector('[data-tooltip-trigger]');
    if (!trigger) return;
    
    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);
    
    trigger.addEventListener('mouseenter', handleMouseEnter);
    trigger.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      trigger.removeEventListener('mouseenter', handleMouseEnter);
      trigger.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
  
  if (!isVisible) return null;
  
  return (
    <div 
      className={cn(
        'absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1',
        'px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg',
        'pointer-events-none z-50 whitespace-nowrap',
        className
      )}
    >
      {children}
    </div>
  );
};