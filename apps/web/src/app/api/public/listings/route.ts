import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { SearchFilters, SearchResponse } from '@/types/search';
import { calculateDistance } from '@/lib/mapbox';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('=== API ROUTE CALLED ===');
    console.log('Full URL:', request.url);

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

    console.log('All URL params:', Object.fromEntries(searchParams.entries()));
    console.log('Filter params:', { acreageMin, acreageMax, dwellingMin, dwellingMax });
    console.log('Raw params:', {
      minAcreage: searchParams.get('minAcreage'),
      maxAcreage: searchParams.get('maxAcreage'),
      minDwelling: searchParams.get('minDwelling'),
      maxDwelling: searchParams.get('maxDwelling')
    });
    console.log('=== STARTING FILTER APPLICATION ===');
    const isNationwide = searchParams.get('isNationwide') === 'true' || searchParams.get('nationwide') === 'true';
    const page = Number(searchParams.get('page')) || 1;
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 1000); // Max 1000 results per page for comprehensive search

    const supabase = createServerClient();

    // Build the query - RLS policies will handle filtering for approved listings
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
        contact_name,
        contact_title,
        contact_email,
        contact_phone,
        clearbit_logo,
        company_domain,
        created_at,
        current_version_id
      `);


    // Apply location filtering
    if (location && !isNationwide) {
      // Since location filtering with relationships is complex, we'll filter after fetching
      // This is a temporary solution - in production, this should use PostGIS for proper geographic search
      console.log('Location filtering will be applied client-side for:', location);
    }
    
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
      console.log('Applying residential filters - excluding commercial listings');
      query = query.neq('listing_type', 'commercial');
    }
    
    // If commercial-focused filters are applied, exclude residential listings
    const hasCommercialFilters = sector.length > 0 || useClass.length > 0 || sizeMin !== null || sizeMax !== null;
    if (hasCommercialFilters) {
      console.log('Applying commercial filters - excluding residential listings');
      query = query.neq('listing_type', 'residential');
    }
    
    if (acreageMin !== null) {
      console.log('Applying acreageMin filter:', acreageMin);
      query = query.not('site_acreage_max', 'is', null);
      query = query.gte('site_acreage_max', acreageMin);
    }
    
    if (acreageMax !== null) {
      console.log('Applying acreageMax filter:', acreageMax);
      query = query.not('site_acreage_min', 'is', null);
      query = query.lte('site_acreage_min', acreageMax);
    }
    
    if (dwellingMin !== null) {
      console.log('Applying dwellingMin filter:', dwellingMin);
      query = query.not('dwelling_count_max', 'is', null);
      query = query.gte('dwelling_count_max', dwellingMin);
    }
    
    if (dwellingMax !== null) {
      console.log('Applying dwellingMax filter:', dwellingMax);
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


    // Fetch the highest approved version for each listing
    const listingIds = listings?.map(l => l.id) || [];

    console.log(`About to fetch versions for ${listingIds.length} listings`);

    let versionMap: Record<string, any> = {};
    if (listingIds.length > 0) {
      // Fetch ALL approved versions - RLS will filter appropriately
      // Removed .in() filter to avoid PostgREST query size limits with large listing ID arrays
      const { data: versions, error: versionsError } = await supabase
        .from('listing_versions')
        .select('listing_id, content, version_number')
        .eq('status', 'approved')
        .order('version_number', { ascending: false })
        .limit(100000); // Fetch up to 100k versions to ensure we get all

      if (versionsError) {
        console.error('Error fetching versions:', versionsError);
      }

      console.log(`Fetched ${versions?.length || 0} approved versions total`);

      // Keep only the highest version number per listing, and only for listings we actually have
      const listingIdSet = new Set(listingIds);
      const highestVersions = new Map<string, any>();
      versions?.forEach(version => {
        // Only include versions for listings in our current set
        if (listingIdSet.has(version.listing_id) && !highestVersions.has(version.listing_id)) {
          const content = typeof version.content === 'string' ? JSON.parse(version.content) : version.content;
          highestVersions.set(version.listing_id, content);
        }
      });

      console.log(`Kept ${highestVersions.size} versions for our ${listingIds.length} listings`);

      versionMap = Object.fromEntries(highestVersions);
    }
    
    // Fetch logo files for all listings
    let logoFiles: any[] = [];
    
    if (listingIds.length > 0) {
      const { data: files } = await supabase
        .from('file_uploads')
        .select('listing_id, file_path, bucket_name, file_type')
        .in('listing_id', listingIds)
        .eq('file_type', 'logo')
        .order('created_at', { ascending: false }); // Get most recent logo if multiple exist
      
      logoFiles = files || [];
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
      
    // Fetch ALL listing_locations - RLS will filter to only show locations for approved listings
    // This avoids the .in() query limit issue
    // Note: PostgREST has a hard limit of 1000 rows per request, so we need to paginate
    let locationData: any[] = [];
    let locationError: any = null;
    let locationPage = 0;
    const locationPageSize = 1000;
    let hasMoreLocations = true;

    while (hasMoreLocations) {
      const { data, error } = await supabase
        .from('listing_locations')
        .select('listing_id, id, place_name, coordinates, formatted_address, region, country')
        .range(locationPage * locationPageSize, (locationPage + 1) * locationPageSize - 1);

      if (error) {
        locationError = error;
        break;
      }

      if (data && data.length > 0) {
        locationData = [...locationData, ...data];
        hasMoreLocations = data.length === locationPageSize;
        locationPage++;
      } else {
        hasMoreLocations = false;
      }
    }

    console.log('Location data fetch (paginated):', {
      requestedListings: currentListingIds.length,
      locationsReturned: locationData?.length || 0,
      pages: locationPage,
      error: locationError?.message
    });

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
    
    locationData?.forEach(item => {
      if (!locationMap.has(item.listing_id)) {
        locationMap.set(item.listing_id, []);
      }
      locationMap.get(item.listing_id).push(item);
    });

    // Debug: Check specific Canterbury listings
    const canterburyListingIds = [
      'b0a58b89-16fe-463c-b1ba-87bc3aaf3cc4', // B&B Hotels
      '7cb0d79f-e84e-4ad2-bd68-42f7d5a9563d'  // British Heart Foundation
    ];
    canterburyListingIds.forEach(id => {
      const inLocationMap = locationMap.has(id);
      const inListings = listings?.some(l => l.id === id);
      console.log(`Canterbury listing ${id.substring(0, 8)}: inListings=${inListings}, inLocationMap=${inLocationMap}, locations=${locationMap.get(id)?.length || 0}`);
    });

    console.log(`Location map has ${locationMap.size} listings with location data`);
    console.log(`Processing ${listings?.length || 0} total listings`);
    console.log(`Version map has ${Object.keys(versionMap).length} listings with approved versions`);

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
      
      // Check version files for logo if available
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
        created_at: listingData.created_at
      };
    }) || [];

    // Apply location filtering if location is provided and not nationwide
    if (location && !isNationwide) {
      console.log('Applying location filter for:', location);
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
      console.log('After location filtering and sorting:', results.length, 'results');
      console.log('Location-specific listings:', listingsWithMatchingLocations.length);
      console.log('Nationwide listings:', nationwideListings.length);
    }
    
    // Apply nationwide filtering if requested
    if (isNationwide) {
      results = results.filter(listing => listing.is_nationwide);
    }

    // Apply location-based filtering if coordinates are provided
    if (lat !== null && lng !== null) {
      const searchCoords: [number, number] = [lng, lat]; // [longitude, latitude]
      console.log(`Using radius: ${radius.toFixed(2)}km (${radiusMiles} miles)`);

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

        // Debug: Log first 5 listings with locations
        if (listingsWithDistances.length + nationwideListings.length < 5) {
          console.log(`Listing "${listing.title}": ${listing.locations.length} locations`,
            listing.locations.map((l: any) => ({ place_name: l.place_name, has_coords: !!l.coordinates })));
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

      // Debug: Log the closest listings
      console.log('Closest listings:', listingsWithDistances.slice(0, 10).map(item => ({
        title: item.listing.title,
        distance: `${item.distance.toFixed(2)}km`
      })));

      console.log('Location filtering breakdown:');
      console.log(`- No location data (treated as nationwide): ${noLocationsCount}`);
      console.log(`- Within ${radius.toFixed(2)}km radius: ${listingsWithDistances.length}`);
      console.log(`- Beyond radius (treated as nationwide): ${nationwideListings.length - noLocationsCount}`);

      // Combine results: location-specific (sorted by distance) first, then nationwide
      results = [...sortedListingsWithinRadius, ...nationwideListings];
      console.log('After coordinate filtering:', results.length, 'results');
      console.log('Listings within radius (sorted by distance):', sortedListingsWithinRadius.length);
      console.log('Nationwide listings:', nationwideListings.length);
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
      hasMore: (page * limit) < totalFilteredCount
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