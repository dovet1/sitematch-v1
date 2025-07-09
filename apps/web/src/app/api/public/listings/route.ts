import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { SearchFilters, SearchResponse } from '@/types/search';
import { calculateDistance } from '@/lib/mapbox';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const location = searchParams.get('location') || '';
    const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
    const lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null;
    const radius = Number(searchParams.get('radius') || 5); // Default 5 miles radius
    const companyName = searchParams.get('companyName') || '';
    const sector = searchParams.getAll('sector');
    const useClass = searchParams.getAll('useClass');
    const sizeMin = searchParams.get('sizeMin') ? Number(searchParams.get('sizeMin')) : null;
    const sizeMax = searchParams.get('sizeMax') ? Number(searchParams.get('sizeMax')) : null;
    const isNationwide = searchParams.get('isNationwide') === 'true';
    const page = Number(searchParams.get('page')) || 1;
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100); // Max 100 results per page
    
    const supabase = createClient();
    
    // Build the query with listing_locations relationship
    let query = supabase
      .from('listings')
      .select(`
        id, 
        company_name, 
        title, 
        description,
        site_size_min, 
        site_size_max,
        contact_name, 
        contact_title, 
        contact_email, 
        contact_phone,
        created_at,
        listing_locations(
          place_name,
          coordinates,
          formatted_address,
          region,
          country,
          type
        )
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Apply filters
    // TODO: Re-enable location filtering when relationships are fixed
    // if (location && !isNationwide) {
    //   // Filter by location - in production, this would use PostGIS for proper geographic search
    //   query = query.or(`listing_locations.place_name.ilike.%${location}%,is_nationwide.eq.true`);
    // }
    
    if (companyName) {
      query = query.ilike('company_name', `%${companyName}%`);
    }
    
    if (sector.length > 0) {
      query = query.in('sectors.name', sector);
    }
    
    if (useClass.length > 0) {
      query = query.in('use_classes.name', useClass);
    }
    
    if (sizeMin !== null) {
      query = query.or(`site_size_max.gte.${sizeMin},site_size_max.is.null`);
    }
    
    if (sizeMax !== null) {
      query = query.or(`site_size_min.lte.${sizeMax},site_size_min.is.null`);
    }
    
    if (isNationwide) {
      query = query.eq('is_nationwide', true);
    }

    const { data: listings, error, count } = await query;

    if (error) {
      console.error('Error fetching public listings:', error);
      console.error('Error details:', error.message);
      console.error('Error hint:', error.hint);
      return NextResponse.json(
        { error: 'Failed to fetch listings', details: error.message },
        { status: 500 }
      );
    }

    // Transform data to match SearchResult interface
    let results = listings?.map(listing => {
      const locations = (listing.listing_locations as any) || [];
      const primaryLocation = locations.find((loc: any) => loc.type === 'preferred') || locations[0];
      
      // TODO: Add proper logo URL retrieval once file_uploads relationship is fixed
      // For now, add some test logos for demonstration
      const getLogoUrl = (companyName: string) => {
        const logoDevApiKey = process.env.LOGO_DEV_API_KEY;
        if (!logoDevApiKey) {
          return null; // Fallback to initials if no API key
        }
        
        const companyDomains: { [key: string]: string } = {
          'Waitrose': 'waitrose.com',
          'Tesco': 'tesco.com',
          'Lidl': 'lidl.co.uk',
        };
        
        const domain = companyDomains[companyName];
        if (!domain) {
          return null; // Fallback to initials if no domain mapping
        }
        
        return `https://img.logo.dev/${domain}?token=${logoDevApiKey}`;
      };
      
      return {
        id: listing.id,
        company_name: listing.company_name,
        title: listing.title,
        description: listing.description,
        site_size_min: listing.site_size_min,
        site_size_max: listing.site_size_max,
        sector: null, // Will be populated when we fix the relationship
        use_class: null, // Will be populated when we fix the relationship
        contact_name: listing.contact_name,
        contact_title: listing.contact_title,
        contact_email: listing.contact_email,
        contact_phone: listing.contact_phone,
        is_nationwide: locations.length === 0, // Treat as nationwide if no locations
        logo_url: getLogoUrl(listing.company_name),
        place_name: primaryLocation?.place_name || null,
        coordinates: primaryLocation?.coordinates || null,
        created_at: listing.created_at
      };
    }) || [];

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

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const response: SearchResponse = {
      results,
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