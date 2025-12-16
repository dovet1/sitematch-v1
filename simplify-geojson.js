#!/usr/bin/env node

/**
 * Simplify a GeoJSON file to reduce coordinate count
 * Usage: node simplify-geojson.js input.geojson output.geojson [tolerance]
 */

const fs = require('fs');

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node simplify-geojson.js input.geojson output.geojson [tolerance]');
  console.error('  tolerance: optional, default 0.00001 (higher = more simplification)');
  process.exit(1);
}

const [inputFile, outputFile, toleranceArg] = args;
const tolerance = parseFloat(toleranceArg) || 0.00001;

// Simple Douglas-Peucker algorithm for polygon simplification
function simplifyPolygon(coordinates, tolerance) {
  if (!coordinates || coordinates.length === 0) return coordinates;

  // For polygons, simplify each ring
  return coordinates.map(ring => {
    if (ring.length <= 4) return ring; // Don't simplify very small polygons

    const simplified = douglasPeucker(ring, tolerance);

    // Ensure polygon is closed
    if (simplified.length > 0) {
      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        simplified.push([...first]);
      }
    }

    return simplified;
  });
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from the line between first and last
  let maxDistance = 0;
  let maxIndex = 0;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const rightSegment = douglasPeucker(points.slice(maxIndex), tolerance);

    // Combine results, removing duplicate point at junction
    return leftSegment.slice(0, -1).concat(rightSegment);
  } else {
    // All points between first and last can be removed
    return [firstPoint, lastPoint];
  }
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);

  const u = ((x - x1) * dx + (y - y1) * dy) / (mag * mag);

  let closestX, closestY;
  if (u < 0) {
    closestX = x1;
    closestY = y1;
  } else if (u > 1) {
    closestX = x2;
    closestY = y2;
  } else {
    closestX = x1 + u * dx;
    closestY = y1 + u * dy;
  }

  return Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
}

// Read input file
console.log(`Reading ${inputFile}...`);
const geojson = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

const originalSize = JSON.stringify(geojson).length;
let originalCoordCount = 0;

// Simplify the geometry
if (geojson.type === 'Feature' && geojson.geometry.type === 'Polygon') {
  originalCoordCount = geojson.geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  console.log(`Original coordinates: ${originalCoordCount}`);
  console.log(`Tolerance: ${tolerance}`);

  geojson.geometry.coordinates = simplifyPolygon(geojson.geometry.coordinates, tolerance);

  const newCoordCount = geojson.geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  const newSize = JSON.stringify(geojson).length;

  console.log(`Simplified coordinates: ${newCoordCount} (${((1 - newCoordCount / originalCoordCount) * 100).toFixed(1)}% reduction)`);
  console.log(`Original size: ${(originalSize / 1024).toFixed(1)} KB`);
  console.log(`New size: ${(newSize / 1024).toFixed(1)} KB (${((1 - newSize / originalSize) * 100).toFixed(1)}% reduction)`);
} else {
  console.log('Warning: Expected a Feature with Polygon geometry');
}

// Write output file
fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2));
console.log(`Saved to ${outputFile}`);
