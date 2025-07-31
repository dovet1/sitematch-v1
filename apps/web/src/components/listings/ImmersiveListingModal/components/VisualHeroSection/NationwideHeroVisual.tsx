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
      
      {/* UK Map Outline with Pulse Effect */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Simplified UK outline */}
          <motion.svg 
            className="w-64 h-64 md:w-80 md:h-80"
            viewBox="0 0 400 500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Simplified UK path */}
            <path
              d="M200 50 L250 80 L300 120 L320 180 L310 240 L290 300 L270 350 L240 400 L200 420 L160 400 L130 350 L110 300 L90 240 L80 180 L100 120 L150 80 Z"
              stroke="rgb(167, 139, 250)"
              strokeWidth="2"
              fill="none"
              filter="url(#glow)"
              className="drop-shadow-lg"
            />
          </motion.svg>
          
          {/* Animated pulse rings */}
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="absolute inset-0 rounded-full border-2 border-violet-400"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
              animate={{
                scale: [0.5, 2, 2.5],
                opacity: [0.6, 0.3, 0]
              }}
              transition={{
                duration: 3,
                delay: index * 1,
                repeat: Infinity,
                ease: 'easeOut'
              }}
            />
          ))}
          
          {/* Center globe icon */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
          >
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              <Globe className="w-8 h-8 text-white" />
            </div>
          </motion.div>
        </div>
      </div>

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
        className="absolute bottom-16 left-1/2 transform -translate-x-1/2 text-center"
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
        
        {/* Additional company info if available */}
        {((company.sectors?.length ?? 0) > 0 || (company.use_classes?.length ?? 0) > 0) && (
          <motion.div
            className="mt-4 flex flex-wrap gap-2 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {company.sectors?.slice(0, 3).map((sector, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white"
              >
                {sector}
              </span>
            ))}
            {company.use_classes?.slice(0, 2).map((useClass, index) => (
              <span 
                key={`uc-${index}`}
                className="px-2 py-1 bg-violet-500/30 backdrop-blur-sm rounded-full text-xs text-white"
              >
                {useClass}
              </span>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}