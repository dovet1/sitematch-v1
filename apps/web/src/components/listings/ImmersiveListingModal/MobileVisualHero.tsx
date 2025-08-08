'use client';

import React from 'react';
import { EnhancedListingModalContent } from '@/types/search';
import { MobileMediaViewer } from './MobileMediaViewer';
import { cn } from '@/lib/utils';
import styles from './MobileVisualHero.module.css';

interface MobileVisualHeroProps {
  listing: EnhancedListingModalContent | null;
  isLoading: boolean;
  className?: string;
  onAddLocations?: () => void;
}

export function MobileVisualHero({ listing, isLoading, className, onAddLocations }: MobileVisualHeroProps) {
  return (
    <MobileMediaViewer 
      listing={listing} 
      isLoading={isLoading} 
      className={cn("h-full", className)}
      onAddLocations={onAddLocations}
    />
  );
}