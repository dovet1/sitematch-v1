import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Geocoding function using Mapbox Geocoding API
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!MAPBOX_TOKEN) {
    console.warn('Mapbox token not available for geocoding');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&country=GB&limit=1`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const classification = searchParams.get('classification');

    const supabase = createServerClient();
    
    // Get approved agencies with office addresses
    let query = supabase
      .from('agencies')
      .select(`
        id,
        name,
        classification,
        geographic_patch,
        logo_url,
        office_address,
        status,
        agency_versions(
          id,
          status
        )
      `)
      .not('office_address', 'is', null);

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply classification filter
    if (classification && classification !== 'all') {
      if (classification === 'Commercial') {
        query = query.in('classification', ['Commercial', 'Both']);
      } else if (classification === 'Residential') {
        query = query.in('classification', ['Residential', 'Both']);
      } else {
        query = query.eq('classification', classification);
      }
    }

    const { data: rawAgencies, error } = await query;

    if (error) {
      console.error('Error fetching agencies for map:', error);
      return NextResponse.json(
        { error: 'Failed to fetch agencies' },
        { status: 500 }
      );
    }

    // Filter agencies that are approved or have approved versions
    const approvedAgencies = rawAgencies?.filter(agency => {
      return agency.status === 'approved' ||
             agency.agency_versions?.some((version: any) => version.status === 'approved');
    }) || [];

    // Geocode addresses to get coordinates
    const mapAgencies = await Promise.all(approvedAgencies.map(async (agency) => {
      let coordinates = null;
      
      if (agency.office_address) {
        try {
          coordinates = await geocodeAddress(agency.office_address);
        } catch (error) {
          console.warn(`Failed to geocode address for agency ${agency.name}:`, error);
        }
      }

      return {
        id: agency.id,
        name: agency.name,
        classification: agency.classification,
        geographic_patch: agency.geographic_patch,
        logo_url: agency.logo_url,
        office_coordinates: coordinates,
        office_address: agency.office_address
      };
    }));

    // Filter out agencies without coordinates
    const mappableAgencies = mapAgencies.filter(agency => agency.office_coordinates);

    return NextResponse.json({
      data: mappableAgencies,
      total: mappableAgencies.length
    });

  } catch (error) {
    console.error('Unexpected error in agencies map API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}