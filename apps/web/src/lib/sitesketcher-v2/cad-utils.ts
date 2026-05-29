import type { CadImage, CadInstance, SavedCad } from '@/types/sitesketcher-v2';

/**
 * Calculate the four corner coordinates for a CAD image on the map
 * Returns [topLeft, topRight, bottomRight, bottomLeft] in [lng, lat] format
 *
 * Supports both legacy CadImage and new CadInstance + SavedCad model
 */
export function calculateCadImageCorners(
  cadImageOrInstance: CadImage | CadInstance,
  savedCad?: SavedCad
): [[number, number], [number, number], [number, number], [number, number]] {
  // Handle legacy CadImage
  if ('fileName' in cadImageOrInstance) {
    const cadImage = cadImageOrInstance as CadImage;
    if (cadImage.anchor === null) {
      throw new Error(`Cannot calculate corners for unplaced CAD ${cadImage.id}`);
    }
    const { anchor, imageWidthPx, imageHeightPx, metresPerPixel, rotation } = cadImage;
    return calculateCornersFromParams(anchor, imageWidthPx, imageHeightPx, metresPerPixel, rotation);
  }

  // Handle new CadInstance + SavedCad model
  const instance = cadImageOrInstance as CadInstance;
  if (!savedCad) {
    throw new Error(`SavedCad required for CadInstance ${instance.id}`);
  }
  const { anchor, rotation } = instance;
  const { imageWidthPx, imageHeightPx, metresPerPixel } = savedCad;
  return calculateCornersFromParams(anchor, imageWidthPx, imageHeightPx, metresPerPixel, rotation);
}

/**
 * Internal helper to calculate corners from parameters
 */
function calculateCornersFromParams(
  anchor: [number, number],
  imageWidthPx: number,
  imageHeightPx: number,
  metresPerPixel: number,
  rotation: number
): [[number, number], [number, number], [number, number], [number, number]] {

  // Calculate image extent in meters
  const widthMetres = imageWidthPx * metresPerPixel;
  const heightMetres = imageHeightPx * metresPerPixel;

  // Convert to degrees at anchor latitude
  const metersPerDegreeLat = 110540;
  const metersPerDegreeLng = 111320 * Math.cos(anchor[1] * Math.PI / 180);

  const widthDegrees = widthMetres / metersPerDegreeLng;
  const heightDegrees = heightMetres / metersPerDegreeLat;

  // Calculate unrotated corners
  const halfWidth = widthDegrees / 2;
  const halfHeight = heightDegrees / 2;

  const corners: [number, number][] = [
    [anchor[0] - halfWidth, anchor[1] + halfHeight], // topLeft
    [anchor[0] + halfWidth, anchor[1] + halfHeight], // topRight
    [anchor[0] + halfWidth, anchor[1] - halfHeight], // bottomRight
    [anchor[0] - halfWidth, anchor[1] - halfHeight], // bottomLeft
  ];

  // Apply rotation if needed
  if (rotation !== 0) {
    return corners.map(corner => rotatePoint(corner, anchor, rotation)) as any;
  }

  return corners as any;
}

/**
 * Rotate a point around a center point by a given angle
 */
function rotatePoint(
  point: [number, number],
  center: [number, number],
  angleDegrees: number
): [number, number] {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const dx = point[0] - center[0];
  const dy = point[1] - center[1];

  return [
    center[0] + (dx * cos - dy * sin),
    center[1] + (dx * sin + dy * cos),
  ];
}
