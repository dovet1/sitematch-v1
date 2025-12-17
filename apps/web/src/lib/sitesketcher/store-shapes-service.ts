import type { StoreShape } from '@/types/sitesketcher';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

/**
 * Fetch all active store shapes from the API
 */
export async function fetchStoreShapes(): Promise<StoreShape[]> {
  const response = await fetch('/api/sitesketcher/store-shapes', {
    cache: 'no-store', // Always fetch fresh data
  });

  if (!response.ok) {
    throw new Error('Failed to fetch store shapes');
  }

  const { shapes } = await response.json();
  return shapes;
}

/**
 * Extract all coordinates from any GeoJSON geometry type
 * Recursively handles Point, LineString, Polygon, MultiPolygon, GeometryCollection
 */
function extractAllCoordinates(geometry: Geometry): Position[] {
  const coords: Position[] = [];

  function extractFromGeometry(geom: Geometry) {
    switch (geom.type) {
      case 'Point':
        coords.push(geom.coordinates);
        break;
      case 'LineString':
        coords.push(...geom.coordinates);
        break;
      case 'Polygon':
        geom.coordinates.forEach(ring => coords.push(...ring));
        break;
      case 'MultiPoint':
        coords.push(...geom.coordinates);
        break;
      case 'MultiLineString':
        geom.coordinates.forEach(line => coords.push(...line));
        break;
      case 'MultiPolygon':
        geom.coordinates.forEach(polygon =>
          polygon.forEach(ring => coords.push(...ring))
        );
        break;
      case 'GeometryCollection':
        geom.geometries.forEach(g => extractFromGeometry(g));
        break;
    }
  }

  extractFromGeometry(geometry);
  return coords;
}

/**
 * Calculate the centroid (center point) from all features in a GeoJSON object
 * Works with both Feature and FeatureCollection
 */
export function calculateFeatureCollectionCentroid(
  geojson: FeatureCollection | Feature
): [number, number] {
  let allCoords: Position[] = [];

  if (geojson.type === 'FeatureCollection') {
    geojson.features.forEach(feature => {
      if (feature.geometry) {
        allCoords.push(...extractAllCoordinates(feature.geometry));
      }
    });
  } else if (geojson.type === 'Feature' && geojson.geometry) {
    allCoords = extractAllCoordinates(geojson.geometry);
  }

  if (allCoords.length === 0) {
    return [0, 0];
  }

  const xSum = allCoords.reduce((sum, coord) => sum + coord[0], 0);
  const ySum = allCoords.reduce((sum, coord) => sum + coord[1], 0);

  return [xSum / allCoords.length, ySum / allCoords.length];
}

/**
 * Translate coordinates by a delta
 */
function translateCoordinates(coords: any, deltaLng: number, deltaLat: number): any {
  if (typeof coords[0] === 'number') {
    // It's a position [lng, lat]
    return [coords[0] + deltaLng, coords[1] + deltaLat];
  }
  // It's an array of coordinates, recurse
  return coords.map((c: any) => translateCoordinates(c, deltaLng, deltaLat));
}

/**
 * Translate a geometry by a delta
 */
function translateGeometry(geometry: Geometry, deltaLng: number, deltaLat: number): Geometry {
  const translated = { ...geometry };

  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: [geometry.coordinates[0] + deltaLng, geometry.coordinates[1] + deltaLat]
      };
    case 'LineString':
    case 'MultiPoint':
      return {
        ...geometry,
        coordinates: translateCoordinates(geometry.coordinates, deltaLng, deltaLat)
      };
    case 'Polygon':
    case 'MultiLineString':
      return {
        ...geometry,
        coordinates: translateCoordinates(geometry.coordinates, deltaLng, deltaLat)
      };
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: translateCoordinates(geometry.coordinates, deltaLng, deltaLat)
      };
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map(g => translateGeometry(g, deltaLng, deltaLat))
      };
    default:
      return geometry;
  }
}

/**
 * Scale coordinates relative to a center point
 */
