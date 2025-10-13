import type { SiteSketcherState, MapboxDrawPolygon, ExportAreaBounds } from '@/types/sitesketcher';
import { calculatePolygonArea } from './measurement-utils';
import jsPDF from 'jspdf';

/**
 * Export current map view as PNG image with watermark
 * If exportBounds is provided, only captures that specific area
 */
export async function exportAsPNG(
  mapRef: any,
  filename: string = 'sketch',
  exportBounds?: ExportAreaBounds | null
): Promise<void> {
  if (!mapRef.current) {
    throw new Error('Map reference not available');
  }

  const map = mapRef.current.getMap();
  const canvas = mapRef.current.getCanvas();

  if (!map || !canvas) {
    throw new Error('Map or canvas not available');
  }

  let exportCanvas: HTMLCanvasElement;
  let exportWidth: number;
  let exportHeight: number;

  if (exportBounds) {
    // Convert lat/lng bounds to pixel coordinates
    const topLeft = map.project([exportBounds.west, exportBounds.north]);
    const bottomRight = map.project([exportBounds.east, exportBounds.south]);

    // Calculate dimensions
    exportWidth = Math.abs(bottomRight.x - topLeft.x);
    exportHeight = Math.abs(bottomRight.y - topLeft.y);

    // Create canvas with the selected area size
    exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const ctx = exportCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    console.log('Exporting selected area:', exportWidth, 'x', exportHeight);
    console.log('From pixel coords:', topLeft, 'to', bottomRight);

    // Draw the cropped area from the source canvas
    ctx.drawImage(
      canvas,
      topLeft.x, // source x
      topLeft.y, // source y
      exportWidth, // source width
      exportHeight, // source height
      0, // dest x
      0, // dest y
      exportWidth, // dest width
      exportHeight // dest height
    );

    // Add watermark
    await addWatermark(ctx, exportWidth, exportHeight);
  } else {
    // Export full canvas
    exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    console.log('Exporting full canvas:', canvas.width, 'x', canvas.height);

    // Copy the entire canvas
    ctx.drawImage(canvas, 0, 0);

    // Add watermark
    await addWatermark(ctx, canvas.width, canvas.height);

    exportWidth = canvas.width;
    exportHeight = canvas.height;
  }

  // Convert to data URL and download
  const dataUrl = exportCanvas.toDataURL('image/png', 1.0);

  if (!dataUrl || dataUrl === 'data:,') {
    throw new Error('Failed to generate image data');
  }

  console.log('Data URL length:', dataUrl.length);

  // Create download link
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Add SiteMatcher watermark to canvas
 */
async function addWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): Promise<void> {
  // Add subtle watermark in bottom right corner
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#7033ff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('SiteMatcher', width - 20, height - 20);
  ctx.restore();
}

/**
 * Calculate polygon dimensions (width and length)
 */
function calculatePolygonDimensions(coordinates: number[][]): { width: number; length: number } {
  if (coordinates.length < 3) {
    return { width: 0, length: 0 };
  }

  // Calculate distance between points
  const distances: number[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];

    // Haversine formula for distance
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    distances.push(distance);
  }

  // For a rectangle/building, take the two longest sides as length and width
  distances.sort((a, b) => b - a);

  return {
    length: distances[0] || 0,
    width: distances[1] || 0
  };
}

/**
 * Generate PDF with map image, dimensions, and parking info
 */
