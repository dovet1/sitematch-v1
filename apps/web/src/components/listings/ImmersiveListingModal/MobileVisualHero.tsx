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
  onAddSitePlans?: () => void;
  onAddFitOuts?: () => void;
  onDeleteSitePlan?: (index: number, file: any) => void;
  onDeleteFitOut?: (index: number, file: any) => void;
}

export function MobileVisualHero({ listing, isLoading, className, onAddLocations, onAddSitePlans, onAddFitOuts, onDeleteSitePlan, onDeleteFitOut }: MobileVisualHeroProps) {
  return (
    <MobileMediaViewer 
      listing={listing} 
      isLoading={isLoading} 
      className={cn("h-full", className)}
      onAddLocations={onAddLocations}
      onAddSitePlans={onAddSitePlans}
      onAddFitOuts={onAddFitOuts}
      onDeleteSitePlan={onDeleteSitePlan}
      onDeleteFitOut={onDeleteFitOut}
    />
  );
}