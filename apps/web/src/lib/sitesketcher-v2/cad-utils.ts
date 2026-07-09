import type { CadImage, CadInstance, SavedCad } from '@/types/sitesketcher-v2';

const DEFAULT_BG_THRESHOLD = 245;
const DEFAULT_CROP_PADDING = 20;

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load CAD image for cleanup'));
    image.src = url;
  });

const calculateAutoCropBounds = (
  imageData: ImageData,
  width: number,
  height: number,
  padding: number
): CropRect => {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hasContent = false;
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        hasContent = true;
      }
    }
  }

  if (!hasContent) return { x: 0, y: 0, width, height };

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  return {
    x: cropX,
    y: cropY,
    width: Math.min(width - cropX, maxX - minX + padding * 2),
    height: Math.min(height - cropY, maxY - minY + padding * 2),
  };
};

/**
 * Browser-only: knock out the white background and auto-crop a raster CAD image.
 * Returns the processed PNG blob and its new pixel dimensions. Shared by the
 * standalone uploader and the admin CAD-library uploader.
 */
export async function cleanAndCropCadImage(imageUrl: string): Promise<{
  processedBlob: Blob;
  newWidthPx: number;
  newHeightPx: number;
}> {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create canvas context');
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (
      data[i] > DEFAULT_BG_THRESHOLD &&
      data[i + 1] > DEFAULT_BG_THRESHOLD &&
      data[i + 2] > DEFAULT_BG_THRESHOLD
    ) {
      data[i + 3] = 0;
    }
  }
  context.putImageData(imageData, 0, 0);

  const cropRect = calculateAutoCropBounds(
    imageData,
    image.width,
    image.height,
    DEFAULT_CROP_PADDING
  );

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = cropRect.width;
  finalCanvas.height = cropRect.height;
  const finalContext = finalCanvas.getContext('2d');
  if (!finalContext) throw new Error('Could not create final canvas context');
  finalContext.drawImage(
    canvas,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height
  );

  const processedBlob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create processed CAD image'));
    }, 'image/png');
  });

  return {
    processedBlob,
    newWidthPx: cropRect.width,
    newHeightPx: cropRect.height,
  };
}

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
