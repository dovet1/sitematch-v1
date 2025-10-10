import type { SiteSketcherState, MapboxDrawPolygon } from '@/types/sitesketcher';
import { calculatePolygonArea, formatArea } from './measurement-utils';

/**
 * Export sketch data as JSON (GeoJSON format)
 */
export function exportAsJSON(state: SiteSketcherState, filename: string = 'sketch') {
  // Create a GeoJSON FeatureCollection
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

/**
 * Export sketch data as CSV
 */
export function exportAsCSV(state: SiteSketcherState, filename: string = 'sketch') {
  const rows: string[][] = [
    ['Type', 'Name/ID', 'Area (sq m)', 'Area (sq ft)', 'Height (m)', 'Stories', 'Notes'],
  ];

  // Add polygons
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

  // Add cuboids
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

  // Add parking
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

/**
 * Export current map view as PNG image
 */
export async function exportAsPNG(
  mapRef: any,
  filename: string = 'sketch'
): Promise<void> {
  if (!mapRef.current) {
    throw new Error('Map reference not available');
  }

  const map = mapRef.current;
  const canvas = map.getCanvas();

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        reject(new Error('Failed to create image'));
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      link.click();

      URL.revokeObjectURL(url);
      resolve();
    });
  });
}

/**
 * Generate PDF with map and measurements
 * Note: This is a simplified version. For production, consider using jsPDF or similar library
 */
export async function exportAsPDF(
  state: SiteSketcherState,
  mapRef: any,
  filename: string = 'sketch'
): Promise<void> {
  // For now, we'll create a simple HTML page and let the browser handle PDF generation
  const html = generateReportHTML(state);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Failed to open print window');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

/**
 * Generate HTML report for PDF export
 */
function generateReportHTML(state: SiteSketcherState): string {
  let polygonsHTML = '';

  state.polygons.forEach((polygon, index) => {
    const area = calculatePolygonArea(polygon.geometry.coordinates[0]);
    const polygonId = polygon.properties?.id || polygon.id || `Polygon ${index + 1}`;
    const height = polygon.properties?.height;

    polygonsHTML += `
      <tr>
        <td>${polygonId}</td>
        <td>${area.squareMeters.toFixed(2)} m²</td>
        <td>${area.squareFeet.toFixed(2)} ft²</td>
        <td>${height ? `${height} m` : 'N/A'}</td>
      </tr>
    `;
  });

  let cuboidsHTML = '';
  state.cuboids.forEach((cuboid, index) => {
    const area = calculatePolygonArea(cuboid.geometry.coordinates[0]);
    const cuboidId = cuboid.properties?.id || cuboid.id || `Cuboid ${index + 1}`;

    cuboidsHTML += `
      <tr>
        <td>${cuboidId}</td>
        <td>${area.squareMeters.toFixed(2)} m²</td>
        <td>${area.squareFeet.toFixed(2)} ft²</td>
        <td>${cuboid.properties.height} m (${cuboid.properties.stories} stories)</td>
      </tr>
    `;
  });

  let parkingHTML = '';
  state.parkingOverlays.forEach((parking, index) => {
    parkingHTML += `
      <tr>
        <td>Parking ${index + 1}</td>
        <td>${parking.type}</td>
        <td>${parking.quantity} spaces</td>
        <td>${parking.size.width}m × ${parking.size.length}m</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Site Sketch Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 1200px;
            margin: 0 auto;
          }
          h1 {
            color: #333;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          h2 {
            color: #666;
            margin-top: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .summary {
            background: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          @media print {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <h1>Site Sketch Report</h1>
        <div class="summary">
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Polygons:</strong> ${state.polygons.length}</p>
          <p><strong>Total Cuboids:</strong> ${state.cuboids.length}</p>
          <p><strong>Parking Overlays:</strong> ${state.parkingOverlays.length}</p>
        </div>

        ${state.polygons.length > 0 ? `
          <h2>Polygons</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Area (m²)</th>
                <th>Area (ft²)</th>
                <th>Height</th>
              </tr>
            </thead>
            <tbody>
              ${polygonsHTML}
            </tbody>
          </table>
        ` : ''}

        ${state.cuboids.length > 0 ? `
          <h2>3D Buildings</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Area (m²)</th>
                <th>Area (ft²)</th>
                <th>Height</th>
              </tr>
            </thead>
            <tbody>
              ${cuboidsHTML}
            </tbody>
          </table>
        ` : ''}

        ${state.parkingOverlays.length > 0 ? `
          <h2>Parking</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Spaces</th>
                <th>Dimensions</th>
              </tr>
            </thead>
            <tbody>
              ${parkingHTML}
            </tbody>
          </table>
        ` : ''}
      </body>
    </html>
  `;
}

/**
 * Helper function to download a file
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
