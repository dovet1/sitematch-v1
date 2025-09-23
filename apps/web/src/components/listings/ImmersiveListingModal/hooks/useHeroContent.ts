import { useMemo } from 'react';
import { EnhancedListingModalContent } from '@/types/search';

export type HeroContentType = 'map' | 'gallery' | 'plans' | 'nationwide';

export interface HeroContentConfig {
  type: HeroContentType;
  priority: number;
  data: any;
}

export function useHeroContent(listing: EnhancedListingModalContent | null) {
  return useMemo(() => {
    if (!listing) return null;

    const contentOptions: HeroContentConfig[] = [];


    // Priority 1: Show map if locations exist, otherwise show nationwide
    if (listing.locations?.all?.length > 0) {
      contentOptions.push({
        type: 'map',
        priority: 1,
        data: listing.locations.all
      });
    } else {
      // No specific locations = nationwide coverage
      contentOptions.push({
        type: 'nationwide',
        priority: 1,
        data: listing.company
      });
    }

    // Priority 2: Show gallery if fit-out images exist
    if (listing.files?.fit_outs?.length > 0) {
      contentOptions.push({
        type: 'gallery',
        priority: 2,
        data: listing.files.fit_outs
      });
    }

    // Priority 3: Show site plans if available
    if (listing.files?.site_plans?.length > 0) {
      contentOptions.push({
        type: 'plans',
        priority: 3,
        data: listing.files.site_plans
      });
    }

    // Sort by priority and return the highest priority content
    contentOptions.sort((a, b) => a.priority - b.priority);
    
    return {
      primary: contentOptions[0],
      alternatives: contentOptions.slice(1),
      hasMultiple: contentOptions.length > 1
    };
  }, [listing]);
}