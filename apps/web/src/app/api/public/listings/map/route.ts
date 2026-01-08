import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkSubscriptionAccess } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

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

    const supabase = createServerClient();

    // Check if user has subscription access
    const { data: { user } } = await supabase.auth.getUser();
    const hasAccess = user ? await checkSubscriptionAccess(user.id) : false;
    const isFreeTier = !hasAccess;

    console.log('Map API - Subscription check:', { userId: user?.id, hasAccess, isFreeTier });

    // Build minimal query for map clustering - only essential data
    let query = supabase
      .from('listings')
      .select(`
        id,
        company_name,
        listing_type,
        clearbit_logo,
        company_domain,
        site_size_min,
        site_size_max,
        site_acreage_min,
        site_acreage_max,
        dwelling_count_min,
        dwelling_count_max,
        is_featured_free,
        listing_sectors(
          sector:sectors(
            name
          )
        ),
        listing_use_classes(
          use_class:use_classes(
            name
          )
        ),
        listing_locations(
          place_name,
          coordinates
        )
      `)
      .in('status', ['approved', 'pending', 'draft']) // More lenient for development
      .limit(1000); // Increased limit for better map coverage

    // For free tier users, only show featured free listings
    if (isFreeTier) {
      query = query.eq('is_featured_free', true);
      console.log('Map API - Free tier user: filtering to featured free listings only');
    }

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

    // Fetch uploaded logos for listings that don't use Clearbit
    let logoData: Record<string, string> = {};
    if (listings && listings.length > 0) {
      const listingIds = listings.map(l => l.id);
      const { data: logoFiles } = await supabase
        .from('file_uploads')
        .select('listing_id, file_path, bucket_name')
        .in('listing_id', listingIds)
        .eq('file_type', 'logo')
        .eq('is_primary', true);

      if (logoFiles) {
        logoData = Object.fromEntries(
          logoFiles.map(file => [
            file.listing_id,
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`
          ])
        );
      }
    }

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

    // No logo fetching needed for minimal map view

    // Transform to GeoJSON format for Mapbox native clustering
    const features: any[] = [];

    listings?.forEach(listing => {
      const locations = (listing.listing_locations as any) || [];

      // Skip listings without locations
      if (locations.length === 0) return;

      // Get primary sector and use class (first one)
      const primarySector = (listing.listing_sectors as any)?.[0]?.sector?.name || null;
      const primaryUseClass = (listing.listing_use_classes as any)?.[0]?.use_class?.name || null;

      // Create GeoJSON feature for each location
      locations.forEach((location: any) => {
        const coordinates: any = location?.coordinates;

        if (!coordinates) return;

        // Parse coordinates safely - handle multiple formats
        let lat, lng;
        try {
          if (typeof coordinates === 'string') {
            // Handle string format: "[-0.007855, 51.481247]"
            const parsed = JSON.parse(coordinates);
            if (Array.isArray(parsed) && parsed.length === 2) {
              [lng, lat] = parsed; // GeoJSON format [longitude, latitude]
            } else {
              console.warn('Invalid coordinate string format:', coordinates);
              return;
            }
          } else if (Array.isArray(coordinates)) {
            [lng, lat] = coordinates; // GeoJSON format [longitude, latitude]
          } else if (coordinates.lat && coordinates.lng) {
            lat = coordinates.lat;
            lng = coordinates.lng;
          } else {
            console.warn('Unknown coordinate format:', coordinates);
            return;
          }

          // Validate coordinate ranges
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            console.warn('Coordinates out of valid range:', { lat, lng });
            return;
          }
        } catch (coordError) {
          console.error('Error parsing coordinates:', coordError, coordinates);
          return;
        }

        // Create GeoJSON feature
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat] // GeoJSON format [longitude, latitude]
          },
          properties: {
            id: listing.id,
            company_name: listing.company_name || 'Unknown Company',
            listing_type: listing.listing_type || 'commercial',
            clearbit_logo: listing.clearbit_logo,
            company_domain: listing.company_domain,
            logo_url: logoData[listing.id] || null,
            sector: primarySector,
            use_class: primaryUseClass,
            site_size_min: listing.site_size_min,
            site_size_max: listing.site_size_max,
            site_acreage_min: listing.site_acreage_min,
            site_acreage_max: listing.site_acreage_max,
            dwelling_count_min: listing.dwelling_count_min,
            dwelling_count_max: listing.dwelling_count_max,
            place_name: location?.place_name || null
          }
        });
      });
    });

    // Create GeoJSON FeatureCollection
    const geoJson = {
      type: 'FeatureCollection',
      features: features
    };

    // If no features (e.g., all listings are nationwide without specific locations), return empty GeoJSON
    if (features.length === 0) {
      console.log('No map features found - listings may not have specific locations');
      const emptyGeoJson = {
        type: 'FeatureCollection',
        features: []
      };

      return NextResponse.json({
        geojson: emptyGeoJson,
        total: 0,
        bounds: { north, south, east, west },
        message: 'No listings with specific locations found for these filters'
      });
    }

    // Return GeoJSON for Mapbox native clustering
    return NextResponse.json({
      geojson: geoJson,
      total: features.length,
      bounds: { north, south, east, west },
      metadata: {
        zoom,
        timestamp: new Date().toISOString(),
        filters: {
          location,
          companyName,
          sector: sector.join(','),
          useClass: useClass.join(','),
          listingType: listingType.join(','),
          sizeMin,
          sizeMax,
          acreageMin,
          acreageMax,
          dwellingMin,
          dwellingMax,
          isNationwide
        }
      }
    });
    
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