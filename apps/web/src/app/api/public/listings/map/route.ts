import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
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
        sectors(name),
        use_classes(name),
        listing_locations(place_name, coordinates)
      `)
      .in('status', ['approved', 'pending', 'draft']) // More lenient for development

    // Apply geographic filtering using map bounds
    if (north !== null && south !== null && east !== null && west !== null) {
      // Basic bounding box filter (would use PostGIS in production for better performance)
      query = query
        .gte('listing_locations.coordinates->1', south)   // latitude >= south
        .lte('listing_locations.coordinates->1', north)   // latitude <= north
        .gte('listing_locations.coordinates->0', west)    // longitude >= west
        .lte('listing_locations.coordinates->0', east);   // longitude <= east
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

    // Note: is_nationwide column doesn't exist in current schema
    // This would need to be implemented when the column is added

    const { data: listings, error } = await query;

    if (error) {
      console.error('Error fetching map listings:', error);
      
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

    // Transform data for map pins with enhanced details
    const mapResults = listings?.map(listing => {
      const location = (listing.listing_locations as any)?.[0];
      const coordinates = location?.coordinates;
      
      return {
        id: listing.id,
        company_name: listing.company_name,
        title: listing.title,
        description: listing.title, // Use title as description for now
        site_size_min: listing.site_size_min,
        site_size_max: listing.site_size_max,
        sectors: [{ id: '1', name: (listing.sectors as any)?.name || '' }],
        use_classes: [{ id: '1', name: (listing.use_classes as any)?.name || '', code: 'B1' }],
        sector: (listing.sectors as any)?.name || null,
        use_class: (listing.use_classes as any)?.name || null,
        contact_name: 'Contact Available', // Placeholder for now
        contact_title: 'Property Manager',
        contact_email: 'contact@company.com', // Placeholder
        contact_phone: '020 0000 0000', // Placeholder
        is_nationwide: false, // Default to false since column doesn't exist
        logo_url: null, // Will be populated later if needed
        place_name: location?.place_name || null,
        coordinates: coordinates ? {
          lat: Array.isArray(coordinates) ? coordinates[1] : coordinates.lat,
          lng: Array.isArray(coordinates) ? coordinates[0] : coordinates.lng
        } : null,
        created_at: new Date().toISOString()
      };
    }).filter(listing => listing.coordinates) || []; // Only include listings with valid coordinates

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

    return NextResponse.json({
      results: mapResults,
      total: mapResults.length,
      bounds: {
        north,
        south,
        east,
        west
      },
      zoom,
      clustering
    });
    
  } catch (error) {
    console.error('Unexpected error in map listings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}