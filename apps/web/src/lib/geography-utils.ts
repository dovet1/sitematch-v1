/**
 * Geography calculation utilities for demographics analysis
 */

/**
 * Check if a point is within a given radius of a center point
 * Uses Haversine formula for accurate distance calculation
 */
export function isPointInRadius(
  centerLat: number,
  centerLng: number,
  radiusMiles: number,
  pointLat: number,
  pointLng: number
): boolean {
  const distance = calculateDistance(centerLat, centerLng, pointLat, pointLng);
  return distance <= radiusMiles;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get bounding box for a center point and radius
 * Returns { north, south, east, west } in degrees
 */
export function getBoundingBox(
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): { north: number; south: number; east: number; west: number } {
  // Rough approximation: 1 degree latitude ≈ 69 miles
  // 1 degree longitude varies by latitude, approximately 69 * cos(latitude) miles
  const latDegrees = radiusMiles / 69;
  const lngDegrees = radiusMiles / (69 * Math.cos(toRadians(centerLat)));

  return {
    north: centerLat + latDegrees,
    south: centerLat - latDegrees,
    east: centerLng + lngDegrees,
    west: centerLng - lngDegrees,
  };
}

/**
 * Convert miles to meters
 */
export function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

/**
 * Convert miles to kilometers
 */
export function milesToKilometers(miles: number): number {
  return miles * 1.60934;
}

/**
 * Calculate approximate area of a circle in square kilometers
 */
export function calculateCircleArea(radiusMiles: number): number {
  const radiusKm = milesToKilometers(radiusMiles);
  return Math.PI * radiusKm * radiusKm;
}

/**
 * Helper to convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Helper to convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
