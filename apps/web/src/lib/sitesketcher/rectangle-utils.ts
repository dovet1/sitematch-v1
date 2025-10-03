/**
 * Utility functions for creating rectangles in SiteSketcher
 */

/**
 * Convert meters to degrees at a given latitude
 * This is an approximation that works well for small distances
 */
function metersToDegrees(meters: number, latitude: number): { lat: number; lng: number } {
  // At the equator: 1 degree latitude ≈ 111,320 meters
  const metersPerDegreeLat = 111320;

  // Longitude degrees vary with latitude
  const metersPerDegreeLng = 111320 * Math.cos(latitude * Math.PI / 180);

  return {
    lat: meters / metersPerDegreeLat,
    lng: meters / metersPerDegreeLng
  };
}

/**
 * Creates GeoJSON coordinates for a rectangle given center point and dimensions
 *
 * @param center - Center point as [lng, lat]
 * @param widthMeters - Width of rectangle in meters
 * @param lengthMeters - Length of rectangle in meters
 * @param bearingDegrees - Rotation angle in degrees (0 = aligned with north-south, 90 = aligned with east-west)
 * @returns GeoJSON polygon coordinates array
 */
export function createRectangleCoordinates(
  center: [number, number],
  widthMeters: number,
  lengthMeters: number,
  bearingDegrees: number = 0
): number[][][] {
  const [centerLng, centerLat] = center;

  // Convert meters to degrees
  const offset = metersToDegrees(1, centerLat);
  const halfWidth = (widthMeters / 2) * offset.lng;
  const halfLength = (lengthMeters / 2) * offset.lat;

  // Create rectangle corners (before rotation)
  // Starting from bottom-left, going counter-clockwise
  const corners: [number, number][] = [
    [-halfWidth, -halfLength], // Bottom-left
    [halfWidth, -halfLength],  // Bottom-right
    [halfWidth, halfLength],   // Top-right
    [-halfWidth, halfLength],  // Top-left
    [-halfWidth, -halfLength]  // Close the polygon
  ];

  // Apply rotation if bearing is specified
  const bearingRad = bearingDegrees * Math.PI / 180;
  const cosTheta = Math.cos(bearingRad);
  const sinTheta = Math.sin(bearingRad);

  const rotatedCorners = corners.map(([x, y]) => {
    // Rotate around origin
    const rotatedX = x * cosTheta - y * sinTheta;
    const rotatedY = x * sinTheta + y * cosTheta;

    // Translate to center position
    return [centerLng + rotatedX, centerLat + rotatedY];
  });

  // Return in GeoJSON format (array of rings, where first ring is exterior)
  return [rotatedCorners];
}

/**
 * Converts imperial measurements to meters
 */
export function feetToMeters(feet: number): number {
  return feet * 0.3048;
}

/**
 * Converts meters to imperial measurements
 */
export function metersToFeet(meters: number): number {
  return meters / 0.3048;
}
