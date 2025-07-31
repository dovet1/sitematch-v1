import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    
    // Parse geographic parameters for map bounds
    const north = searchParams.get('north') ? Number(searchParams.get('north')) : null;
    const south = searchParams.get('south') ? Number(searchParams.get('south')) : null;
    const east = searchParams.get('east') ? Number(searchParams.get('east')) : null;
    const west = searchParams.get('west') ? Number(searchParams.get('west')) : null;
    
    // Parse clustering parameters
    const zoom = Number(searchParams.get('zoom')) || 12;
    const clustering = searchParams.get('clustering') !== 'false';
    
    // Parse filter parameters (same as main listings endpoint)
    const location = searchParams.get('location') || '';
    const companyName = searchParams.get('companyName') || '';
    const sector = searchParams.getAll('sector');
    const useClass = searchParams.getAll('useClass');
    const listingType = searchParams.getAll('listingType');
    const sizeMin = searchParams.get('sizeMin') ? Number(searchParams.get('sizeMin')) : null;
    const sizeMax = searchParams.get('sizeMax') ? Number(searchParams.get('sizeMax')) : null;
    const acreageMin = searchParams.get('minAcreage') ? Number(searchParams.get('minAcreage')) : null;
    const acreageMax = searchParams.get('maxAcreage') ? Number(searchParams.get('maxAcreage')) : null;
    const dwellingMin = searchParams.get('minDwelling') ? Number(searchParams.get('minDwelling')) : null;
    const dwellingMax = searchParams.get('maxDwelling') ? Number(searchParams.get('maxDwelling')) : null;
    const isNationwide = searchParams.get('isNationwide') === 'true';

    const supabase = createClient();
    
    // Build query for map-optimized listing data with many-to-many relationships
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
        company_domain,
        clearbit_logo,
        created_at,
        updated_at,
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
          coordinates
        )
      `)
      .in('status', ['approved', 'pending', 'draft']) // More lenient for development
      .limit(1000) // Increased limit for better map coverage

    // Apply geographic filtering using map bounds
    // Note: Geographic filtering will be done post-query for now since complex PostGIS queries 
    // require special handling in Supabase. In production, this should use proper spatial indexes.

    // Apply same filters as main listings endpoint
    // Note: Location filtering on related tables requires special handling in Supabase
    
    if (companyName) {
      query = query.ilike('company_name', `%${companyName}%`);
    }
    
    // Handle sector and use class filtering with junction tables (same logic as main API)
    let validListingIds: string[] | null = null;
    
    if (sector.length > 0) {
      const { data: listingsWithSectors, error: sectorError } = await supabase
        .from('listing_sectors')
        .select(`
          listing_id,
          sectors!inner(name)
        `)
        .in('sectors.name', sector);
      
      if (sectorError) {
        console.error('Map API - Error fetching sector listings:', sectorError);
        validListingIds = [];
      } else if (listingsWithSectors && listingsWithSectors.length > 0) {
        validListingIds = listingsWithSectors.map(ls => ls.listing_id);
      } else {
        validListingIds = [];
      }
    }
    
    if (useClass.length > 0) {
      const { data: listingsWithUseClasses, error: useClassError } = await supabase
        .from('listing_use_classes')
        .select(`
          listing_id,
          use_classes!inner(name)
        `)
        .in('use_classes.name', useClass);
      
      if (useClassError) {
        console.error('Map API - Error fetching use class listings:', useClassError);
        validListingIds = [];
      } else if (listingsWithUseClasses && listingsWithUseClasses.length > 0) {
        const useClassListingIds = listingsWithUseClasses.map(luc => luc.listing_id);
        
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
      console.log('Map API - Applying residential filters - excluding commercial listings');
      query = query.neq('listing_type', 'commercial');
    }
    
    // If commercial-focused filters are applied, exclude residential listings
    const hasCommercialFilters = sector.length > 0 || useClass.length > 0 || sizeMin !== null || sizeMax !== null;
    if (hasCommercialFilters) {
      console.log('Map API - Applying commercial filters - excluding residential listings');
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

    // Note: is_nationwide column doesn't exist in current schema
    // This would need to be implemented when the column is added

    const { data: listings, error } = await query;

    if (error) {
      console.error('Database error fetching map listings:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Return fallback mock data for development
      console.log('Returning mock data for development');
      const mockResults = [
        {
          id: 'mock-1',
          company_name: 'Sample Company Ltd',
          title: 'Office Space Required',
          description: 'Modern office space needed',
          site_size_min: 2000,
          site_size_max: 5000,
          sectors: [{ id: '1', name: 'Technology' }],
          use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
          sector: 'Technology',
          use_class: 'Office',
          contact_name: 'Contact Available',
          contact_title: 'Property Manager',
          contact_email: 'contact@company.com',
          contact_phone: '020 0000 0000',
          is_nationwide: false,
          logo_url: null,
          place_name: 'London, UK',
          coordinates: { lat: 51.5074, lng: -0.1278 },
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-2',
          company_name: 'Another Company',
          title: 'Retail Space Needed',
          description: 'High street retail opportunity',
          site_size_min: 1000,
          site_size_max: 3000,
          sectors: [{ id: '2', name: 'Retail' }],
          use_classes: [{ id: '2', name: 'Retail', code: 'A1' }],
          sector: 'Retail',
          use_class: 'Retail',
          contact_name: 'Contact Available',
          contact_title: 'Property Manager',
          contact_email: 'contact@company.com',
          contact_phone: '020 0000 0000',
          is_nationwide: false,
          logo_url: null,
          place_name: 'Manchester, UK',
          coordinates: { lat: 53.4808, lng: -2.2426 },
          created_at: new Date().toISOString()
        }
      ];

      return NextResponse.json({
        results: mockResults,
        total: mockResults.length,
        bounds: { north, south, east, west },
        zoom,
        clustering,
        fallback: true
      });
    }

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

    // Transform data for map pins - create one pin per listing_location
    const mapResults: any[] = [];
    
    listings?.forEach(listing => {
      const locations = (listing.listing_locations as any) || [];
      
      // If no locations, skip this listing
      if (locations.length === 0) {
        console.warn(`Listing ${listing.id} has no locations, skipping`);
        return;
      }
      
      // Contact info is now directly on the listing
      const contact = {
        name: listing.contact_name,
        title: listing.contact_title,
        email: listing.contact_email,
        phone: listing.contact_phone
      };
      
      // Create a map result for each location
      locations.forEach((location: any) => {
        const coordinates: any = location?.coordinates;
        
        // Validate coordinates
        if (!coordinates) {
          console.warn(`Location ${location.id} for listing ${listing.id} missing coordinates, skipping`);
          return;
        }
        
        // Parse coordinates safely
        let lat, lng;
        try {
          if (Array.isArray(coordinates)) {
            [lng, lat] = coordinates; // GeoJSON format [longitude, latitude]
          } else if (coordinates.lat && coordinates.lng) {
            lat = coordinates.lat;
            lng = coordinates.lng;
          } else {
            throw new Error('Invalid coordinate format');
          }
          
          // Validate coordinate ranges
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new Error('Coordinates out of valid range');
          }
        } catch (coordError) {
          console.warn(`Invalid coordinates for location ${location.id}:`, coordError);
          return;
        }
        
        mapResults.push({
          id: listing.id,
          location_id: location.id, // Track which location this pin represents
          company_name: listing.company_name || 'Unknown Company',
          title: listing.title || 'Untitled Listing',
          description: listing.description || listing.title || 'No description available',
          site_size_min: listing.site_size_min,
          site_size_max: listing.site_size_max,
          site_acreage_min: listing.site_acreage_min,
          site_acreage_max: listing.site_acreage_max,
          dwelling_count_min: listing.dwelling_count_min,
          dwelling_count_max: listing.dwelling_count_max,
          
          // Enhanced sector and use class data with correct structure
          sectors: listing.listing_sectors ? listing.listing_sectors.map((ls: any) => ({
            id: ls.sector?.id || '1',
            name: ls.sector?.name || ''
          })) : [],
          use_classes: listing.listing_use_classes ? listing.listing_use_classes.map((luc: any) => ({
            id: luc.use_class?.id || '1',
            name: luc.use_class?.name || '',
            code: luc.use_class?.code || ''
          })) : [],
          
          // Simplified fields for backward compatibility
          sector: (listing.listing_sectors as any)?.[0]?.sector?.name || null,
          use_class: (listing.listing_use_classes as any)?.[0]?.use_class?.name || null,
          
          // Enhanced contact data (now from listing directly)
          contact_name: contact.name || 'Contact Available',
          contact_title: contact.title || null,
          contact_email: contact.email || null,
          contact_phone: contact.phone || null,
          
          // Additional fields for Story 8.0
          is_nationwide: false, // Not in current schema
          // Implement correct fallback logic:
          // 1. If clearbit_logo is true, use company_domain for Clearbit
          // 2. If clearbit_logo is false, use uploaded logo from file_uploads table
          // 3. If no uploaded logo exists, fall back to initials
          logo_url: logoMap[listing.id] || null,
          clearbit_logo: listing.clearbit_logo || false,
          company_domain: listing.company_domain,
          place_name: location?.place_name || null,
          coordinates: { lat, lng },
          
          // All locations for this listing (for reference)
          locations: locations.map((loc: any) => ({
            id: loc.id,
            place_name: loc.place_name,
            coordinates: loc.coordinates
          })),
          
          // Timestamps
          created_at: listing.created_at || new Date().toISOString(),
          updated_at: listing.updated_at || new Date().toISOString(),
          
          // Calculated fields
          price: 'Price on application', // Placeholder for future price data
          availability: 'Available', // Placeholder for availability status
          features: [] // Placeholder for property features
        });
      });
    });

    // If no results from database, return mock data for development
    if (mapResults.length === 0) {
      console.log('No database results, returning mock data for development');
      const mockResults = [
        {
          id: 'mock-1',
          company_name: 'Sample Company Ltd',
          title: 'Office Space Required',
          description: 'Modern office space needed',
          site_size_min: 2000,
          site_size_max: 5000,
          sectors: [{ id: '1', name: 'Technology' }],
          use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
          sector: 'Technology',
          use_class: 'Office',
          contact_name: 'Contact Available',
          contact_title: 'Property Manager',
          contact_email: 'contact@company.com',
          contact_phone: '020 0000 0000',
          is_nationwide: false,
          logo_url: null,
          place_name: 'London, UK',
          coordinates: { lat: 51.5074, lng: -0.1278 },
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-2',
          company_name: 'Tech Startup Ltd',
          title: 'Flexible Workspace Needed',
          description: 'Growing startup needs flexible office space',
          site_size_min: 1500,
          site_size_max: 4000,
          sectors: [{ id: '1', name: 'Technology' }],
          use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
          sector: 'Technology',
          use_class: 'Office',
          contact_name: 'Contact Available',
          contact_title: 'Property Manager',
          contact_email: 'contact@company.com',
          contact_phone: '020 0000 0000',
          is_nationwide: false,
          logo_url: null,
          place_name: 'Manchester, UK',
          coordinates: { lat: 53.4808, lng: -2.2426 },
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-3',
          company_name: 'Retail Chain Co',
          title: 'High Street Retail Location',
          description: 'Established retailer seeking prime location',
          site_size_min: 800,
          site_size_max: 2000,
          sectors: [{ id: '2', name: 'Retail' }],
          use_classes: [{ id: '2', name: 'Retail', code: 'A1' }],
          sector: 'Retail',
          use_class: 'Retail',
          contact_name: 'Contact Available',
          contact_title: 'Property Manager',
          contact_email: 'contact@company.com',
          contact_phone: '020 0000 0000',
          is_nationwide: false,
          logo_url: null,
          place_name: 'Birmingham, UK',
          coordinates: { lat: 52.4862, lng: -1.8904 },
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-4',
          company_name: 'Multi-Location Corp',
          title: 'Multiple Office Locations',
          description: 'Same location multi-listing test',
          site_size_min: 3000,
          site_size_max: 6000,
          sectors: [{ id: '1', name: 'Technology' }],
          use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
          sector: 'Technology',
          use_class: 'Office',
          contact_name: 'Contact Available',
          contact_title: 'Property Manager',
          contact_email: 'contact@company.com',
          contact_phone: '020 0000 0000',
          is_nationwide: false,
          logo_url: null,
          place_name: 'London, UK',
          coordinates: { lat: 51.5074, lng: -0.1278 }, // Same as mock-1 to test clustering
          created_at: new Date().toISOString()
        }
      ];

      return NextResponse.json({
        results: mockResults,
        total: mockResults.length,
        bounds: { north, south, east, west },
        zoom,
        clustering,
        fallback: true
      });
    }

    // Enhanced response format for Story 8.0
    const response = {
      results: mapResults, // Keep 'results' to match frontend expectations
      listings: mapResults, // Also provide 'listings' for future compatibility
      clusters: [], // Clustering will be handled client-side for better performance
      totalCount: mapResults.length,
      hasMore: mapResults.length >= 200, // Indicates if there are more results
      bounds: {
        north,
        south,
        east,
        west
      },
      metadata: {
        zoom,
        clustering,
        timestamp: new Date().toISOString(),
        queryDuration: Date.now() - Date.now(), // Would measure actual query time
        filters: {
          location,
          companyName,
          sector,
          useClass,
          listingType,
          sizeMin,
          sizeMax,
          acreageMin,
          acreageMax,
          dwellingMin,
          dwellingMax,
          isNationwide
        }
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Unexpected error in map listings API:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Enhanced error response for Story 8.0
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to fetch map listings',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      },
      { status: 500 }
    );
  }
}