import React from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

interface Company {
  name: string;
  sectors?: string[];
  use_classes?: string[];
}

interface NationwideHeroVisualProps {
  company: Company;
}

export function NationwideHeroVisual({ company }: NationwideHeroVisualProps) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Animated gradient background */}
      <motion.div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 50%, var(--violet-500, #8b5cf6) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, var(--violet-600, #7c3aed) 0%, transparent 50%),
            radial-gradient(circle at 40% 20%, var(--violet-700, #6d28d9) 0%, transparent 50%)
          `
        }}
        animate={{
          rotate: [0, 180, 360],
          scale: [1, 1.1, 1]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
      

      {/* Floating particles */}
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

      {/* Text overlay */}
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Globe className="w-8 h-8 text-violet-300 mx-auto mb-3" />
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Nationwide Coverage
        </h3>
        <p className="text-violet-200 text-sm md:text-base">
          Open to opportunities across the UK
        </p>
      </motion.div>
    </div>
  );
}