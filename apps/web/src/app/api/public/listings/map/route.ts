import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse geographic parameters
    const bounds = searchParams.get('bounds'); // Format: "sw_lat,sw_lng,ne_lat,ne_lng"
    const center = searchParams.get('center'); // Format: "lat,lng"
    const radius = Number(searchParams.get('radius')) || 50; // Default 50km radius
    
    // Parse filter parameters (same as main listings endpoint)
    const location = searchParams.get('location') || '';
    const companyName = searchParams.get('companyName') || '';
    const sector = searchParams.getAll('sector');
    const useClass = searchParams.getAll('useClass');
    const sizeMin = searchParams.get('sizeMin') ? Number(searchParams.get('sizeMin')) : null;
    const sizeMax = searchParams.get('sizeMax') ? Number(searchParams.get('sizeMax')) : null;
    const isNationwide = searchParams.get('isNationwide') === 'true';

    const supabase = createClient();
    
    // Build query for map-optimized listing data
    let query = supabase
      .from('listings')
      .select(`
        id, 
        company_name, 
        title,
        site_size_min, 
        site_size_max,
        is_nationwide,
        sectors(name),
        use_classes(name),
        file_uploads!inner(file_path),
        listing_locations!inner(place_name, coordinates)
      `)
      .eq('status', 'approved')
      .eq('published', true)
      .eq('file_uploads.file_type', 'logo')
      .not('listing_locations.coordinates', 'is', null); // Only listings with coordinates for map

    // Apply geographic filtering
    if (bounds) {
      const [swLat, swLng, neLat, neLng] = bounds.split(',').map(Number);
      
      // In production, this would use PostGIS for proper geographic queries
      // For now, we'll do a basic bounding box filter
      query = query
        .gte('listing_locations.coordinates->0', swLat)
        .lte('listing_locations.coordinates->0', neLat)
        .gte('listing_locations.coordinates->1', swLng)
        .lte('listing_locations.coordinates->1', neLng);
    } else if (center) {
      const [lat, lng] = center.split(',').map(Number);
      
      // In production, this would use PostGIS ST_DWithin for radius search
      // For now, we'll include a wider area and filter client-side if needed
      const latDelta = radius * 0.009; // Rough conversion km to degrees
      const lngDelta = radius * 0.009;
      
      query = query
        .gte('listing_locations.coordinates->0', lat - latDelta)
        .lte('listing_locations.coordinates->0', lat + latDelta)
        .gte('listing_locations.coordinates->1', lng - lngDelta)
        .lte('listing_locations.coordinates->1', lng + lngDelta);
    }

    // Apply same filters as main listings endpoint
    if (location && !isNationwide) {
      query = query.ilike('listing_locations.place_name', `%${location}%`);
    }
    
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

    // Include nationwide listings if requested
    if (isNationwide) {
      // For map view, we might want to show nationwide listings at major cities
      // This would need more sophisticated logic in production
    }

    const { data: listings, error } = await query;

    if (error) {
      console.error('Error fetching map listings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch map listings' },
        { status: 500 }
      );
    }

    // Transform data for map pins
    const mapResults = listings?.map(listing => ({
      id: listing.id,
      company_name: listing.company_name,
      title: listing.title,
      site_size_min: listing.site_size_min,
      site_size_max: listing.site_size_max,
      sector: (listing.sectors as any)?.name || null,
      use_class: (listing.use_classes as any)?.name || null,
      is_nationwide: listing.is_nationwide,
      logo_url: (listing.file_uploads as any)?.[0]?.file_path || null,
      place_name: (listing.listing_locations as any)?.[0]?.place_name || null,
      coordinates: (listing.listing_locations as any)?.[0]?.coordinates || null
    })) || [];

    return NextResponse.json({
      results: mapResults,
      total: mapResults.length
    });
    
  } catch (error) {
    console.error('Unexpected error in map listings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}