'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedFilterPillProps {
  children: React.ReactNode;
  id: string;
}

export const AnimatedFilterPill = React.forwardRef<HTMLDivElement, AnimatedFilterPillProps>(({ 
  children, 
  id 
}, ref) => (
  <motion.div
    ref={ref}
    key={id}
    initial={{ opacity: 0, x: -10, scale: 0.95 }}
    animate={{ opacity: 1, x: 0, scale: 1 }}
    exit={{ 
      opacity: 0, 
      scale: 0.95, 
      maxWidth: 0, 
      marginRight: 0,
      paddingLeft: 0,
      paddingRight: 0
    }}
    transition={{ 
      duration: 0.2, 
      ease: "easeOut",
      exit: { duration: 0.15 }
    }}
    layout
  >
    {children}
  </motion.div>
));

AnimatedFilterPill.displayName = 'AnimatedFilterPill';

interface FilterPillsContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const FilterPillsContainer: React.FC<FilterPillsContainerProps> = ({ 
  children, 
  className = '' 
}) => (
  <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    <AnimatePresence mode="popLayout">
      {children}
    </AnimatePresence>
  </div>
);