import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileBreakpoint } from '../../hooks/useMobileBreakpoint';

interface Company {
  name: string;
  sectors?: string[];
  use_classes?: string[];
}

interface NationwideHeroVisualProps {
  company: Company;
  onAddLocations?: () => void;
}

export function NationwideHeroVisual({ company, onAddLocations }: NationwideHeroVisualProps) {
  const { isMobile } = useMobileBreakpoint();
  return (
    <div className={cn(
      "relative h-full w-full overflow-hidden",
      isMobile && "min-h-full bg-violet-900"
    )}>
      {/* Static/Animated gradient background */}
      <motion.div 
        className={cn(
          "absolute inset-0",
          isMobile && "min-h-full bg-gradient-to-br from-violet-900 via-violet-700 to-violet-800"
        )}
        style={{
          background: isMobile ? undefined : `
            radial-gradient(circle at 20% 50%, var(--violet-500, #8b5cf6) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, var(--violet-600, #7c3aed) 0%, transparent 50%),
            radial-gradient(circle at 40% 20%, var(--violet-700, #6d28d9) 0%, transparent 50%)
          `
        }}
        animate={!isMobile ? {
          rotate: [0, 180, 360],
          scale: [1, 1.1, 1]
        } : {}}
        transition={!isMobile ? {
          duration: 20,
          repeat: Infinity,
          ease: 'linear'
        } : {}}
      />
      

      {/* Floating particles - disabled on mobile for static background */}
      {!isMobile && (
        <div className="absolute inset-0">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          ))}
        </div>
      )}

      {/* Text overlay - centered between tabs and bottom sheet on mobile */}
      <motion.div 
        className={cn(
          "absolute inset-0 flex flex-col items-center text-center",
          isMobile ? "justify-center" : "justify-center"
        )}
        style={isMobile ? {
          // Center between tabs (~48px) and bottom sheet (88px)
          // Total available space = screen height - 48px (tabs) - 88px (bottom sheet)
          // Top offset accounts for tab height, bottom offset accounts for bottom sheet
          marginTop: '48px',
          marginBottom: '88px'
        } : undefined}
        initial={!isMobile ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={!isMobile ? { delay: 0.7 } : {}}
      >
        <Globe className="w-8 h-8 text-violet-300 mx-auto mb-3" />
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Nationwide Coverage
        </h3>
        <p className="text-violet-200 text-sm md:text-base mb-6">
          Open to opportunities across the UK
        </p>
        
        {/* Add Locations button - only on mobile */}
        {isMobile && onAddLocations && (
          <motion.button
            onClick={onAddLocations}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-white font-medium transition-all duration-200 hover:bg-white/20 hover:border-white/30 active:scale-95 cursor-pointer relative z-50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ minHeight: '44px', minWidth: '44px', touchAction: 'manipulation' }}
          >
            <Plus className="w-5 h-5" />
            Add Locations
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}