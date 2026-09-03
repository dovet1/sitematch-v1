import type { AutoParkingLayout, SketchData } from '@/types/sitesketcher-v2';

// Free tier limits
export const FREE_TIER_LIMITS = {
  maxPolygons: 2,
  maxParkingBlocks: 2,
  maxCadImages: 0, // Free users cannot have CAD
};

// Auto parking payload bounds — a crafted or runaway payload can't bloat the
// sketch JSONB. See docs/design_handoff_auto_parking/INTEGRATION_PLAN.md §6c.
export const AUTO_PARKING_LIMITS = {
  maxLayoutsPerSketch: 20,
  maxFeaturesPerLayout: 2000,
  maxCoordinatesPerLayout: 50_000,
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function countFeatureCoordinates(feature: { geometry?: { type?: string; coordinates?: unknown } }): number {
  const geometry = feature?.geometry;
  if (!geometry) return 0;
  if (geometry.type === 'Point') return 1;
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as unknown[][]).reduce(
      (sum, ring) => sum + (Array.isArray(ring) ? ring.length : 0),
      0
    );
  }
  return 0;
}

/**
 * Entitlement + payload-bound validation for `autoLayouts`, independent of
 * the rest of `validateSketchData` so route handlers can apply it without
 * re-running the (differently-calibrated) polygon/parking free-tier checks
 * below. "Non-empty, non-Plus" is the gate — clients routinely send `[]`.
 */
export function validateAutoLayouts(
  autoLayouts: AutoParkingLayout[] | undefined,
  hasPlusAccess: boolean
): ValidationResult {
  const layouts = autoLayouts ?? [];
  const errors: string[] = [];

  if (!hasPlusAccess) {
    if (layouts.length > 0) {
      errors.push('Auto parking layouts require Plus subscription');
    }
    return { isValid: errors.length === 0, errors };
  }

  if (layouts.length > AUTO_PARKING_LIMITS.maxLayoutsPerSketch) {
    errors.push(`A sketch is limited to ${AUTO_PARKING_LIMITS.maxLayoutsPerSketch} auto-parking layouts`);
  }
  for (const layout of layouts) {
    const features = layout.geometry?.features ?? [];
    const label = layout.name || layout.id;
    if (features.length > AUTO_PARKING_LIMITS.maxFeaturesPerLayout) {
      errors.push(`Auto parking layout "${label}" has too many geometry features`);
    }
    const coordinateCount = features.reduce((sum, f) => sum + countFeatureCoordinates(f as any), 0);
    if (coordinateCount > AUTO_PARKING_LIMITS.maxCoordinatesPerLayout) {
      errors.push(`Auto parking layout "${label}" geometry is too large`);
    }
  }

  return { isValid: errors.length === 0, errors };
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

  errors.push(...validateAutoLayouts(data.autoLayouts, hasPlusAccess).errors);

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

  // Non-Plus users: strip CAD + auto-parking data. The stored rows keep it
  // (preserve, don't destroy) for re-upgrade — see the PUT handler.
  return {
    ...data,
    cadImages: [],
    cadInstances: [],
    autoLayouts: [],
  };
}
