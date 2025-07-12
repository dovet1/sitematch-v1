'use client';

import { EnhancedListingModal } from './EnhancedListingModal';
import { ListingModalProps } from '@/types/search';

// Export the enhanced modal as the main ListingModal for backward compatibility
export function ListingModal(props: ListingModalProps) {
  return <EnhancedListingModal {...props} />;
}