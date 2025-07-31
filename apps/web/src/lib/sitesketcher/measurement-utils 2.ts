import * as turf from '@turf/turf';
import type { AreaMeasurement, MapboxDrawPolygon } from '@/types/sitesketcher';

export function calculatePolygonArea(coordinates: number[][]): AreaMeasurement {
  try {
    // Validate minimum number of coordinates for a polygon
    if (!coordinates || coordinates.length < 4) {
      return {
        squareMeters: 0,
        squareFeet: 0,
        sideLengths: []
      };
    }
    
    // Validate coordinate structure
    for (const coord of coordinates) {
      if (!Array.isArray(coord) || coord.length < 2 || 
          typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
        throw new Error('Invalid coordinate format');
      }
    }
    
    const polygon = turf.polygon([coordinates]);
    const area = turf.area(polygon); // Returns square meters
    
    // Calculate side lengths
    const sideLengths: number[] = [];
    for (let i = 0; i < coordinates.length - 1; i++) {
      const from = turf.point(coordinates[i]);
      const to = turf.point(coordinates[i + 1]);
      const length = turf.distance(from, to, { units: 'meters' });
      sideLengths.push(Math.round(length));
    }
    
    return {
      squareMeters: Math.round(area),
      squareFeet: Math.round(area * 10.764),
      sideLengths
    };
  } catch (error) {
    console.error('Error calculating polygon area:', error);
    return {
      squareMeters: 0,
      squareFeet: 0,
      sideLengths: []
    };
  }
}

export function calculateDistance(point1: [number, number], point2: [number, number]): number {
  try {
    // Validate coordinates
    if (!Array.isArray(point1) || !Array.isArray(point2) ||
        point1.length !== 2 || point2.length !== 2 ||
        typeof point1[0] !== 'number' || typeof point1[1] !== 'number' ||
        typeof point2[0] !== 'number' || typeof point2[1] !== 'number') {
      return 0;
    }
    
    const from = turf.point(point1);
    const to = turf.point(point2);
    return turf.distance(from, to, { units: 'meters' });
  } catch (error) {
    console.error('Error calculating distance:', error);
    return 0;
  }
}

export function formatArea(area: number, unit: 'metric' | 'imperial'): string {
  if (unit === 'metric') {
    if (area < 10000) {
      return `${area.toLocaleString()} m²`;
    } else {
      return `${(area / 10000).toFixed(2)} ha`;
    }
  } else {
    if (area < 43560) {
      return `${area.toLocaleString()} ft²`;
    } else {
      return `${(area / 43560).toFixed(2)} acres`;
    }
  }
}

export function formatDistance(distance: number, unit: 'metric' | 'imperial'): string {
  if (unit === 'metric') {
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    } else {
      return `${(distance / 1000).toFixed(2)} km`;
    }
  } else {
    const feet = distance * 3.28084;
    if (feet < 5280) {
      return `${Math.round(feet)} ft`;
    } else {
      return `${(feet / 5280).toFixed(2)} mi`;
    }
  }
}

// Remove walking time calculation - not needed in simplified version

export function calculatePolygonCenter(coordinates: number[][]): [number, number] {
  const polygon = turf.polygon([coordinates]);
  const centroid = turf.centroid(polygon);
  return centroid.geometry.coordinates as [number, number];
}

export function isValidPolygon(coordinates: number[][]): boolean {
  if (coordinates.length < 4) return false; // Need at least 3 vertices + closing point
  
  try {
    const polygon = turf.polygon([coordinates]);
    // Check if polygon is valid (no self-intersections, proper winding)
    return turf.booleanValid(polygon);
  } catch {
    return false;
  }
}

export function simplifyPolygon(coordinates: number[][], tolerance = 0.01): number[][] {
  try {
    const polygon = turf.polygon([coordinates]);
    const simplified = turf.simplify(polygon, { tolerance, highQuality: true });
    return simplified.geometry.coordinates[0];
  } catch {
    return coordinates;
  }
}