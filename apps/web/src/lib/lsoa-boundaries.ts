/**
 * LSOA Boundary Data Loader
 * Loads and filters LSOA polygon boundaries from GeoJSON
 */

import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';

const CENSUS_DATA_DIR = path.join(process.cwd(), 'data', 'census2021');

interface LSOAFeature {
  type: 'Feature';
  id: number;
  properties: {
    LSOA21CD: string;
    LSOA21NM: string;
    LAT: number;
    LONG: number;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
}

interface LSOAGeoJSON {
  type: 'FeatureCollection';
  features: LSOAFeature[];
}

// Cache for loaded GeoJSON
let lsoaBoundaries: LSOAGeoJSON | null = null;

/**
 * Load LSOA boundaries GeoJSON (pre-converted to WGS84)
 * Note: Boundaries are pre-converted using scripts/convert-lsoa-boundaries.ts
 */
function loadLSOABoundaries(): LSOAGeoJSON {
  if (lsoaBoundaries) {
    return lsoaBoundaries;
  }

  // Use pre-converted WGS84 file for faster loading
  const filePath = path.join(
    CENSUS_DATA_DIR,
    'Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_WGS84.geojson'
  );

  if (!fs.existsSync(filePath)) {
    console.error('LSOA boundaries file not found:', filePath);
    console.error('Run: npx tsx scripts/convert-lsoa-boundaries.ts');
    return { type: 'FeatureCollection', features: [] };
  }

  console.log('Loading LSOA boundaries (pre-converted to WGS84)...');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const geoJSON: LSOAGeoJSON = JSON.parse(fileContent);

  lsoaBoundaries = geoJSON;
  console.log(`Loaded ${lsoaBoundaries.features.length} LSOA boundaries`);
  return lsoaBoundaries;
}


/**
 * Check if an LSOA polygon intersects with a radius circle
 */
function doesLSOAIntersectRadius(
  lsoaFeature: LSOAFeature,
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): boolean {
  try {
    // Validate coordinates - skip if invalid
    if (!lsoaFeature.geometry.coordinates || lsoaFeature.geometry.coordinates.length === 0) {
      return false;
    }

    // Create a circle around the search point
    const center = turf.point([centerLng, centerLat]);
    const radiusKm = radiusMiles * 1.60934; // Convert miles to km
    const circle = turf.circle(center, radiusKm, { units: 'kilometers' });

    // Handle both Polygon and MultiPolygon
    let lsoaGeometry: any;
    if (lsoaFeature.geometry.type === 'Polygon') {
      lsoaGeometry = turf.polygon(lsoaFeature.geometry.coordinates as any);
    } else if (lsoaFeature.geometry.type === 'MultiPolygon') {
      lsoaGeometry = turf.multiPolygon(lsoaFeature.geometry.coordinates as any);
    } else {
      return false;
    }

    // Check if they intersect
    return turf.booleanIntersects(circle, lsoaGeometry);
  } catch (error) {
    // Silently skip invalid polygons (likely have < 4 points)
    return false;
  }
}

/**
 * Get LSOA polygons that intersect with a radius circle
 * Returns filtered GeoJSON with only matching LSOAs
 */
export function getLSOAPolygonsInRadius(
  lat: number,
  lng: number,
  radiusMiles: number
): { type: 'FeatureCollection'; features: LSOAFeature[] } {
  const boundaries = loadLSOABoundaries();

  console.log(`Filtering ${boundaries.features.length} LSOAs for radius ${radiusMiles}mi around (${lat}, ${lng})...`);

  const matchingFeatures = boundaries.features.filter((feature) =>
    doesLSOAIntersectRadius(feature, lat, lng, radiusMiles)
  );

  console.log(`Found ${matchingFeatures.length} LSOAs intersecting radius`);

  return {
    type: 'FeatureCollection',
    features: matchingFeatures,
  };
}

/**
 * Get LSOA codes that intersect with a radius circle
 * (More accurate than centroid-based filtering)
 */
export function getLSOACodesInRadiusWithPolygons(
  lat: number,
  lng: number,
  radiusMiles: number
): string[] {
  const polygons = getLSOAPolygonsInRadius(lat, lng, radiusMiles);
  return polygons.features.map((f) => f.properties.LSOA21CD);
}

/**
 * Get LSOA polygon features by their codes
 * Used to fetch adjacent LSOAs after finding their codes from the neighbor table
 */
export function getLSOAPolygonsByCodes(
  lsoaCodes: string[]
): { type: 'FeatureCollection'; features: LSOAFeature[] } {
  const boundaries = loadLSOABoundaries();
  const codeSet = new Set(lsoaCodes);

  const matchingFeatures = boundaries.features.filter((feature) =>
    codeSet.has(feature.properties.LSOA21CD)
  );

  return {
    type: 'FeatureCollection',
    features: matchingFeatures,
  };
}

/**
 * Check if an LSOA polygon intersects with an isochrone polygon
 */
function doesLSOAIntersectIsochrone(
  lsoaFeature: LSOAFeature,
  isochroneCoordinates: number[][][]
): boolean {
  try {
    // Validate coordinates
    if (!lsoaFeature.geometry.coordinates || lsoaFeature.geometry.coordinates.length === 0) {
      return false;
    }

    // Create isochrone polygon
    const isochronePolygon = turf.polygon(isochroneCoordinates);

    // Handle both Polygon and MultiPolygon for LSOA
    let lsoaGeometry: any;
    if (lsoaFeature.geometry.type === 'Polygon') {
      lsoaGeometry = turf.polygon(lsoaFeature.geometry.coordinates as any);
    } else if (lsoaFeature.geometry.type === 'MultiPolygon') {
      lsoaGeometry = turf.multiPolygon(lsoaFeature.geometry.coordinates as any);
    } else {
      return false;
    }

    // Check if they intersect
    return turf.booleanIntersects(isochronePolygon, lsoaGeometry);
  } catch (error) {
    // Silently skip invalid polygons
    return false;
  }
}

/**
 * Get LSOA polygons that intersect with an isochrone polygon
 * Returns filtered GeoJSON with only matching LSOAs
 */
export function getLSOAPolygonsInIsochrone(
  isochroneCoordinates: number[][][]
): { type: 'FeatureCollection'; features: LSOAFeature[] } {
  const boundaries = loadLSOABoundaries();

  console.log(`Filtering ${boundaries.features.length} LSOAs for isochrone polygon...`);

  const matchingFeatures = boundaries.features.filter((feature) =>
    doesLSOAIntersectIsochrone(feature, isochroneCoordinates)
  );

  console.log(`Found ${matchingFeatures.length} LSOAs intersecting isochrone`);

  return {
    type: 'FeatureCollection',
    features: matchingFeatures,
  };
}

/**
 * Get LSOA codes that intersect with an isochrone polygon
 */
export function getLSOACodesInIsochrone(
  isochroneCoordinates: number[][][]
): string[] {
  const polygons = getLSOAPolygonsInIsochrone(isochroneCoordinates);
  return polygons.features.map((f) => f.properties.LSOA21CD);
}
