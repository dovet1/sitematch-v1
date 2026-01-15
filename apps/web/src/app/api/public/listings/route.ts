import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';
import { SearchFilters, SearchResponse } from '@/types/search';
import { calculateDistance } from '@/lib/mapbox';
import { checkSubscriptionAccess } from '@/lib/subscription';

// Cache responses for 30 minutes to reduce database load
// This means new listings may take up to 30 minutes to appear in search results
// But provides ~90% reduction in database queries for common searches
export const revalidate = 1800; // 30 minutes in seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const location = searchParams.get('location') || '';
    const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
    const lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null;
    const radiusMiles = Number(searchParams.get('radius') || 5); // Default 5 miles radius
    const radius = radiusMiles * 1.60934; // Convert miles to kilometers for distance comparison
    const companyName = searchParams.get('companyName') || '';
    const sector = [...searchParams.getAll('sector'), ...searchParams.getAll('sectors[]')];
    const useClass = [...searchParams.getAll('useClass'), ...searchParams.getAll('useClasses[]')];
    const listingType = [...searchParams.getAll('listingType'), ...searchParams.getAll('listingTypes[]')];

    const sizeMin = searchParams.get('sizeMin') ? Number(searchParams.get('sizeMin')) : null;
    const sizeMax = searchParams.get('sizeMax') ? Number(searchParams.get('sizeMax')) : null;
    const acreageMin = searchParams.get('minAcreage') ? Number(searchParams.get('minAcreage')) : null;
    const acreageMax = searchParams.get('maxAcreage') ? Number(searchParams.get('maxAcreage')) : null;
    const dwellingMin = searchParams.get('minDwelling') ? Number(searchParams.get('minDwelling')) : null;
    const dwellingMax = searchParams.get('maxDwelling') ? Number(searchParams.get('maxDwelling')) : null;
    const isNationwide = searchParams.get('isNationwide') === 'true' || searchParams.get('nationwide') === 'true';
    const page = Number(searchParams.get('page')) || 1;
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 1000); // Max 1000 results per page for comprehensive search

    const supabase = await createServerClient();

    // Check if user has subscription access
    const { data: { user } } = await supabase.auth.getUser();
    const hasAccess = user ? await checkSubscriptionAccess(user.id) : false;
    const isFreeTier = !hasAccess;


    // Build the query - explicitly filter for approved listings
    let query = supabase
      .from('listings')
      .select(`
        id,
        company_name,
        title,
        description,
        site_size_min,
        site_size_max,
        site_acreage_min,
        site_acreage_max,
        dwelling_count_min,
        dwelling_count_max,
        listing_type,
        contact_name,
        contact_title,
        contact_email,
        contact_phone,
        clearbit_logo,
        company_domain,
        verified_at,
        created_at,
        live_version_id,
        current_version_id,
        is_featured_free
      `)
      .eq('status', 'approved');

    // For free tier users, only show featured free listings
    if (isFreeTier) {
      query = query.eq('is_featured_free', true);
    }


    // Apply location filtering
    // Location filtering with relationships is complex, we'll filter after fetching
    // This is a temporary solution - in production, this should use PostGIS for proper geographic search
    
    if (companyName) {
      query = query.ilike('company_name', `%${companyName}%`);
    }
    
    // Handle sector and use class filtering with proper intersection logic
    let validListingIds: string[] | null = null;
    
    if (sector.length > 0) {
      // Filter by sector names using junction table
      const { data: listingsWithSectors, error: sectorError } = await supabase
        .from('listing_sectors')
        .select(`
          listing_id,
          sectors!inner(name)
        `)
        .in('sectors.name', sector);
      
      if (sectorError) {
        console.error('Error fetching sector listings:', sectorError);
        validListingIds = [];
      } else if (listingsWithSectors && listingsWithSectors.length > 0) {
        validListingIds = listingsWithSectors.map(ls => ls.listing_id);
      } else {
        validListingIds = [];
      }
    }
    
    if (useClass.length > 0) {
      // Filter by use class names using junction table
      const { data: listingsWithUseClasses, error: useClassError } = await supabase
        .from('listing_use_classes')
        .select(`
          listing_id,
          use_classes!inner(name)
        `)
        .in('use_classes.name', useClass);
      
      if (useClassError) {
        console.error('Error fetching use class listings:', useClassError);
        validListingIds = [];
      } else if (listingsWithUseClasses && listingsWithUseClasses.length > 0) {
        const useClassListingIds = listingsWithUseClasses.map(luc => luc.listing_id);
        
        // If we already have sector-filtered IDs, find intersection
        if (validListingIds !== null) {
          validListingIds = validListingIds.filter(id => useClassListingIds.includes(id));
        } else {
          validListingIds = useClassListingIds;
        }
      } else {
        validListingIds = [];
      }
    }
    
    // Apply the filtered listing IDs to the main query
    if (validListingIds !== null) {
      if (validListingIds.length > 0) {
        query = query.in('id', validListingIds);
      } else {
        // No valid listings found, return empty result
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
    
    if (listingType.length > 0) {
      query = query.in('listing_type', listingType);
    }
    
    if (sizeMin !== null) {
      query = query.or(`site_size_max.gte.${sizeMin},site_size_max.is.null`);
    }
    
    if (sizeMax !== null) {
      query = query.or(`site_size_min.lte.${sizeMax},site_size_min.is.null`);
    }
    
    // If acreage or dwelling filters are applied, exclude commercial listings (these are residential-focused filters)
    const hasResidentialFilters = acreageMin !== null || acreageMax !== null || dwellingMin !== null || dwellingMax !== null;
    if (hasResidentialFilters) {
      query = query.neq('listing_type', 'commercial');
    }

    // If commercial-focused filters are applied, exclude residential listings
    const hasCommercialFilters = sector.length > 0 || sizeMin !== null || sizeMax !== null;
    if (hasCommercialFilters) {
      query = query.neq('listing_type', 'residential');
    }

    if (acreageMin !== null) {
      query = query.not('site_acreage_max', 'is', null);
      query = query.gte('site_acreage_max', acreageMin);
    }

    if (acreageMax !== null) {
      query = query.not('site_acreage_min', 'is', null);
      query = query.lte('site_acreage_min', acreageMax);
    }

    if (dwellingMin !== null) {
      query = query.not('dwelling_count_max', 'is', null);
      query = query.gte('dwelling_count_max', dwellingMin);
    }

    if (dwellingMax !== null) {
      query = query.not('dwelling_count_min', 'is', null);
      query = query.lte('dwelling_count_min', dwellingMax);
    }
    
    // Note: Nationwide filtering is handled client-side after fetching locations
    // A listing is nationwide if it has no linked listing_locations

    const { data: listings, error } = await query;

    if (error) {
      console.error('Error fetching public listings:', error);
      console.error('Error details:', error.message);
      console.error('Error hint:', error.hint);
      return NextResponse.json(
        { error: 'Failed to fetch listings', details: error.message },
        { status: 500 }
      );
    }


    // Fetch versions using live_version_id as primary source of truth
    const listingIds = listings?.map(l => l.id) || [];
    const listingsWithLiveVersionIds = listings?.filter(l => l.live_version_id) || [];
    const liveVersionIds = listingsWithLiveVersionIds.map(l => l.live_version_id);


    let versionMap: Record<string, any> = {};
    if (listingIds.length > 0) {
      // Batch fetch versions to avoid URL length limits with .in()
      // PostgREST has a limit on query string size (~8KB), so we batch large requests
      const BATCH_SIZE = 100;
      let allVersions: any[] = [];

      for (let i = 0; i < listingIds.length; i += BATCH_SIZE) {
        const batch = listingIds.slice(i, i + BATCH_SIZE);

        // Fetch both live versions and all versions for fallback
        const batchLiveVersionIds = listings
          ?.slice(i, i + BATCH_SIZE)
          .filter(l => l.live_version_id)
          .map(l => l.live_version_id) || [];

        const { data: versions, error: versionsError } = await supabase
          .from('listing_versions')
          .select('id, listing_id, content, version_number')
          .or(`id.in.(${batchLiveVersionIds.join(',')}),listing_id.in.(${batch.join(',')})`)
          .eq('status', 'approved')
          .order('version_number', { ascending: false });

        if (versionsError) {
          console.error(`Error fetching versions batch ${Math.floor(i / BATCH_SIZE) + 1}:`, versionsError);
        } else if (versions) {
          allVersions = [...allVersions, ...versions];
        }
      }

      // Build version map, preferring live_version_id over highest version_number
      const versionsByListing = new Map<string, any[]>();
      allVersions.forEach(version => {
        if (!versionsByListing.has(version.listing_id)) {
          versionsByListing.set(version.listing_id, []);
        }
        versionsByListing.get(version.listing_id)!.push(version);
      });

      listings?.forEach(listing => {
        const listingVersions = versionsByListing.get(listing.id) || [];

        if (listing.live_version_id) {
          // Use live_version_id if available
          const liveVersion = listingVersions.find(v => v.id === listing.live_version_id);
          if (liveVersion) {
            const content = typeof liveVersion.content === 'string'
              ? JSON.parse(liveVersion.content)
              : liveVersion.content;
            versionMap[listing.id] = content;
            return;
          } else {
            console.warn(`[PUBLIC-LISTINGS] live_version_id ${listing.live_version_id} not found for listing ${listing.id}, using fallback`);
          }
        }

        // Fallback: use highest version number
        if (listingVersions.length > 0) {
          const content = typeof listingVersions[0].content === 'string'
            ? JSON.parse(listingVersions[0].content)
            : listingVersions[0].content;
          versionMap[listing.id] = content;
        }
      });
    }
    
    // Fetch logo files for all listings
    // Use admin client to bypass RLS and batch to avoid URL length limits
    let logoFiles: any[] = [];

    if (listingIds.length > 0) {
      const adminSupabase = createAdminClient();
      const LOGO_BATCH_SIZE = 100;

      for (let i = 0; i < listingIds.length; i += LOGO_BATCH_SIZE) {
        const batch = listingIds.slice(i, i + LOGO_BATCH_SIZE);
        const { data: files, error: filesError } = await adminSupabase
          .from('file_uploads')
          .select('listing_id, file_path, bucket_name, file_type')
          .in('listing_id', batch)
          .eq('file_type', 'logo')
          .order('created_at', { ascending: false }); // Get most recent logo if multiple exist

        if (filesError) {
          console.error(`Error fetching logo files batch ${Math.floor(i / LOGO_BATCH_SIZE) + 1}:`, filesError);
        } else if (files) {
          logoFiles = [...logoFiles, ...files];
        }
      }
    }
    
    // Create a map of listing_id to logo URL (taking the first/most recent one if multiple exist)
    const logoMap: Record<string, string> = {};
    logoFiles.forEach(file => {
      if (file.file_path && file.bucket_name && !logoMap[file.listing_id]) {
        logoMap[file.listing_id] = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`;
      }
    });

    // Fetch relationships separately to avoid query issues
    const currentListingIds = listings?.map(l => l.id) || [];
    
    // Fetch sectors
    const { data: sectorData } = await supabase
      .from('listing_sectors')
      .select('listing_id, sectors(id, name)')
      .in('listing_id', currentListingIds);
    
    // Fetch use classes
    const { data: useClassData } = await supabase
      .from('listing_use_classes')
      .select('listing_id, use_classes(id, name, code)')
      .in('listing_id', currentListingIds);

    // Only fetch locations when actually needed for filtering or display
    // Skip expensive location fetching when user is just browsing without location filters
    const needsLocationData = (lat !== null && lng !== null) || location || isNationwide;
    let allLocations: any[] = [];

    if (needsLocationData) {
      // Batch fetch locations to avoid URL length limits with .in()
      // Use batching for large result sets to avoid PostgREST query string limits
      const LOCATION_BATCH_SIZE = 100;

      for (let i = 0; i < currentListingIds.length; i += LOCATION_BATCH_SIZE) {
        const batch = currentListingIds.slice(i, i + LOCATION_BATCH_SIZE);
        const { data: locationData, error: locationError } = await supabase
          .from('listing_locations')
          .select('listing_id, id, place_name, coordinates, formatted_address, region, country')
          .in('listing_id', batch);

        if (locationError) {
          console.error(`Error fetching locations batch ${Math.floor(i / LOCATION_BATCH_SIZE) + 1}:`, locationError);
        } else if (locationData) {
          allLocations = [...allLocations, ...locationData];
        }
      }
    }

    // Create lookup maps
    const sectorMap = new Map();
    const useClassMap = new Map();
    const locationMap = new Map();

    sectorData?.forEach(item => {
      if (!sectorMap.has(item.listing_id)) {
        sectorMap.set(item.listing_id, []);
      }
      sectorMap.get(item.listing_id).push(item);
    });

    useClassData?.forEach(item => {
      if (!useClassMap.has(item.listing_id)) {
        useClassMap.set(item.listing_id, []);
      }
      useClassMap.get(item.listing_id).push(item);
    });

    allLocations.forEach(item => {
      if (!locationMap.has(item.listing_id)) {
        locationMap.set(item.listing_id, []);
      }
      locationMap.get(item.listing_id).push(item);
    });

    // Transform data to match SearchResult interface with logo fetching
    let results = listings?.map(listing => {
      // Check if this listing has versioned data
      const versionContent = versionMap[listing.id];
      let listingData = listing;
      let locations = locationMap.get(listing.id) || [];
      let sectors = sectorMap.get(listing.id) || [];
      let useClasses = useClassMap.get(listing.id) || [];
      
      // If version exists, use version data instead
      if (versionContent) {
        // Override with versioned data
        if (versionContent.listing) {
          listingData = { ...listing, ...versionContent.listing };
        }
        if (versionContent.locations && versionContent.locations.length > 0) {
          locations = versionContent.locations;
        } else {
          // Debug: Version exists but has no locations - this is the 587 listings issue!
          // Silently continue - these are the transferred listings with empty location arrays
        }
        if (versionContent.sectors) {
          sectors = versionContent.sectors.map((s: any) => ({ sectors: s.sector }));
        }
        if (versionContent.use_classes) {
          useClasses = versionContent.use_classes.map((uc: any) => ({ use_classes: uc.use_class }));
        }
      }
      
      const primaryLocation = locations[0];
      
      // Parse coordinates if they're stored as a JSON string
      if (primaryLocation && typeof primaryLocation.coordinates === 'string') {
        try {
          primaryLocation.coordinates = JSON.parse(primaryLocation.coordinates);
        } catch (e) {
          console.error('Failed to parse coordinates for listing:', listing.id, e);
        }
      }
      
      // Get the uploaded logo URL from our map or version files
      let uploadedLogoUrl = logoMap[listing.id] || null;

      // Check version files for logo if available (this takes precedence)
      if (versionContent?.files) {
        const logoFile = versionContent.files.find((f: any) => f.file_type === 'logo');
        if (logoFile?.file_path && logoFile?.bucket_name) {
          uploadedLogoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${logoFile.bucket_name}/${logoFile.file_path}`;
        }
      }

      return {
        id: listing.id,
        company_name: listingData.company_name,
        title: listingData.title,
        description: listingData.description,
        site_size_min: listingData.site_size_min,
        site_size_max: listingData.site_size_max,
        site_acreage_min: listingData.site_acreage_min,
        site_acreage_max: listingData.site_acreage_max,
        dwelling_count_min: listingData.dwelling_count_min,
        dwelling_count_max: listingData.dwelling_count_max,
        listing_type: listingData.listing_type || 'commercial',
        sectors: sectors.map((ls: any) => ls.sectors).filter(Boolean),
        use_classes: useClasses.map((luc: any) => luc.use_classes).filter(Boolean),
        // Legacy single values for backwards compatibility
        sector: sectors.length > 0 ? sectors[0].sectors?.name : null,
        use_class: useClasses.length > 0 ? useClasses[0].use_classes?.name : null,
        contact_name: listingData.contact_name,
        contact_title: listingData.contact_title,
        contact_email: listingData.contact_email,
        contact_phone: listingData.contact_phone,
        is_nationwide: locations.length === 0, // Treat as nationwide if no locations
        // Multiple locations support
        locations: locations.map((loc: any) => {
          // Parse coordinates if stored as JSON string
          let coords = loc.coordinates;
          if (typeof coords === 'string') {
            try {
              coords = JSON.parse(coords);
            } catch (e) {
              console.error('Failed to parse location coordinates:', loc.id, e);
            }
          }
          return {
            id: loc.id,
            place_name: loc.place_name,
            coordinates: coords,
            formatted_address: loc.formatted_address,
            region: loc.region,
            country: loc.country
          };
        }),
        // Legacy single location fields for backwards compatibility
        place_name: primaryLocation?.place_name || null,
        coordinates: primaryLocation?.coordinates || null,
        // Implement correct fallback logic:
        // 1. If clearbit_logo is true, use company_domain for Clearbit
        // 2. If clearbit_logo is false, use uploaded logo from file_uploads table
        // 3. If no uploaded logo exists, fall back to initials
        logo_url: uploadedLogoUrl,
        clearbit_logo: listingData.clearbit_logo || false,
        company_domain: listingData.company_domain,
        verified_at: listing.verified_at, // Always use from base listing table, not version
        created_at: listingData.created_at
      };
    }) || [];

    // Apply location filtering if location is provided and not nationwide
    if (location && !isNationwide) {
      const locationLower = location.toLowerCase();
      
      // Separate listings into those with matching locations and nationwide
      const listingsWithMatchingLocations: any[] = [];
      const nationwideListings: any[] = [];
      
      results.forEach(listing => {
        // Nationwide listings go to separate array
        if (listing.is_nationwide) {
          nationwideListings.push(listing);
          return;
        }
        
        // Check if any of the listing's locations match the search location
        const hasMatchingLocation = listing.locations.some((loc: any) => {
          if (!loc.place_name) return false;
          
          const placeName = loc.place_name.toLowerCase();
          const formattedAddress = (loc.formatted_address || '').toLowerCase();
          const region = (loc.region || '').toLowerCase();
          const country = (loc.country || '').toLowerCase();
          
          // Check if location text appears in any of the location fields
          return placeName.includes(locationLower) ||
                 formattedAddress.includes(locationLower) ||
                 region.includes(locationLower) ||
                 country.includes(locationLower);
        });
        
        if (hasMatchingLocation) {
          listingsWithMatchingLocations.push(listing);
        }
      });
      
      // Combine results: location-specific first, then nationwide
      results = [...listingsWithMatchingLocations, ...nationwideListings];
    }
    
    // Apply nationwide filtering if requested
    if (isNationwide) {
      results = results.filter(listing => listing.is_nationwide);
    }

    // Apply location-based filtering if coordinates are provided
    if (lat !== null && lng !== null) {
      const searchCoords: [number, number] = [lng, lat]; // [longitude, latitude]

      // Separate listings into those within radius and nationwide
      const listingsWithDistances: { listing: any; distance: number }[] = [];
      const nationwideListings: any[] = [];
      let nationwideCount = 0;
      let noLocationsCount = 0;

      results.forEach(listing => {
        // Check if listing has any valid locations
        if (!listing.locations || listing.locations.length === 0) {
          // No location data - treat as nationwide
          noLocationsCount++;
          nationwideListings.push(listing);
          return;
        }


        // Calculate minimum distance to any of the listing's locations
        let minDistance = Infinity;

        listing.locations.forEach((loc: any) => {
          if (!loc.coordinates) return;

          let listingLat, listingLng;

          // Handle different coordinate formats
          if (Array.isArray(loc.coordinates)) {
            // Array format [lng, lat]
            listingLng = loc.coordinates[0];
            listingLat = loc.coordinates[1];
          } else if (loc.coordinates.lat && loc.coordinates.lng) {
            // Object format {lat, lng}
            listingLat = loc.coordinates.lat;
            listingLng = loc.coordinates.lng;
          } else {
            return;
          }

          // Calculate distance using Mapbox utility
          const listingCoords: [number, number] = [listingLng, listingLat];
          const distanceKm = calculateDistance(searchCoords, listingCoords);

          if (distanceKm < minDistance) {
            minDistance = distanceKm;
          }
        });

        // Filter by radius (converted from miles to km)
        if (minDistance <= radius) {
          listingsWithDistances.push({ listing, distance: minDistance });
        } else {
          // Beyond radius - treat as nationwide
          nationwideListings.push(listing);
        }
      });

      // Sort by distance (closest first)
      listingsWithDistances.sort((a, b) => a.distance - b.distance);

      // Extract sorted listings and add distance metadata
      const sortedListingsWithinRadius = listingsWithDistances.map(item => ({
        ...item.listing,
        _distance: item.distance // Add distance for potential client-side use
      }));

      // Combine results: location-specific (sorted by distance) first, then nationwide
      results = [...sortedListingsWithinRadius, ...nationwideListings];
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, results.length);
    const paginatedResults = results.slice(startIndex, endIndex);

    // Use the actual filtered count for pagination
    const totalFilteredCount = results.length;

    const response: SearchResponse = {
      results: paginatedResults,
      total: totalFilteredCount,
      page,
      limit,
      hasMore: (page * limit) < totalFilteredCount,
      isFreeTier
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Unexpected error in public listings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}