'use client';

import { ListingCardSkeleton } from './ListingCard';

export function LoadingGrid() {
  return (
    <div className="listing-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <ListingCardSkeleton key={index} />
      ))}
    </div>
  );
}