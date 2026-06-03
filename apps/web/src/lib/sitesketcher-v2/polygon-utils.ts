import mapboxgl from 'mapbox-gl';
import { SNAP_ANGLE } from './constants';

/**
 * Helper function to calculate circular angular distance between two angles.
 * Handles wraparound at ±180° correctly.
 */
function angleDelta(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Snap to 90° angles using screen-space (projected) coordinates.
 * This avoids distortion from lng/lat spherical geometry at UK latitudes.
 *
 * @param previousEdgeStart - Optional start point of the previous edge for relative perpendicular snapping
 */
export function snapTo90Degrees(
  map: mapboxgl.Map,
  lastLngLat: [number, number],
  currentLngLat: [number, number],
  previousEdgeStart?: [number, number] | null
): [number, number] {
  // Convert to screen coordinates (pixels)
  const lastPoint = map.project(lastLngLat);
  const currentPoint = map.project(currentLngLat);

  // Calculate current cursor angle and distance in screen space
  const dx = currentPoint.x - lastPoint.x;
  const dy = currentPoint.y - lastPoint.y;
  const cursorAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  const distance = Math.sqrt(dx * dx + dy * dy);

  let snappedAngle: number;

  // Case 1: No previous edge - snap to absolute cardinal directions
  if (!previousEdgeStart) {
    snappedAngle = Math.round(cursorAngle / SNAP_ANGLE) * SNAP_ANGLE;
  }
  // Case 2: Previous edge exists - snap perpendicular to it
  else {
    // Calculate previous edge angle in screen space
    const prevEdgeStart = map.project(previousEdgeStart);
    const prevEdgeEnd = lastPoint;

    const prevDx = prevEdgeEnd.x - prevEdgeStart.x;
    const prevDy = prevEdgeEnd.y - prevEdgeStart.y;
    const prevEdgeLength = Math.sqrt(prevDx * prevDx + prevDy * prevDy);

    // If previous edge is effectively zero-length, fall back to absolute snapping
    if (prevEdgeLength < 0.1) {
      snappedAngle = Math.round(cursorAngle / SNAP_ANGLE) * SNAP_ANGLE;
    } else {
      const prevEdgeAngle = Math.atan2(prevDy, prevDx) * (180 / Math.PI);

      // Calculate two perpendicular angles (±90° from previous edge)
      const perpAngle1 = prevEdgeAngle + 90;
      const perpAngle2 = prevEdgeAngle - 90;

      // Choose the perpendicular angle closest to cursor direction using circular distance
      const diff1 = angleDelta(cursorAngle, perpAngle1);
      const diff2 = angleDelta(cursorAngle, perpAngle2);

      snappedAngle = diff1 < diff2 ? perpAngle1 : perpAngle2;
    }
  }

  // Calculate snapped screen position
  const snappedX = lastPoint.x + distance * Math.cos((snappedAngle * Math.PI) / 180);
  const snappedY = lastPoint.y + distance * Math.sin((snappedAngle * Math.PI) / 180);

  // Convert back to lng/lat
  const snappedLngLat = map.unproject([snappedX, snappedY]);
  return [snappedLngLat.lng, snappedLngLat.lat];
}

/**
 * Get the display cursor position with optional snapping.
 * Ensures consistent snapping between Draw's preview line and overlay label.
 */
export function getDisplayCursorPosition(
  map: mapboxgl.Map,
  rawCursorPosition: [number, number],
  lastConfirmedPoint: [number, number] | null,
  isShiftHeld: boolean,
  previousEdgeStart?: [number, number] | null
): [number, number] {
  if (!isShiftHeld || !lastConfirmedPoint) {
    return rawCursorPosition;
  }
  return snapTo90Degrees(map, lastConfirmedPoint, rawCursorPosition, previousEdgeStart);
}

/**
 * Calculate edge distance between two points in meters
 */
export function calculateEdgeDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const turf = require('@turf/distance');
  return turf.default(point1, point2, { units: 'meters' });
}

/**
 * Calculate edge distances for all edges of a polygon
 */
export function calculateAllEdgeDistances(points: [number, number][]): number[] {
  const distances: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const nextIndex = (i + 1) % points.length;
    const distance = calculateEdgeDistance(points[i], points[nextIndex]);
    distances.push(distance);
  }

  return distances;
}

/**
 * Calculate midpoint between two points for label placement
 */
export function calculateMidpoint(
  point1: [number, number],
  point2: [number, number]
): [number, number] {
  return [(point1[0] + point2[0]) / 2, (point1[1] + point2[1]) / 2];
}

/**
 * Format distance for display based on units
 */
export function formatDistance(meters: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 100) {
      return `${feet.toFixed(1)}ft`;
    }
    return `${feet.toFixed(0)}ft`;
  }

  if (meters < 10) {
    return `${meters.toFixed(2)}m`;
  }
  if (meters < 100) {
    return `${meters.toFixed(1)}m`;
  }
  return `${meters.toFixed(0)}m`;
}

