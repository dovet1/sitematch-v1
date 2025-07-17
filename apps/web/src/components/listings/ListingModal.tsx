'use client';

import { SimplifiedListingModal } from './SimplifiedListingModal';
import { ListingModalProps } from '@/types/search';

// Export the simplified modal as the main ListingModal 
export function ListingModal(props: ListingModalProps) {
  return <SimplifiedListingModal {...props} />;
}