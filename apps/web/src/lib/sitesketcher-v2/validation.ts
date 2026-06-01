import type { SketchData } from '@/types/sitesketcher-v2';

// Free tier limits
export const FREE_TIER_LIMITS = {
  maxPolygons: 2,
  maxParkingBlocks: 2,
  maxCadImages: 0, // Free users cannot have CAD
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateSketchData(
  data: SketchData,
  hasProAccess: boolean,
  hasPlusAccess: boolean
): ValidationResult {
  const errors: string[] = [];

  // Free tier validation
  if (!hasProAccess) {
    if (data.polygons.length > FREE_TIER_LIMITS.maxPolygons) {
      errors.push(`Free users are limited to ${FREE_TIER_LIMITS.maxPolygons} polygons`);
    }
    if (data.parkingBlocks.length > FREE_TIER_LIMITS.maxParkingBlocks) {
      errors.push(`Free users are limited to ${FREE_TIER_LIMITS.maxParkingBlocks} parking blocks`);
    }
    if ((data.cadImages?.length || 0) > 0 || (data.cadInstances?.length || 0) > 0) {
      errors.push('Free users cannot have CAD overlays');
    }
  }

  // CAD is Plus-only (Pro users also cannot have CAD)
  if (!hasPlusAccess) {
    if ((data.cadImages?.length || 0) > 0 || (data.cadInstances?.length || 0) > 0) {
      errors.push('CAD overlay requires Plus subscription');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes sketch data for GET responses based on user tier.
 * Returns a copy with CAD arrays filtered out for non-Plus users.
 */
export function sanitizeSketchForUser(
  data: SketchData,
  hasPlusAccess: boolean
): SketchData {
  if (hasPlusAccess) {
    // Plus users see everything
    return data;
  }

  // Non-Plus users: strip CAD data
  return {
    ...data,
    cadImages: [],
    cadInstances: [],
  };
}
