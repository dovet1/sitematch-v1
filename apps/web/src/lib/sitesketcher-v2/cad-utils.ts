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
  const widthMetres = imageWidthPx * metresPerPixel;
  const heightMetres = imageHeightPx * metresPerPixel;
  const halfWidth = widthMetres / 2;
  const halfHeight = heightMetres / 2;

  const localCorners: [number, number][] = [
    [-halfWidth, halfHeight], // topLeft
    [halfWidth, halfHeight], // topRight
    [halfWidth, -halfHeight], // bottomRight
    [-halfWidth, -halfHeight], // bottomLeft
  ];

  return localCorners.map(([eastMeters, northMeters]) => {
    const [rotatedEast, rotatedNorth] = rotateLocalPoint(eastMeters, northMeters, rotation);
    return localMetresToLngLat(anchor, rotatedEast, rotatedNorth);
  }) as [[number, number], [number, number], [number, number], [number, number]];
}

function rotateLocalPoint(
  eastMeters: number,
  northMeters: number,
  angleDegrees: number
): [number, number] {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return [
    eastMeters * cos - northMeters * sin,
    eastMeters * sin + northMeters * cos,
  ];
}

function localMetresToLngLat(
  anchor: [number, number],
  eastMeters: number,
  northMeters: number
): [number, number] {
  const metersPerDegreeLat = 110540;
  const metersPerDegreeLng = 111320 * Math.cos(anchor[1] * Math.PI / 180);

  return [
    anchor[0] + eastMeters / metersPerDegreeLng,
    anchor[1] + northMeters / metersPerDegreeLat,
  ];
}
