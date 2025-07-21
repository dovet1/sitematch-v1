import mapboxgl from 'mapbox-gl';
import type { SearchResult } from '@/types/sitesketcher';

// Initialize Mapbox token
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export const MAPBOX_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  streets: 'mapbox://styles/mapbox/streets-v12',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12'
} as const;

export const DEFAULT_VIEWPORT = {
  longitude: -0.1278,
  latitude: 51.5074,
  zoom: 10
};

export function getMapboxToken(): string {
  if (!MAPBOX_TOKEN) {
    throw new Error('NEXT_PUBLIC_MAPBOX_TOKEN environment variable is not set');
  }
  return MAPBOX_TOKEN;
}

export async function searchLocations(query: string, limit = 5): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  
  try {
    const token = getMapboxToken();
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      new URLSearchParams({
        access_token: token,
        limit: limit.toString(),
        types: 'place,postcode,address,poi'
      })
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    const data = await response.json();
    
    return data.features.map((feature: any) => ({
      id: feature.id,
      place_name: feature.place_name,
      center: feature.center,
      place_type: feature.place_type,
      properties: feature.properties || {}
    }));
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
}

export async function reverseGeocode(lng: number, lat: number): Promise<SearchResult | null> {
  try {
    const token = getMapboxToken();
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
      new URLSearchParams({
        access_token: token,
        limit: '1'
      })
    );
    
    if (!response.ok) {
      throw new Error('Reverse geocoding request failed');
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      return {
        id: feature.id,
        place_name: feature.place_name,
        center: feature.center,
        place_type: feature.place_type,
        properties: feature.properties || {}
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
}

export function createMapboxMap(
  container: HTMLElement,
  options: Partial<mapboxgl.MapboxOptions> = {}
): mapboxgl.Map {
  return new mapboxgl.Map({
    container,
    style: MAPBOX_STYLES.satellite,
    center: [DEFAULT_VIEWPORT.longitude, DEFAULT_VIEWPORT.latitude],
    zoom: DEFAULT_VIEWPORT.zoom,
    accessToken: getMapboxToken(),
    ...options
  });
}

export function flyToLocation(
  map: mapboxgl.Map,
  center: [number, number],
  zoom = 15
): Promise<void> {
  return new Promise((resolve) => {
    map.flyTo({
      center,
      zoom,
      duration: 2000,
      essential: true
    });
    
    map.once('moveend', () => resolve());
  });
}

export function addGridOverlay(map: mapboxgl.Map, gridSize = 10): void {
  // Remove existing grid if it exists
  if (map.getLayer('grid-layer')) {
    map.removeLayer('grid-layer');
  }
  if (map.getSource('grid-source')) {
    map.removeSource('grid-source');
  }
  
  // This would be implemented with a custom grid generation function
  // For now, we'll create a simple implementation
  const bounds = map.getBounds();
  if (!bounds) return;
  
  const gridFeatures = generateGridFeatures(bounds, gridSize);
  
  map.addSource('grid-source', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: gridFeatures
    }
  });
  
  map.addLayer({
    id: 'grid-layer',
    type: 'line',
    source: 'grid-source',
    paint: {
      'line-color': '#3b82f6',
      'line-width': 0.5,
      'line-opacity': 0.3
    }
  });
}

export function removeGridOverlay(map: mapboxgl.Map): void {
  if (map.getLayer('grid-layer')) {
    map.removeLayer('grid-layer');
  }
  if (map.getSource('grid-source')) {
    map.removeSource('grid-source');
  }
}

function generateGridFeatures(bounds: mapboxgl.LngLatBounds, gridSize: number): any[] {
  // Convert grid size from meters to degrees (approximate)
  const gridSizeDegrees = gridSize / 111320; // Rough conversion for longitude
  const features = [];
  
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  // Generate vertical lines
  for (let lng = sw.lng; lng <= ne.lng; lng += gridSizeDegrees) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[lng, sw.lat], [lng, ne.lat]]
      }
    });
  }
  
  // Generate horizontal lines
  for (let lat = sw.lat; lat <= ne.lat; lat += gridSizeDegrees) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[sw.lng, lat], [ne.lng, lat]]
      }
    });
  }
  
  return features;
}

export function snapToGrid(point: [number, number], gridSize: number): [number, number] {
  const gridSizeDegrees = gridSize / 111320;
  const [lng, lat] = point;
  
  const snappedLng = Math.round(lng / gridSizeDegrees) * gridSizeDegrees;
  const snappedLat = Math.round(lat / gridSizeDegrees) * gridSizeDegrees;
  
  return [snappedLng, snappedLat];
}

export function isPointNearGrid(point: [number, number], gridSize: number, tolerance = 5): boolean {
  const snapped = snapToGrid(point, gridSize);
  const distance = Math.sqrt(
    Math.pow((point[0] - snapped[0]) * 111320, 2) + 
    Math.pow((point[1] - snapped[1]) * 110540, 2)
  );
  
  return distance <= tolerance;
}