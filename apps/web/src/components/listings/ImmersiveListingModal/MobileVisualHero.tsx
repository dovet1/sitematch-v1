'use client';

import React from 'react';
import { EnhancedListingModalContent } from '@/types/search';
import { VisualHeroSection } from './components/VisualHeroSection';
import { cn } from '@/lib/utils';
import styles from './MobileVisualHero.module.css';

interface MobileVisualHeroProps {
  listing: EnhancedListingModalContent | null;
  isLoading: boolean;
  className?: string;
}

export function MobileVisualHero({ listing, isLoading, className }: MobileVisualHeroProps) {
  return (
    <div className={cn(styles.container, className)}>
      <VisualHeroSection listing={listing} isLoading={isLoading} />
    </div>
  );
}