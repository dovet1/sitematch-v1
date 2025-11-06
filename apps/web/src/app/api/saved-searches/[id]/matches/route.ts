import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { calculateDistance } from '@/lib/distance-utils';
import type { MatchingListing } from '@/lib/saved-searches-types';

export const dynamic = 'force-dynamic';

// GET /api/saved-searches/[id]/matches - Get matching listings for a saved search
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get the saved search
    const { data: savedSearch, error: searchError } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (searchError || !savedSearch) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    // Step 1: Get all approved listings first to fetch their versions
    const { data: allListings, error: allListingsError } = await supabase
      .from('listings')
      .select('id, current_version_id')
      .eq('status', 'approved');

    if (allListingsError) {
      console.error('Error fetching listings:', allListingsError);
      return NextResponse.json(
        { error: 'Failed to fetch listings' },
        { status: 500 }
      );
    }

    if (!allListings || allListings.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const allListingIds = allListings.map(l => l.id);

    // Step 2: Fetch listing versions to get versioned location data
    const BATCH_SIZE = 100;
    let allVersions: any[] = [];

    for (let i = 0; i < allListingIds.length; i += BATCH_SIZE) {
      const batch = allListingIds.slice(i, i + BATCH_SIZE);
      const { data: versions, error: versionsError } = await supabase
        .from('listing_versions')
        .select('listing_id, content, version_number')
        .in('listing_id', batch)
        .eq('status', 'approved')
        .order('version_number', { ascending: false });

      if (versionsError) {
        console.error(`Error fetching versions batch ${Math.floor(i / BATCH_SIZE) + 1}:`, versionsError);
      } else if (versions) {
        allVersions = [...allVersions, ...versions];
      }
    }

    // Keep only the highest version number per listing
    const versionMap = new Map<string, any>();
    allVersions.forEach(version => {
      if (!versionMap.has(version.listing_id)) {
        const content = typeof version.content === 'string' ? JSON.parse(version.content) : version.content;
        versionMap.set(version.listing_id, content);
      }
    });

    // Step 3: If there's a location filter, get locations within radius
    let eligibleListingIds: string[] = [];
    let locationsByListingId: Map<string, any> = new Map();

    if (
      savedSearch.location_lat &&
      savedSearch.location_lng &&
      savedSearch.location_radius_miles
    ) {
      // Fetch all listing_locations with coordinates from the table
      const { data: allLocations, error: locationsError } = await supabase
        .from('listing_locations')
        .select('id, listing_id, place_name, formatted_address, coordinates');

      if (locationsError) {
        console.error('Error fetching listing locations:', locationsError);
        return NextResponse.json(
          { error: 'Failed to fetch locations' },
          { status: 500 }
        );
      }

      // Build a comprehensive map of all locations (table + versioned)
      const allLocationsList: any[] = [];

      // Add locations from the listing_locations table
      if (allLocations) {
        allLocationsList.push(...allLocations);
      }

      // Add versioned locations for listings that have them
      allListingIds.forEach(listingId => {
        const versionContent = versionMap.get(listingId);
        if (versionContent?.locations && Array.isArray(versionContent.locations)) {
          versionContent.locations.forEach((loc: any) => {
            // Add versioned location with listing_id attached
            allLocationsList.push({
              id: loc.id,
              listing_id: listingId,
              place_name: loc.place_name,
              formatted_address: loc.formatted_address,
              coordinates: loc.coordinates,
            });
          });
        }
      });

      console.log(`Filtering ${allLocationsList.length} locations (table + versioned) by distance`);

      // Filter locations by distance in code
      const locationsInRadius: Array<{listing_id: string, location: any, distance: number}> = [];

      for (const location of allLocationsList) {
        if (!location.coordinates) continue;

        // Parse coordinates (can be array or string)
        let coords = location.coordinates as any;
        if (typeof coords === 'string') {
          try {
            coords = JSON.parse(coords);
          } catch (e) {
            continue;
          }
        }

        if (!Array.isArray(coords) || coords.length !== 2) continue;

        const [lng, lat] = coords;
        const distance = calculateDistance(
          savedSearch.location_lat,
          savedSearch.location_lng,
          lat,
          lng
        );

        if (distance <= savedSearch.location_radius_miles) {
          locationsInRadius.push({
            listing_id: location.listing_id,
            location: location,
            distance: distance,
          });
        }
      }

      console.log(`Found ${locationsInRadius.length} locations within ${savedSearch.location_radius_miles} mile radius`);

      // Group by listing_id and keep the closest location for each listing
      const listingLocationMap = new Map<string, {location: any, distance: number}>();

      for (const item of locationsInRadius) {
        const existing = listingLocationMap.get(item.listing_id);
        if (!existing || item.distance < existing.distance) {
          listingLocationMap.set(item.listing_id, {
            location: item.location,
            distance: item.distance,
          });
        }
      }

      eligibleListingIds = Array.from(listingLocationMap.keys());
      locationsByListingId = listingLocationMap;

      console.log(`${eligibleListingIds.length} unique listings have locations within radius`);

      if (eligibleListingIds.length === 0) {
        return NextResponse.json({ matches: [] });
      }
    }

    // Step 2: Build query for listings
    let query = supabase
      .from('listings')
      .select(`
        id,
        company_name,
        listing_type,
        status,
        created_at,
        site_size_min,
        site_size_max,
        site_acreage_min,
        site_acreage_max
      `)
      .eq('status', 'approved');

    // If we filtered by location, only fetch those listing IDs
    if (eligibleListingIds.length > 0) {
      query = query.in('id', eligibleListingIds);
    }

    // Apply listing type filter
    if (savedSearch.listing_type) {
      query = query.eq('listing_type', savedSearch.listing_type);
    }

    // Apply size filters based on listing type
    // For commercial: use site_size_min/max (square feet)
    // For residential: use site_acreage_min/max (acres)
    // Note: We need to fetch all and filter in memory since we don't know
    // if the user entered sq ft or acres without knowing the listing type
    // For now, skip size filtering in the query and filter later

    // Fetch listings
    const { data: listings, error: listingsError } = await query;

    if (listingsError) {
      console.error('Error fetching listings:', listingsError);
      return NextResponse.json(
        { error: 'Failed to fetch matching listings' },
        { status: 500 }
      );
    }

    if (!listings || listings.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    console.log(`Found ${listings.length} listings after applying filters`);

    // Get listing IDs for fetching sectors and planning use classes
    const listingIds = listings.map((l) => l.id);

    // Fetch sectors if needed (by ID)
    let listingSectors: Record<string, string[]> = {};
    if (savedSearch.sectors && savedSearch.sectors.length > 0) {
      const { data: sectorsData } = await supabase
        .from('listing_sectors')
        .select('listing_id, sector_id')
        .in('listing_id', listingIds);

      if (sectorsData) {
        sectorsData.forEach((row: any) => {
          if (!listingSectors[row.listing_id]) {
            listingSectors[row.listing_id] = [];
          }
          listingSectors[row.listing_id].push(row.sector_id);
        });
      }
    }

    // Fetch planning use classes if needed (by ID)
    let listingUseClasses: Record<string, string[]> = {};
    if (savedSearch.planning_use_classes && savedSearch.planning_use_classes.length > 0) {
      const { data: useClassesData, error: useClassError } = await supabase
        .from('listing_use_classes')
        .select('listing_id, use_class_id')
        .in('listing_id', listingIds);

      if (useClassError) {
        console.error('Error fetching use classes:', useClassError);
      }

      if (useClassesData) {
        useClassesData.forEach((row: any) => {
          if (!listingUseClasses[row.listing_id]) {
            listingUseClasses[row.listing_id] = [];
          }
          listingUseClasses[row.listing_id].push(row.use_class_id);
        });
      }

      console.log(`Fetched use classes for ${Object.keys(listingUseClasses).length} listings`);
      console.log('Sample use class data:', Object.entries(listingUseClasses).slice(0, 2));
      console.log('Searching for use classes:', savedSearch.planning_use_classes);
    }

    // Filter and enrich listings
    const matchingListings: MatchingListing[] = [];

    for (const listing of listings) {
      // Check sector match
      if (savedSearch.sectors && savedSearch.sectors.length > 0) {
        const listingSectorIds = listingSectors[listing.id] || [];
        const hasMatchingSector = savedSearch.sectors.some((sectorId) =>
          listingSectorIds.includes(sectorId)
        );
        if (!hasMatchingSector) continue;
      }

      // Check planning use class match
      if (savedSearch.planning_use_classes && savedSearch.planning_use_classes.length > 0) {
        const listingUseClassIds = listingUseClasses[listing.id] || [];
        const hasMatchingUseClass = savedSearch.planning_use_classes.some((useClassId) =>
          listingUseClassIds.includes(useClassId)
        );
        if (!hasMatchingUseClass) continue;
      }

      // Check size match
      if (savedSearch.min_size || savedSearch.max_size) {
        // Determine which size fields to check based on listing type
        let listingSizeMin: number | null = null;
        let listingSizeMax: number | null = null;

        if (listing.listing_type === 'commercial') {
          // Commercial uses square feet
          listingSizeMin = listing.site_size_min;
          listingSizeMax = listing.site_size_max;
        } else if (listing.listing_type === 'residential') {
          // Residential uses acres
          listingSizeMin = listing.site_acreage_min ? Number(listing.site_acreage_min) : null;
          listingSizeMax = listing.site_acreage_max ? Number(listing.site_acreage_max) : null;
        }

        // Check if listing size range overlaps with search size range
        if (listingSizeMin !== null && listingSizeMax !== null) {
          if (savedSearch.min_size && listingSizeMax < savedSearch.min_size) continue;
          if (savedSearch.max_size && listingSizeMin > savedSearch.max_size) continue;
        }
      }

      // Get location data if we filtered by location
      const locationData = locationsByListingId.get(listing.id);
      const closestLocation = locationData?.location;
      const distanceMiles = locationData?.distance;

      // Parse location coordinates for display
      let locationCoords = closestLocation?.coordinates as any;
      if (typeof locationCoords === 'string') {
        try {
          locationCoords = JSON.parse(locationCoords);
        } catch (e) {
          locationCoords = null;
        }
      }

      const [lng, lat] = Array.isArray(locationCoords) && locationCoords.length === 2
        ? locationCoords
        : [null, null];

      matchingListings.push({
        id: listing.id,
        company_name: listing.company_name,
        listing_type: listing.listing_type,
        status: listing.status,
        created_at: listing.created_at,
        location: closestLocation
          ? {
              address: closestLocation.formatted_address || closestLocation.place_name,
              latitude: lat,
              longitude: lng,
            }
          : undefined,
        sectors: listingSectors[listing.id],
        planning_use_classes: listingUseClasses[listing.id],
        matched_search_id: savedSearch.id,
        matched_search_name: savedSearch.name,
        distance_miles: distanceMiles,
      });
    }

    // Sort by created_at (newest first)
    matchingListings.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    console.log(`Returning ${matchingListings.length} matches`);

    return NextResponse.json({ matches: matchingListings });
  } catch (error) {
    console.error('Error in GET /api/saved-searches/[id]/matches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
