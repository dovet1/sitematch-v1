import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkSubscriptionAccess } from '@/lib/subscription';
import { getRequirementMapFeatures } from '@/lib/requirement-map-data';

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

    const supabase = await createServerClient();

    // Check if user has subscription access
    const { data: { user } } = await supabase.auth.getUser();
    const hasAccess = user ? await checkSubscriptionAccess(user.id) : false;
    const isFreeTier = !hasAccess;

    console.log('Map API - Subscription check:', { userId: user?.id, hasAccess, isFreeTier });

    // Apply geographic filtering using map bounds
    // Note: Geographic filtering will be done post-query for now since complex PostGIS queries 
    // require special handling in Supabase. In production, this should use proper spatial indexes.

    // Apply same filters as main listings endpoint
    // Note: Location filtering on related tables requires special handling in Supabase

    // Note: is_nationwide column doesn't exist in current schema
    // This would need to be implemented when the column is added

    let features;

    try {
      features = await getRequirementMapFeatures(supabase, {
        isFreeTier,
        filters: {
          companyName,
          sector,
          useClass,
          listingType,
          sizeMin,
          sizeMax,
          acreageMin,
          acreageMax,
          dwellingMin,
          dwellingMax
        }
      });
    } catch (error) {
      console.error('Database error fetching map listings:', error);
      
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
        debug: {
          totalFeatures: features.length,
          sampleLocationIds: features.slice(0, 20).map(feature => feature.properties.location_id),
          isFreeTier
        },
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
