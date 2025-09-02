import { NextRequest, NextResponse } from 'next/server';
import { LocationSuggestion } from '@/types/search';
import { searchLocations, formatLocationDisplay } from '@/lib/mapbox';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(Number(searchParams.get('limit')) || 8, 20);
    
    if (query.length < 2) {
      return NextResponse.json({
        results: [],
        total: 0
      });
    }

    try {
      // Use Mapbox geocoding API for real address suggestions
      const mapboxResults = await searchLocations(query, {
        limit,
        types: ['address', 'place', 'locality', 'neighborhood', 'poi']
      });

      // Transform Mapbox results to our LocationSuggestion format
      const suggestions: LocationSuggestion[] = mapboxResults.map(result => ({
        id: result.id,
        name: result.text,
        description: formatLocationDisplay(result), // Use formatLocationDisplay to clean up the location name
        coordinates: {
          lat: result.center[1], // Mapbox uses [lng, lat], we use {lat, lng}
          lng: result.center[0]
        }
      }));

      return NextResponse.json({
        results: suggestions,
        total: suggestions.length,
        query
      });

    } catch (mapboxError) {
      console.error('Mapbox geocoding error:', mapboxError);
      
      // Fallback to mock data if Mapbox fails
      const mockLocations: LocationSuggestion[] = [
        { id: '1', name: 'London', description: 'Greater London, England', coordinates: { lat: 51.5074, lng: -0.1278 } },
        { id: '2', name: 'Manchester', description: 'Greater Manchester, England', coordinates: { lat: 53.4808, lng: -2.2426 } },
        { id: '3', name: 'Birmingham', description: 'West Midlands, England', coordinates: { lat: 52.4862, lng: -1.8904 } },
        { id: '4', name: 'Liverpool', description: 'Merseyside, England', coordinates: { lat: 53.4084, lng: -2.9916 } },
        { id: '5', name: 'Leeds', description: 'West Yorkshire, England', coordinates: { lat: 53.8008, lng: -1.5491 } },
        { id: '6', name: 'Glasgow', description: 'Scotland, United Kingdom', coordinates: { lat: 55.8642, lng: -4.2518 } },
        { id: '7', name: 'Edinburgh', description: 'Scotland, United Kingdom', coordinates: { lat: 55.9533, lng: -3.1883 } },
        { id: '8', name: 'Cardiff', description: 'Wales, United Kingdom', coordinates: { lat: 51.4816, lng: -3.1791 } },
      ];

      const filteredLocations = mockLocations.filter(location =>
        location.name.toLowerCase().includes(query.toLowerCase()) ||
        location.description.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      return NextResponse.json({
        results: filteredLocations,
        total: filteredLocations.length,
        query,
        fallback: true
      });
    }
    
  } catch (error) {
    console.error('Unexpected error in location suggestions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}