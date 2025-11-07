/**
 * LSOA Boundary Data Loader
 * Loads and filters LSOA polygon boundaries from GeoJSON
 */

import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';
import * as turf from '@turf/turf';

const CENSUS_DATA_DIR = path.join(process.cwd(), 'data', 'census2021');

// Define British National Grid (EPSG:27700) projection
proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs');

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
 * Load LSOA boundaries GeoJSON and convert to WGS84
 */
function loadLSOABoundaries(): LSOAGeoJSON {
  if (lsoaBoundaries) {
    return lsoaBoundaries;
  }

  const filePath = path.join(
    CENSUS_DATA_DIR,
    'Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5.geojson'
  );

  if (!fs.existsSync(filePath)) {
    console.error('LSOA boundaries file not found:', filePath);
    return { type: 'FeatureCollection', features: [] };
  }

  console.log('Loading LSOA boundaries (this may take a moment)...');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const geoJSON: LSOAGeoJSON = JSON.parse(fileContent);

  // Convert coordinates from British National Grid to WGS84 (lat/lng)
  console.log('Converting coordinates from EPSG:27700 to WGS84...');
  geoJSON.features = geoJSON.features.map((feature) => {
    const convertedCoords = convertCoordinates(feature.geometry.coordinates, feature.geometry.type);
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: convertedCoords,
      },
    };
  });

  lsoaBoundaries = geoJSON;
  console.log(`Loaded ${lsoaBoundaries.features.length} LSOA boundaries`);
  return lsoaBoundaries;
}

/**
 * Convert coordinates from EPSG:27700 (British National Grid) to WGS84
 */
function convertCoordinates(coords: any, geomType: string): any {
  if (geomType === 'Polygon') {
    // Polygon: array of rings, each ring is array of [x, y] points
    return coords.map((ring: any[]) =>
      ring.map((point: number[]) => {
        const [lng, lat] = proj4('EPSG:27700', 'EPSG:4326', point);
        return [lng, lat];
      })
    );
  } else if (geomType === 'MultiPolygon') {
    // MultiPolygon: array of polygons
    return coords.map((polygon: any[]) =>
      polygon.map((ring: any[]) =>
        ring.map((point: number[]) => {
          const [lng, lat] = proj4('EPSG:27700', 'EPSG:4326', point);
          return [lng, lat];
        })
      )
    );
  }
  return coords;
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
