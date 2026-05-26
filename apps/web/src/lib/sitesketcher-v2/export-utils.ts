import { calculateArea } from './polygon-utils';
import type { Polygon, ParkingBlock } from '@/types/sitesketcher-v2';

/**
 * Export sketch as JSON file
 */
export function exportJSON(sketch: any) {
  const data = {
    version: 2,
    name: sketch.name,
    description: sketch.description,
    exportedAt: new Date().toISOString(),
    data: sketch.data,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  downloadBlob(blob, `${sanitizeFilename(sketch.name)}.json`);
}

/**
 * Export sketch data as CSV file
 */
export function exportCSV(sketch: any) {
  const rows: string[][] = [
    ['Type', 'Name', 'Area (m²)', 'Area (ft²)', 'Height (m)', 'Spaces', 'Notes'],
  ];

  // Add polygons
  if (sketch.data.polygons) {
    sketch.data.polygons.forEach((polygon: Polygon) => {
      const areaSqM = calculateArea(polygon.points, 'metric');
      const areaSqFt = calculateArea(polygon.points, 'imperial');
      rows.push([
        'Polygon',
        polygon.name,
        areaSqM.replace(/[^\d.]/g, ''),
        areaSqFt.replace(/[^\d.]/g, ''),
        polygon.height.toString(),
        '',
        `Color: ${polygon.colorIndex}`,
      ]);
    });
  }

  // Add parking blocks
  if (sketch.data.parkingBlocks) {
    sketch.data.parkingBlocks.forEach((parking: ParkingBlock) => {
      rows.push([
        'Parking',
        parking.name,
        '',
        '',
        '',
        parking.spaces.toString(),
        `${parking.layout} / ${parking.stallSize}`,
      ]);
    });
  }

  // Add CAD images
  if (sketch.data.cadImages) {
    sketch.data.cadImages.forEach((cad: any) => {
      rows.push([
        'CAD Image',
        cad.fileName,
        '',
        '',
        '',
        '',
        `Scale: ${cad.metresPerPixel.toFixed(4)} m/px`,
      ]);
    });
  }

  const csv = rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });

  downloadBlob(blob, `${sanitizeFilename(sketch.name)}.csv`);
}

/**
 * Export current map view as PNG image
 */
export async function exportPNG(map: mapboxgl.Map, sketchName: string) {
  // Wait for map to finish rendering
  if (!map.loaded()) {
    await new Promise((resolve) => map.once('idle', resolve));
  }

  // Get map canvas
  const canvas = map.getCanvas();

  // Convert to blob
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });

  downloadBlob(blob, `${sanitizeFilename(sketchName)}.png`);
}

/**
 * Export sketch as PDF (requires jsPDF - optional)
 */
export async function exportPDF(map: mapboxgl.Map, sketch: any) {
  try {
    // Dynamically import jsPDF
    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Page 1: Map screenshot
    const canvas = map.getCanvas();
    const imgData = canvas.toDataURL('image/png');

    doc.addImage(imgData, 'PNG', 10, 10, 277, 150);
    doc.setFontSize(16);
    doc.text(sketch.name, 10, 170);
    doc.setFontSize(10);
    doc.text(`Exported: ${new Date().toLocaleDateString()}`, 10, 176);

    // Page 2: Data table
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Objects Summary', 10, 20);

    let y = 30;
    doc.setFontSize(10);

    if (sketch.data.polygons) {
      doc.text(`Polygons (${sketch.data.polygons.length}):`, 10, y);
      y += 7;
      sketch.data.polygons.forEach((polygon: Polygon) => {
        const area = calculateArea(polygon.points, 'metric');
        doc.text(`  • ${polygon.name}: ${area}`, 15, y);
        y += 5;
      });
      y += 3;
    }

    if (sketch.data.parkingBlocks) {
      doc.text(`Parking Blocks (${sketch.data.parkingBlocks.length}):`, 10, y);
      y += 7;
      sketch.data.parkingBlocks.forEach((parking: ParkingBlock) => {
        doc.text(
          `  • ${parking.name}: ${parking.spaces} spaces (${parking.layout})`,
          15,
          y
        );
        y += 5;
      });
    }

    // Save
    doc.save(`${sanitizeFilename(sketch.name)}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error('PDF export requires jsPDF library. Install with: npm install jspdf');
  }
}

/**
 * Helper: Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper: Sanitize filename
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
}

/**
 * Helper: Escape CSV fields
 */
function escapeCSV(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