/**
 * Format polygon line distance as whole metres or feet.
 */
export function formatPolygonLineDistance(meters: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    return `${Math.round(meters * 3.28084)}ft`;
  }

  return `${Math.round(meters)}m`;
}

/**
 * Calculate and format distance between two coordinates.
 */
export function calculateDistance(
  point1: [number, number],
  point2: [number, number],
  units: 'metric' | 'imperial'
): string {
  return formatDistance(calculateEdgeDistance(point1, point2), units);
}

/**
 * Calculate area of a polygon in square meters
 */
export function calculatePolygonArea(points: [number, number][]): number {
  const turf = require('@turf/area');
  return turf.default({
    type: 'Polygon',
    coordinates: [points],
  });
}

/**
 * Format area for display based on units
 */
export function calculateArea(points: [number, number][], units: 'metric' | 'imperial'): string {
  const sqMeters = calculatePolygonArea(points);

  if (units === 'imperial') {
    const sqFeet = sqMeters * 10.7639;
    if (sqFeet < 10000) {
      return `${sqFeet.toFixed(0)} sq ft`;
    }
    const acres = sqFeet / 43560;
    return `${acres.toFixed(2)} acres`;
  }

  if (sqMeters < 10000) {
    return `${sqMeters.toFixed(1)} m²`;
  }
  const hectares = sqMeters / 10000;
  return `${hectares.toFixed(2)} ha`;
}

/**
 * Format polygon area as both the selected square unit and larger land unit.
 */
export function formatAreaBreakdown(
  points: [number, number][],
  units: 'metric' | 'imperial'
): { primary: string; secondary: string } {
  const sqMeters = calculatePolygonArea(points);

  if (units === 'imperial') {
    const sqFeet = sqMeters * 10.7639;
    const acres = sqFeet / 43560;

    return {
      primary: `${sqFeet.toFixed(0)} sq ft`,
      secondary: `${acres.toFixed(2)} acres`,
    };
  }

  const hectares = sqMeters / 10000;

  return {
    primary: `${sqMeters.toFixed(1)} m²`,
    secondary: `${hectares.toFixed(2)} ha`,
  };
}

/**
 * Check if a polygon is closed (first and last points are the same)
 */
export function isPolygonClosed(points: [number, number][]): boolean {
  if (points.length < 3) return false;

  const first = points[0];
  const last = points[points.length - 1];

  const threshold = 0.000001; // ~0.1m tolerance
  return (
    Math.abs(first[0] - last[0]) < threshold &&
    Math.abs(first[1] - last[1]) < threshold
  );
}

/**
 * Close a polygon by adding the first point at the end if not already closed
 */
export function closePolygon(points: [number, number][]): [number, number][] {
  if (isPolygonClosed(points)) {
    return points;
  }
  return [...points, points[0]];
}

/**
 * Calculate the angle of an edge for label rotation
 */
export function calculateEdgeAngle(
  map: mapboxgl.Map,
  point1: [number, number],
  point2: [number, number]
): number {
  const p1 = map.project(point1);
  const p2 = map.project(point2);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Keep text upright
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  return angle;
}

/**
 * Calculate centroid (center point) of a polygon
 */
export function calculateCentroid(points: [number, number][]): [number, number] {
  const sum = points.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
    [0, 0]
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

/**
 * Rotate polygon points around centroid in screen-space.
 * Uses screen-space projection to avoid spherical geometry distortion.
 * Original points array is not modified - returns new rotated array.
 */
export function rotatePolygonPoints(
  points: [number, number][],
  rotationDegrees: number,
  map: mapboxgl.Map
): [number, number][] {
  if (rotationDegrees === 0 || points.length === 0) return points;

  // Calculate centroid in lng/lat
  const centroid = calculateCentroid(points);

  // Project centroid to screen space
  const centroidScreen = map.project(centroid);

  // Convert rotation to radians
  const rotationRadians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);

  // Rotate each point around centroid in screen space
  const rotatedPoints = points.map(point => {
    // Project to screen space
    const pointScreen = map.project(point);

    // Get relative position
    const relX = pointScreen.x - centroidScreen.x;
    const relY = pointScreen.y - centroidScreen.y;

    // Apply rotation
    const rotX = relX * cos - relY * sin;
    const rotY = relX * sin + relY * cos;

    // Convert back to screen space
    const rotatedScreen: [number, number] = [
      centroidScreen.x + rotX,
      centroidScreen.y + rotY
    ];

    // Unproject back to lng/lat
    const rotatedLngLat = map.unproject(rotatedScreen);
    return [rotatedLngLat.lng, rotatedLngLat.lat] as [number, number];
  });

  return rotatedPoints;
}
