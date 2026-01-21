/**
 * Coverage utilities for demographics analysis
 * Handles detection of geographic coverage areas and provides educational messaging
 * for regions outside current data coverage (England & Wales)
 */

export type CoverageRegion = 'england_wales' | 'scotland' | 'northern_ireland';

export interface CoverageStatus {
  isFullyCovered: boolean;
  isPartiallyCovered: boolean;
  coveredRegions: CoverageRegion[];
  primaryRegion: CoverageRegion | null;
  lsoaCount: number;
}

// LSOA code patterns by region
const REGION_PATTERNS = {
  england_wales: /^[EW]\d{8}$/,  // E01000001 or W01000001
  scotland: /^S\d{8}$/,           // S01000001
  northern_ireland: /^N\d{8}$/,   // N00000001
};

// Approximate bounding boxes for quick region detection
const REGION_BOUNDS = {
  england_wales: {
    lat: { min: 49.9, max: 55.8 },
    lng: { min: -6.4, max: 1.8 },
  },
  scotland: {
    lat: { min: 54.5, max: 61 },
    lng: { min: -8, max: -0.7 },
  },
  northern_ireland: {
    lat: { min: 54, max: 55.3 },
    lng: { min: -8.2, max: -5.4 },
  },
};

/**
 * Determine coverage status based on LSOA lookup results
 * @param lsoaCodes - Array of LSOA codes returned from PostGIS query
 * @param searchLocation - The location being searched
 * @returns Coverage status indicating if area is covered
 */
export function determineCoverageStatus(
  lsoaCodes: string[],
  searchLocation: { lat: number; lng: number; place_name?: string }
): CoverageStatus {
  if (lsoaCodes.length === 0) {
    // No LSOAs found - either outside UK or outside current coverage
    const detectedRegion = detectRegionFromCoordinates(
      searchLocation.lat,
      searchLocation.lng
    );

    return {
      isFullyCovered: false,
      isPartiallyCovered: false,
      coveredRegions: [],
      primaryRegion: detectedRegion,
      lsoaCount: 0,
    };
  }

  // Analyze LSOA codes to determine coverage
  const regions = new Set<CoverageRegion>();
  lsoaCodes.forEach((code) => {
    if (REGION_PATTERNS.england_wales.test(code)) {
      regions.add('england_wales');
    } else if (REGION_PATTERNS.scotland.test(code)) {
      regions.add('scotland');
    } else if (REGION_PATTERNS.northern_ireland.test(code)) {
      regions.add('northern_ireland');
    }
  });

  const coveredRegions = Array.from(regions);
  const hasEnglandWales = coveredRegions.includes('england_wales');

  return {
    isFullyCovered: hasEnglandWales && coveredRegions.length === 1,
    isPartiallyCovered: hasEnglandWales && coveredRegions.length > 1,
    coveredRegions,
    primaryRegion: coveredRegions[0] || null,
    lsoaCount: lsoaCodes.length,
  };
}

/**
 * Detect which region a location belongs to based on coordinates
 * Uses approximate bounding boxes for quick detection
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Likely coverage region
 */
export function detectRegionFromCoordinates(
  lat: number,
  lng: number
): CoverageRegion | null {
  // Check each region's bounding box
  for (const [region, bounds] of Object.entries(REGION_BOUNDS)) {
    if (
      lat >= bounds.lat.min &&
      lat <= bounds.lat.max &&
      lng >= bounds.lng.min &&
      lng <= bounds.lng.max
    ) {
      return region as CoverageRegion;
    }
  }

  return null;
}

/**
 * Get user-friendly coverage messages
 * @param status - Coverage status from determineCoverageStatus
 * @param locationName - Display name of location
 * @returns Messaging object with different message types
 */
export function getCoverageMessages(
  status: CoverageStatus,
  locationName: string
): {
  searchHint: string | null;
  validationError: string | null;
  emptyStateTitle: string;
  emptyStateDescription: string;
  futureExpansion: string | null;
} {
  // No LSOAs found
  if (status.lsoaCount === 0) {
    const region = status.primaryRegion;

    // Check if it's within England & Wales bounds
    if (region === 'england_wales') {
      // Genuinely empty area within coverage
      return {
        searchHint: null,
        validationError: 'No residential areas found in this location',
        emptyStateTitle: 'No Residential Areas Found',
        emptyStateDescription:
          'This location appears to be in an unpopulated area (such as open water, parks, or rural land). Please try searching in a town or city.',
        futureExpansion: null,
      };
    }

    // Outside coverage - Scotland
    if (region === 'scotland') {
      return {
        searchHint: 'Scotland coverage coming soon',
        validationError: 'Scotland is not yet covered by our demographic data',
        emptyStateTitle: 'Scotland Coverage Coming Soon',
        emptyStateDescription:
          "Our demographic data currently covers England and Wales. We're working to expand coverage to Scotland.",
        futureExpansion:
          "We're actively working to bring Census 2022 data for Scotland to the platform. Check back soon for updates!",
      };
    }

    // Outside coverage - Northern Ireland
    if (region === 'northern_ireland') {
      return {
        searchHint: 'Northern Ireland coverage coming soon',
        validationError: 'Northern Ireland is not yet covered by our demographic data',
        emptyStateTitle: 'Northern Ireland Coverage Coming Soon',
        emptyStateDescription:
          "Our demographic data currently covers England and Wales. We're working to expand coverage to Northern Ireland.",
        futureExpansion:
          "We're actively working to bring Census 2021 data for Northern Ireland to the platform. Check back soon for updates!",
      };
    }

    // Unknown region (outside UK entirely)
    return {
      searchHint: 'This location may be outside the UK',
      validationError: 'This location is outside our coverage area',
      emptyStateTitle: 'Location Not Covered',
      emptyStateDescription: `Demographic data for ${locationName} is not available. Our service currently covers England and Wales.`,
      futureExpansion: null,
    };
  }

  // Partial coverage
  if (status.isPartiallyCovered) {
    return {
      searchHint: 'Your search area may cross regional boundaries',
      validationError: null, // Not an error - allow the search
      emptyStateTitle: '',
      emptyStateDescription: '',
      futureExpansion: null,
    };
  }

  // Full coverage - no special messages needed
  return {
    searchHint: null,
    validationError: null,
    emptyStateTitle: '',
    emptyStateDescription: '',
    futureExpansion: null,
  };
}

/**
 * Check if coordinates are within approximate region bounds
 * Used for proactive hints before search
 */
export function isLikelyOutsideCoverage(lat: number, lng: number): boolean {
  const region = detectRegionFromCoordinates(lat, lng);

  // If it's in Scotland or Northern Ireland, it's outside current coverage
  return region === 'scotland' || region === 'northern_ireland';
}
