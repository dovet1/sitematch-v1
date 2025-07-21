import * as turf from '@turf/turf';
import type { ParkingOverlay, ParkingConfiguration } from '@/types/sitesketcher';
import { PARKING_SIZES } from '@/types/sitesketcher';

export function calculateRotationAngle(
  centerPoint: [number, number],
  currentPoint: [number, number],
  startPoint: [number, number]
): number {
  // Vector math to calculate angle from center
  const startVector = [startPoint[0] - centerPoint[0], startPoint[1] - centerPoint[1]];
  const currentVector = [currentPoint[0] - centerPoint[0], currentPoint[1] - centerPoint[1]];
  
  const angle = Math.atan2(currentVector[1], currentVector[0]) - Math.atan2(startVector[1], startVector[0]);
  return (angle * 180) / Math.PI;
}

export function snapToAngle(angle: number, snapIncrement = 15): number {
  const normalizedAngle = ((angle % 360) + 360) % 360; // Normalize to 0-360
  const snappedAngle = Math.round(normalizedAngle / snapIncrement) * snapIncrement;
  return snappedAngle % 360;
}

export function isNearSnapAngle(angle: number, snapIncrement = 15, tolerance = 7.5): boolean {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  const nearestSnap = Math.round(normalizedAngle / snapIncrement) * snapIncrement;
  const diff = Math.abs(normalizedAngle - nearestSnap);
  return diff <= tolerance || diff >= (360 - tolerance);
}

export function calculateParkingSpaceCoordinates(
  overlay: ParkingOverlay
): number[][] {
  const { position, rotation, size } = overlay;
  const [centerLng, centerLat] = position;
  
  // Convert size from meters to approximate degrees (rough conversion for display)
  const metersToLng = size.width / 111320; // Approximate meters per degree longitude
  const metersToLat = size.length / 110540; // Approximate meters per degree latitude
  
  // Create rectangle corners relative to center
  const halfWidth = metersToLng / 2;
  const halfLength = metersToLat / 2;
  
  const corners = [
    [-halfWidth, -halfLength],
    [halfWidth, -halfLength],
    [halfWidth, halfLength],
    [-halfWidth, halfLength],
    [-halfWidth, -halfLength] // Close the polygon
  ];
  
  // Apply rotation
  const rotationRad = (rotation * Math.PI) / 180;
  const rotatedCorners = corners.map(([x, y]) => {
    const rotatedX = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
    const rotatedY = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
    return [centerLng + rotatedX, centerLat + rotatedY];
  });
  
  return rotatedCorners;
}

export function calculateParkingCapacity(
  polygonCoordinates: number[][],
  parkingConfig: ParkingConfiguration
): number {
  try {
    const polygon = turf.polygon([polygonCoordinates]);
    const polygonArea = turf.area(polygon); // Square meters
    
    const { width, length } = parkingConfig.dimensions;
    const spaceArea = width * length;
    
    // Add buffer for driving lanes and maneuvering space
    const efficiency = parkingConfig.type === 'double' ? 0.75 : 0.65; // Double layer is more efficient
    
    const theoreticalSpaces = Math.floor((polygonArea * efficiency) / spaceArea);
    
    return Math.max(0, theoreticalSpaces);
  } catch (error) {
    console.error('Error calculating parking capacity:', error);
    return 0;
  }
}

export function generateParkingLayout(
  polygonCoordinates: number[][],
  parkingConfig: ParkingConfiguration
): ParkingOverlay[] {
  try {
    const polygon = turf.polygon([polygonCoordinates]);
    const bbox = turf.bbox(polygon);
    const [minLng, minLat, maxLng, maxLat] = bbox;
    
    const { width, length } = parkingConfig.dimensions;
    const overlays: ParkingOverlay[] = [];
    
    // Convert meters to degrees (approximate)
    const spacingLng = width / 111320;
    const spacingLat = length / 110540;
    
    // Add some spacing between parking spaces
    const buffer = 1.2; // 20% buffer for maneuvering
    
    let id = 1;
    for (let lat = minLat + spacingLat/2; lat < maxLat - spacingLat/2; lat += spacingLat * buffer) {
      for (let lng = minLng + spacingLng/2; lng < maxLng - spacingLng/2; lng += spacingLng * buffer) {
        const point = turf.point([lng, lat]);
        
        // Only place parking spaces inside the polygon
        if (turf.booleanPointInPolygon(point, polygon)) {
          overlays.push({
            id: `parking-${id++}`,
            position: [lng, lat],
            rotation: 0,
            type: parkingConfig.type,
            size: parkingConfig.dimensions,
            quantity: 1
          });
          
          if (overlays.length >= parkingConfig.quantity) {
            break;
          }
        }
      }
      if (overlays.length >= parkingConfig.quantity) {
        break;
      }
    }
    
    return overlays;
  } catch (error) {
    console.error('Error generating parking layout:', error);
    return [];
  }
}

export function validateParkingOverlay(overlay: ParkingOverlay): boolean {
  const { position, rotation, size, type } = overlay;
  
  // Check if position is valid coordinates
  if (!Array.isArray(position) || position.length !== 2) return false;
  if (typeof position[0] !== 'number' || typeof position[1] !== 'number') return false;
  
  // Check if rotation is valid
  if (typeof rotation !== 'number' || rotation < 0 || rotation >= 360) return false;
  
  // Check if size is valid
  if (!size || typeof size.width !== 'number' || typeof size.length !== 'number') return false;
  if (size.width <= 0 || size.length <= 0) return false;
  
  // Check if type is valid
  if (type !== 'single' && type !== 'double') return false;
  
  return true;
}

export function getRotationHandlePositions(overlay: ParkingOverlay): Array<{
  id: string;
  position: [number, number];
  type: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> {
  const coordinates = calculateParkingSpaceCoordinates(overlay);
  
  return [
    { id: `${overlay.id}-tl`, position: coordinates[0] as [number, number], type: 'top-left' },
    { id: `${overlay.id}-tr`, position: coordinates[1] as [number, number], type: 'top-right' },
    { id: `${overlay.id}-br`, position: coordinates[2] as [number, number], type: 'bottom-right' },
    { id: `${overlay.id}-bl`, position: coordinates[3] as [number, number], type: 'bottom-left' }
  ];
}