function scaleCoordinates(coords: any, centerLng: number, centerLat: number, scale: number): any {
  if (typeof coords[0] === 'number') {
    // It's a position [lng, lat]
    return [
      centerLng + (coords[0] - centerLng) * scale,
      centerLat + (coords[1] - centerLat) * scale
    ];
  }
  // It's an array of coordinates, recurse
  return coords.map((c: any) => scaleCoordinates(c, centerLng, centerLat, scale));
}

/**
 * Scale a geometry relative to its center
 */
function scaleGeometry(geometry: Geometry, centerLng: number, centerLat: number, scale: number): Geometry {
  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: scaleCoordinates(geometry.coordinates, centerLng, centerLat, scale)
      };
    case 'LineString':
    case 'MultiPoint':
    case 'Polygon':
    case 'MultiLineString':
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: scaleCoordinates(geometry.coordinates, centerLng, centerLat, scale)
      };
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map(g => scaleGeometry(g, centerLng, centerLat, scale))
      };
    default:
      return geometry;
  }
}

/**
 * Translate entire FeatureCollection or Feature to a new center position
 * Used when placing a store shape at a specific location on the map
 *
 * @param geojson - The GeoJSON to transform
 * @param targetCenter - Where to place the shape center
 * @param scale - Optional scale factor or metadata object. Can be:
 *   - number: Direct scale factor (e.g., 0.0001)
 *   - object with scale_factor: Metadata from conversion (preferred)
 *   - default 1.0 if not provided
 */
export function translateFeatureCollection(
  geojson: FeatureCollection | Feature,
  targetCenter: [number, number],
  scale: number | { scale_factor?: number } = 1.0
): FeatureCollection | Feature {
  // Extract scale factor from metadata or use direct value
  const scaleFactor = typeof scale === 'number'
    ? scale
    : (scale.scale_factor || 1.0);

  const currentCenter = calculateFeatureCollectionCentroid(geojson);

  // First scale around the current center, then translate
  let scaled: FeatureCollection | Feature = geojson;

  if (scaleFactor !== 1.0) {
    if (geojson.type === 'FeatureCollection') {
      scaled = {
        ...geojson,
        features: geojson.features.map(feature => ({
          ...feature,
          geometry: feature.geometry
            ? scaleGeometry(feature.geometry, currentCenter[0], currentCenter[1], scaleFactor)
            : feature.geometry
        }))
      };
    } else if (geojson.type === 'Feature') {
      scaled = {
        ...geojson,
        geometry: geojson.geometry
          ? scaleGeometry(geojson.geometry, currentCenter[0], currentCenter[1], scaleFactor)
          : geojson.geometry
      };
    }
  }

  // Now translate to target center
  const scaledCenter = calculateFeatureCollectionCentroid(scaled);
  const deltaLng = targetCenter[0] - scaledCenter[0];
  const deltaLat = targetCenter[1] - scaledCenter[1];

  if (scaled.type === 'FeatureCollection') {
    return {
      ...scaled,
      features: scaled.features.map(feature => ({
        ...feature,
        geometry: feature.geometry
          ? translateGeometry(feature.geometry, deltaLng, deltaLat)
          : feature.geometry
      }))
    };
  } else if (scaled.type === 'Feature') {
    return {
      ...scaled,
      geometry: scaled.geometry
        ? translateGeometry(scaled.geometry, deltaLng, deltaLat)
        : scaled.geometry
    };
  }

  return scaled;
}

/**
 * Rotate entire FeatureCollection around a center point
 * Uses Web Mercator projection for accurate geographic rotation
 *
 * @param geojson - The GeoJSON to rotate
 * @param center - Center point for rotation
 * @param angleRadians - Rotation angle in radians (positive = counterclockwise)
 */
