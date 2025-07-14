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
    const sector = [...searchParams.getAll('sector'), ...searchParams.getAll('sectors[]')];
    const useClass = [...searchParams.getAll('useClass'), ...searchParams.getAll('useClasses[]')];
    const sizeMin = searchParams.get('sizeMin') ? Number(searchParams.get('sizeMin')) : null;
    const sizeMax = searchParams.get('sizeMax') ? Number(searchParams.get('sizeMax')) : null;
    const isNationwide = searchParams.get('isNationwide') === 'true' || searchParams.get('nationwide') === 'true';
    const page = Number(searchParams.get('page')) || 1;
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100); // Max 100 results per page
    
    const supabase = createClient();
    
    
    // Build the query with listing_locations relationship and junction tables
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
        clearbit_logo,
        company_domain,
        created_at,
        listing_locations(
          place_name,
          coordinates,
          formatted_address,
          region,
          country,
          type
        ),
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
      // Filter by sector names using junction table
      // Get listings that have any of the selected sectors
      const { data: listingsWithSectors, error: sectorError } = await supabase
        .from('listing_sectors')
        .select(`
          listing_id,
          sector:sectors(name)
        `)
        .in('sector.name', sector);
      
      if (sectorError) {
        console.error('Error fetching sector listings:', sectorError);
      } else if (listingsWithSectors && listingsWithSectors.length > 0) {
        const listingIds = listingsWithSectors.map(ls => ls.listing_id);
        query = query.in('id', listingIds);
      } else {
        // No matching sectors found, return no results
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
    
    if (useClass.length > 0) {
      // Filter by use class names using junction table
      // Get listings that have any of the selected use classes
      const { data: listingsWithUseClasses, error: useClassError } = await supabase
        .from('listing_use_classes')
        .select(`
          listing_id,
          use_class:use_classes(name)
        `)
        .in('use_class.name', useClass);
      
      if (useClassError) {
        console.error('Error fetching use class listings:', useClassError);
      } else if (listingsWithUseClasses && listingsWithUseClasses.length > 0) {
        const listingIds = listingsWithUseClasses.map(luc => luc.listing_id);
        query = query.in('id', listingIds);
      } else {
        // No matching use classes found, return no results
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
    
    if (sizeMin !== null) {
      query = query.or(`site_size_max.gte.${sizeMin},site_size_max.is.null`);
    }
    
    if (sizeMax !== null) {
      query = query.or(`site_size_min.lte.${sizeMax},site_size_min.is.null`);
    }
    
    // Note: Nationwide filtering is handled client-side after fetching locations
    // A listing is nationwide if it has no linked listing_locations

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
      const primaryLocation = locations.find((loc: any) => loc.type === 'preferred') || locations[0];
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
        // Implement correct fallback logic:
        // 1. If clearbit_logo is true, use company_domain for Clearbit
        // 2. If clearbit_logo is false, use uploaded logo from file_uploads table
        // 3. If no uploaded logo exists, fall back to initials
        logo_url: uploadedLogoUrl,
        clearbit_logo: listing.clearbit_logo || false,
        company_domain: listing.company_domain,
        place_name: primaryLocation?.place_name || null,
        coordinates: primaryLocation?.coordinates || null,
        created_at: listing.created_at
      };
    }) || [];

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