export async function exportAsPDF(
  state: SiteSketcherState,
  mapRef: any,
  sketchName: string = 'Untitled Sketch',
  filename: string = 'sketch',
  exportBounds?: ExportAreaBounds | null
): Promise<void> {
  if (!mapRef.current) {
    throw new Error('Map reference not available');
  }

  const map = mapRef.current.getMap();
  const canvas = mapRef.current.getCanvas();

  if (!map || !canvas) {
    throw new Error('Map or canvas not available');
  }

  let exportWidth: number;
  let exportHeight: number;
  let tempCanvas: HTMLCanvasElement;

  if (exportBounds) {
    // Convert lat/lng bounds to pixel coordinates
    const topLeft = map.project([exportBounds.west, exportBounds.north]);
    const bottomRight = map.project([exportBounds.east, exportBounds.south]);

    // Calculate dimensions
    exportWidth = Math.abs(bottomRight.x - topLeft.x);
    exportHeight = Math.abs(bottomRight.y - topLeft.y);

    // Create canvas with the selected area size
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = exportWidth;
    tempCanvas.height = exportHeight;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw the cropped area
    tempCtx.drawImage(
      canvas,
      topLeft.x,
      topLeft.y,
      exportWidth,
      exportHeight,
      0,
      0,
      exportWidth,
      exportHeight
    );
  } else {
    // Use full canvas
    const mapContainer = canvas.parentElement;
    if (!mapContainer) {
      throw new Error('Map container not found');
    }

    const visibleWidth = mapContainer.clientWidth;
    const visibleHeight = mapContainer.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    exportWidth = visibleWidth * dpr;
    exportHeight = visibleHeight * dpr;

    tempCanvas = document.createElement('canvas');
    tempCanvas.width = exportWidth;
    tempCanvas.height = exportHeight;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      throw new Error('Failed to get canvas context');
    }

    // Calculate crop area (center of canvas)
    const sourceX = (canvas.width - exportWidth) / 2;
    const sourceY = (canvas.height - exportHeight) / 2;

    // Draw the visible portion
    tempCtx.drawImage(
      canvas,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      exportWidth,
      exportHeight,
      0,
      0,
      exportWidth,
      exportHeight
    );
  }

  // Create PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;

  // Add SiteMatcher logo/header
  pdf.setFillColor(112, 51, 255); // #7033ff
  pdf.rect(0, 0, pageWidth, 25, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SiteMatcher', margin, 15);

  // Add sketch name
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(sketchName, margin, 40);

  // Add date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 47);

  // Add map image from temporary canvas
  const imgData = tempCanvas.toDataURL('image/png');
  const imgWidth = pageWidth - (margin * 2);
  const imgHeight = (exportHeight / exportWidth) * imgWidth;
  const maxImgHeight = 100; // Max height for map image
  const finalImgHeight = Math.min(imgHeight, maxImgHeight);
  const finalImgWidth = (finalImgHeight / imgHeight) * imgWidth;

  pdf.addImage(imgData, 'PNG', margin, 55, finalImgWidth, finalImgHeight);

  let yPosition = 55 + finalImgHeight + 15;

  // Add polygons section
  if (state.polygons.length > 0) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('Buildings', margin, yPosition);
    yPosition += 8;

    // Table headers
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ID', margin, yPosition);
    pdf.text('Width (ft)', margin + 40, yPosition);
    pdf.text('Length (ft)', margin + 75, yPosition);
    pdf.text('Area (sq ft)', margin + 115, yPosition);
    yPosition += 5;

    // Draw line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 7;

    // Table rows
    pdf.setFont('helvetica', 'normal');
    state.polygons.forEach((polygon, index) => {
      const area = calculatePolygonArea(polygon.geometry.coordinates[0]);
      const dimensions = calculatePolygonDimensions(polygon.geometry.coordinates[0]);
      const polygonId = polygon.properties?.id || polygon.id || `Building ${index + 1}`;

      // Convert meters to feet
      const widthFt = (dimensions.width * 3.28084).toFixed(1);
      const lengthFt = (dimensions.length * 3.28084).toFixed(1);

      pdf.text(String(polygonId), margin, yPosition);
      pdf.text(widthFt, margin + 40, yPosition);
      pdf.text(lengthFt, margin + 75, yPosition);
      pdf.text(area.squareFeet.toFixed(0), margin + 115, yPosition);
      yPosition += 6;

      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = margin;
      }
    });

    yPosition += 10;
  }

  // Add parking section
  if (state.parkingOverlays.length > 0) {
    // Check if we need a new page
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Parking', margin, yPosition);
    yPosition += 8;

    const totalParkingSpaces = state.parkingOverlays.reduce((sum, p) => sum + p.quantity, 0);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Parking Spaces: ${totalParkingSpaces}`, margin, yPosition);
    yPosition += 7;

    // Parking breakdown
    state.parkingOverlays.forEach((parking, index) => {
      pdf.text(`${parking.type}: ${parking.quantity} spaces`, margin + 5, yPosition);
      yPosition += 6;
    });
  }

  // Add footer with logo
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text('Powered by SiteMatcher', pageWidth - margin - 40, pageHeight - 10);

  // Save PDF
  pdf.save(`${filename}.pdf`);
}

/**
 * Legacy export functions (kept for compatibility but not used in menu)
 */
export function exportAsJSON(state: SiteSketcherState, filename: string = 'sketch') {
  const geojson = {
    type: 'FeatureCollection',
    features: [
      ...state.polygons.map(polygon => ({
        type: 'Feature',
        geometry: polygon.geometry,
        properties: {
          ...polygon.properties,
          type: 'polygon',
        },
      })),
      ...state.parkingOverlays.map(parking => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: parking.position,
        },
        properties: {
          type: 'parking',
          parkingType: parking.type,
          quantity: parking.quantity,
          rotation: parking.rotation,
          size: parking.size,
        },
      })),
      ...state.cuboids.map(cuboid => ({
        type: 'Feature',
        geometry: cuboid.geometry,
        properties: {
          ...cuboid.properties,
          type: 'cuboid',
        },
      })),
    ],
  };

  downloadFile(
    JSON.stringify(geojson, null, 2),
    `${filename}.geojson`,
    'application/json'
  );
}

export function exportAsCSV(state: SiteSketcherState, filename: string = 'sketch') {
  const rows: string[][] = [
    ['Type', 'Name/ID', 'Area (sq m)', 'Area (sq ft)', 'Height (m)', 'Stories', 'Notes'],
  ];

  state.polygons.forEach((polygon, index) => {
    const area = calculatePolygonArea(polygon.geometry.coordinates[0]);
    const polygonId = polygon.properties?.id || polygon.id || `Polygon ${index + 1}`;
    const height = polygon.properties?.height || '';

    rows.push([
      'Polygon',
      String(polygonId),
      area.squareMeters.toFixed(2),
      area.squareFeet.toFixed(2),
      String(height),
      '',
      '',
    ]);
  });

  state.cuboids.forEach((cuboid, index) => {
    const area = calculatePolygonArea(cuboid.geometry.coordinates[0]);
    const cuboidId = cuboid.properties?.id || cuboid.id || `Cuboid ${index + 1}`;

    rows.push([
      'Cuboid',
      String(cuboidId),
      area.squareMeters.toFixed(2),
      area.squareFeet.toFixed(2),
      String(cuboid.properties.height),
      String(cuboid.properties.stories),
      '',
    ]);
  });

  state.parkingOverlays.forEach((parking, index) => {
    rows.push([
      'Parking',
      `Parking ${index + 1}`,
      '',
      '',
      '',
      '',
      `${parking.type}, ${parking.quantity} spaces`,
    ]);
  });

  const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
