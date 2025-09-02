import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
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
    const radius = Number(searchParams.get('radius') || 5); // Default 5 miles radius
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
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100); // Max 100 results per page
    
    const supabase = createClient();
    
    
    // Build the query with many-to-many junction tables
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
        listing_sectors(
          sector:sectors(
            id,
            name
          )
        ),
        listing_use_classes(
          use_class:use_classes(
            id,
            name,
            code
          )
        ),
        listing_locations(
          id,
          place_name,
          coordinates,
          formatted_address,
          region,
          country
        )
      `)
      .eq('status', 'approved');

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

    const { data: listings, error, count } = await query;

    console.log('Database query result count:', listings?.length);
    if (acreageMin !== null || acreageMax !== null) {
      console.log('Sample listing acreage values:', listings?.slice(0, 3).map(l => ({
        id: l.id.slice(0, 8),
        company: l.company_name,
        acreage_min: l.site_acreage_min,
        acreage_max: l.site_acreage_max
      })));
    }

    if (error) {
      console.error('Error fetching public listings:', error);
      console.error('Error details:', error.message);
      console.error('Error hint:', error.hint);
      return NextResponse.json(
        { error: 'Failed to fetch listings', details: error.message },
        { status: 500 }
      );
    }

    console.log('Raw listings data:', JSON.stringify(listings, null, 2));

    // Fetch logo files for all listings
    const listingIds = listings?.map(l => l.id) || [];
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

    // Transform data to match SearchResult interface with logo fetching
    console.log('Processing', listings?.length, 'listings');
    console.log('Logo map:', logoMap);
    
    let results = listings?.map(listing => {
      console.log('Processing listing:', listing.company_name, 'has logo:', !!logoMap[listing.id]);
      const locations = (listing.listing_locations as any) || [];
      const primaryLocation = locations[0];
      const sectors = (listing.listing_sectors as any) || [];
      const useClasses = (listing.listing_use_classes as any) || [];
      
      // Get the uploaded logo URL from our map
      const uploadedLogoUrl = logoMap[listing.id] || null;
      
      return {
        id: listing.id,
        company_name: listing.company_name,
        title: listing.title,
        description: listing.description,
        site_size_min: listing.site_size_min,
        site_size_max: listing.site_size_max,
        site_acreage_min: listing.site_acreage_min,
        site_acreage_max: listing.site_acreage_max,
        dwelling_count_min: listing.dwelling_count_min,
        dwelling_count_max: listing.dwelling_count_max,
        sectors: sectors.map((ls: any) => ls.sector).filter(Boolean),
        use_classes: useClasses.map((luc: any) => luc.use_class).filter(Boolean),
        // Legacy single values for backwards compatibility
        sector: sectors.length > 0 ? sectors[0].sector?.name : null,
        use_class: useClasses.length > 0 ? useClasses[0].use_class?.name : null,
        contact_name: listing.contact_name,
        contact_title: listing.contact_title,
        contact_email: listing.contact_email,
        contact_phone: listing.contact_phone,
        is_nationwide: locations.length === 0, // Treat as nationwide if no locations
        // Multiple locations support
        locations: locations.map((loc: any) => ({
          id: loc.id,
          place_name: loc.place_name,
          coordinates: loc.coordinates,
          formatted_address: loc.formatted_address,
          region: loc.region,
          country: loc.country
        })),
        // Legacy single location fields for backwards compatibility
        place_name: primaryLocation?.place_name || null,
        coordinates: primaryLocation?.coordinates || null,
        // Implement correct fallback logic:
        // 1. If clearbit_logo is true, use company_domain for Clearbit
        // 2. If clearbit_logo is false, use uploaded logo from file_uploads table
        // 3. If no uploaded logo exists, fall back to initials
        logo_url: uploadedLogoUrl,
        clearbit_logo: listing.clearbit_logo || false,
        company_domain: listing.company_domain,
        created_at: listing.created_at
      };
    }) || [];

    // Apply location filtering if location is provided and not nationwide
    if (location && !isNationwide) {
      console.log('Applying location filter for:', location);
      const locationLower = location.toLowerCase();
      results = results.filter(listing => {
        // Include nationwide listings (they match all locations)
        if (listing.is_nationwide) {
          return true;
        }
        
        // Check if any of the listing's locations match the search location
        return listing.locations.some((loc: any) => {
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
      });
      console.log('After location filtering:', results.length, 'results');
    }
    
    // Apply nationwide filtering if requested
    if (isNationwide) {
      results = results.filter(listing => listing.is_nationwide);
    }

    // Apply location-based filtering if coordinates are provided
    if (lat !== null && lng !== null) {
      const searchCoords: [number, number] = [lng, lat]; // [longitude, latitude]
      
      results = results.filter(listing => {
        // Always include nationwide listings (listings without locations)
        if (listing.is_nationwide) {
          return true;
        }
        
        // Check if listing has coordinates
        if (!listing.coordinates) {
          return false;
        }
        
        // Extract coordinates from JSONB format
        let listingLat, listingLng;
        if (listing.coordinates.lat && listing.coordinates.lng) {
          listingLat = listing.coordinates.lat;
          listingLng = listing.coordinates.lng;
        } else if (Array.isArray(listing.coordinates)) {
          // Handle array format [lng, lat]
          listingLng = listing.coordinates[0];
          listingLat = listing.coordinates[1];
        } else {
          return false;
        }
        
        // Calculate distance using Mapbox utility
        const listingCoords: [number, number] = [listingLng, listingLat];
        const distanceKm = calculateDistance(searchCoords, listingCoords);
        
        // Filter by 5km radius (as specified in requirements)
        return distanceKm <= 5;
      });
    }

    // Check for null/undefined results before randomization
    const invalidResults = results.filter(result => !result || !result.id);
    console.log('DEBUGGING: Invalid results found:', invalidResults.length, 'out of', results.length);
    if (invalidResults.length > 0) {
      console.log('DEBUGGING: Sample invalid results:', invalidResults.slice(0, 3));
    }
    
    const validResults = results.filter(result => result && result.id);
    console.log('Valid results count:', validResults.length, 'out of', results.length);
    
    // Randomize the results array using a daily seed for consistency
    console.log('Before randomization - first 3 results:', validResults.slice(0, 3).map(r => ({ id: r.id.slice(0, 8), company: r.company_name })));
    
    const today = new Date().toDateString();
    let seedHash = today.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    console.log('Randomization seed hash:', seedHash, 'for date:', today);
    
    // Proper seeded random number generator
    const seededRandom = () => {
      seedHash = (seedHash * 9301 + 49297) % 233280;
      return seedHash / 233280;
    };
    
    // Fisher-Yates shuffle with seeded random
    const shuffledResults = [...validResults];
    for (let i = shuffledResults.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [shuffledResults[i], shuffledResults[j]] = [shuffledResults[j], shuffledResults[i]];
    }
    
    console.log('After randomization - first 3 results:', shuffledResults.slice(0, 3).map(r => ({ id: r.id.slice(0, 8), company: r.company_name })));

    // Apply pagination after randomization
    const startIndex = (page - 1) * limit;
    const paginatedResults = shuffledResults.slice(startIndex, startIndex + limit);
    
    // Final validation before returning
    console.log('Final paginated results count:', paginatedResults.length);
    console.log('Final paginated results sample:', paginatedResults.slice(0, 2).map(r => ({ 
      id: r?.id?.slice(0, 8) || 'NO_ID', 
      company: r?.company_name || 'NO_COMPANY',
      hasId: !!r?.id 
    })));
    
    // Check for any null results after pagination
    const nullResultsAfterPagination = paginatedResults.filter(result => !result || !result.id);
    if (nullResultsAfterPagination.length > 0) {
      console.log('DEBUGGING: Found null results after pagination:', nullResultsAfterPagination.length);
      console.log('DEBUGGING: Sample null results:', nullResultsAfterPagination.slice(0, 2));
    }
    
    // Filter out any remaining null results as final safety check  
    const safeResults = paginatedResults.filter(result => result && result.id);
    console.log('DEBUGGING: Safe results after final filter:', safeResults.length, 'out of', paginatedResults.length);

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const response: SearchResponse = {
      results: safeResults,
      total: totalCount || 0,
      page,
      limit,
      hasMore: (page * limit) < (totalCount || 0)
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