'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface RevealWrapperProps {
  children: ReactNode;
  delay?: number;
}

export function RevealWrapper({ children, delay = 0 }: RevealWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{
        opacity: { duration: 0.6, ease: 'easeOut', delay },
        y: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay },
      }}
    >
      {children}
    </motion.div>
  );
}
