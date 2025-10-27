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
  onAddPhotos?: () => void;
  onAddVideos?: () => void;
  onDeletePhoto?: (index: number, file: any) => void;
  onDeleteVideo?: (index: number, file: any) => void;
}

export function MobileVisualHero({ listing, isLoading, className, onAddLocations, onAddPhotos, onAddVideos, onDeletePhoto, onDeleteVideo }: MobileVisualHeroProps) {
  return (
    <MobileMediaViewer
      listing={listing}
      isLoading={isLoading}
      className={cn("h-full", className)}
      onAddLocations={onAddLocations}
      onAddPhotos={onAddPhotos}
      onAddVideos={onAddVideos}
      onDeletePhoto={onDeletePhoto}
      onDeleteVideo={onDeleteVideo}
    />
  );
}