export function rotateFeatureCollection(
  geojson: FeatureCollection | Feature,
  center: [number, number],
  angleRadians: number
): FeatureCollection | Feature {
  const cosAngle = Math.cos(angleRadians);
  const sinAngle = Math.sin(angleRadians);

  // Web Mercator projection helpers
  const toWebMercator = (lng: number, lat: number): [number, number] => {
    const x = (lng * 20037508.34) / 180;
    let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
    y = (y * 20037508.34) / 180;
    return [x, y];
  };

  const fromWebMercator = (x: number, y: number): [number, number] => {
    const lng = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
    return [lng, lat];
  };

  const rotateCoord = (coord: number[]): number[] => {
    const [x, y] = toWebMercator(coord[0], coord[1]);
    const [cx, cy] = toWebMercator(center[0], center[1]);

    // Translate to origin
    const translatedX = x - cx;
    const translatedY = y - cy;

    // Rotate
    const rotatedX = translatedX * cosAngle - translatedY * sinAngle;
    const rotatedY = translatedX * sinAngle + translatedY * cosAngle;

    // Translate back and convert from Web Mercator
    const [lng, lat] = fromWebMercator(rotatedX + cx, rotatedY + cy);
    return [lng, lat];
  };

  const rotateGeometry = (geometry: Geometry): Geometry => {
    switch (geometry.type) {
      case 'Point':
        return { ...geometry, coordinates: rotateCoord(geometry.coordinates) };
      case 'LineString':
        return { ...geometry, coordinates: geometry.coordinates.map(rotateCoord) };
      case 'Polygon':
        return { ...geometry, coordinates: geometry.coordinates.map(ring => ring.map(rotateCoord)) };
      case 'MultiPoint':
        return { ...geometry, coordinates: geometry.coordinates.map(rotateCoord) };
      case 'MultiLineString':
        return { ...geometry, coordinates: geometry.coordinates.map(line => line.map(rotateCoord)) };
      case 'MultiPolygon':
        return { ...geometry, coordinates: geometry.coordinates.map(polygon => polygon.map(ring => ring.map(rotateCoord))) };
      case 'GeometryCollection':
        return { ...geometry, geometries: geometry.geometries.map(rotateGeometry) };
      default:
        return geometry;
    }
  };

  if (geojson.type === 'FeatureCollection') {
    return {
      ...geojson,
      features: geojson.features.map(f => ({
        ...f,
        geometry: f.geometry ? rotateGeometry(f.geometry) : f.geometry
      }))
    };
  } else if (geojson.type === 'Feature') {
    return {
      ...geojson,
      geometry: geojson.geometry ? rotateGeometry(geojson.geometry) : geojson.geometry
    };
  }

  return geojson;
}

/**
 * Extract the outer boundary polygon from a store shape GeoJSON
 * Calculates the bounding box of all features and returns it as a simple polygon
 *
 * @param geojson - The complex store shape GeoJSON with many features (can be Feature or FeatureCollection)
 * @returns Polygon coordinates in MapboxDrawPolygon format [[[lng, lat], ...]]
 */
export function extractOuterBoundary(geojson: FeatureCollection | Feature): number[][][] {
  // Collect all coordinates from all features
  const allCoords: [number, number][] = [];

  // Handle both FeatureCollection and single Feature
  const features = geojson.type === 'FeatureCollection'
    ? geojson.features
    : [geojson];

  features.forEach(feature => {
    if (feature.geometry) {
      const coords = extractAllCoordinates(feature.geometry);
      allCoords.push(...coords as [number, number][]);
    }
  });

  if (allCoords.length === 0) {
    // Return a small default polygon if no coordinates found
    return [[[0, 0], [0.0001, 0], [0.0001, 0.0001], [0, 0.0001], [0, 0]]];
  }

  // Find bounding box (rectangular boundary)
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  allCoords.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  // Return as closed polygon (bounding box rectangle)
  // Order: bottom-left, bottom-right, top-right, top-left, close
  return [[
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat] // Close the ring
  ]];
}

// Legacy functions for backwards compatibility
export const calculatePolygonCentroid = (coordinates: number[][][]): [number, number] => {
  const ring = coordinates[0];
  let xSum = 0;
  let ySum = 0;
  let count = 0;

  const points = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;

  points.forEach(([lng, lat]) => {
    xSum += lng;
    ySum += lat;
    count++;
  });

  return [xSum / count, ySum / count];
};

export const translatePolygon = (
  coordinates: number[][][],
  targetCenter: [number, number]
): number[][][] => {
  const currentCenter = calculatePolygonCentroid(coordinates);
  const [deltaLng, deltaLat] = [
    targetCenter[0] - currentCenter[0],
    targetCenter[1] - currentCenter[1]
  ];

  return coordinates.map(ring =>
    ring.map(([lng, lat]) => [lng + deltaLng, lat + deltaLat])
  );
};
