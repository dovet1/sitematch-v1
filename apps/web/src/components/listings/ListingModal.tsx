'use client';

import { ImmersiveListingModal } from './ImmersiveListingModal';
import { ListingModalProps } from '@/types/search';

// Export the immersive modal as the main ListingModal 
export function ListingModal(props: ListingModalProps) {
  return <ImmersiveListingModal {...props} />;
}