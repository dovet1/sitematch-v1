#!/usr/bin/env node

/**
 * Analyze and fix GeoJSON files for store shapes
 * Usage: node analyze-and-fix-geojson.js input.geojson [output.geojson]
 */

const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node analyze-and-fix-geojson.js input.geojson [output.geojson]');
  process.exit(1);
}

const [inputFile, outputFile] = args;

console.log('Reading file...\n');
const raw = fs.readFileSync(inputFile, 'utf8');
const geojson = JSON.parse(raw);

console.log('=== FILE ANALYSIS ===');
console.log(`File size: ${(raw.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Type: ${geojson.type}`);

// Analyze structure
let features = [];
if (geojson.type === 'FeatureCollection') {
  features = geojson.features;
  console.log(`Number of features: ${features.length}`);
} else if (geojson.type === 'Feature') {
  features = [geojson];
  console.log('Single feature');
}

// Analyze each feature
features.forEach((feature, i) => {
  console.log(`\nFeature ${i + 1}:`);
  console.log(`  Geometry type: ${feature.geometry?.type}`);

  if (feature.geometry?.type === 'Polygon') {
    const rings = feature.geometry.coordinates;
    console.log(`  Number of rings: ${rings.length}`);
    rings.forEach((ring, j) => {
      console.log(`    Ring ${j + 1}: ${ring.length} coordinates`);
    });

    // Total coordinates
    const totalCoords = rings.reduce((sum, ring) => sum + ring.length, 0);
    console.log(`  Total coordinates: ${totalCoords}`);
  } else if (feature.geometry?.type === 'MultiPolygon') {
    const polygons = feature.geometry.coordinates;
    console.log(`  Number of polygons: ${polygons.length}`);
    let totalCoords = 0;
    polygons.forEach((polygon, j) => {
      const polyCoords = polygon.reduce((sum, ring) => sum + ring.length, 0);
      console.log(`    Polygon ${j + 1}: ${polyCoords} coordinates`);
      totalCoords += polyCoords;
    });
    console.log(`  Total coordinates: ${totalCoords}`);
  }

  // Check properties
  if (feature.properties) {
    const propSize = JSON.stringify(feature.properties).length;
    console.log(`  Properties size: ${(propSize / 1024).toFixed(2)} KB`);
    console.log(`  Properties keys: ${Object.keys(feature.properties).join(', ')}`);
  }
});

// If output file specified, create optimized version
if (outputFile) {
  console.log('\n=== CREATING OPTIMIZED VERSION ===');

  // Helper function to reduce coordinate precision
  function roundCoordinate(coord) {
    return [
      Math.round(coord[0] * 1000000) / 1000000, // 6 decimal places
      Math.round(coord[1] * 1000000) / 1000000
    ];
  }

  // Helper function to simplify polygon
  function simplifyRing(ring, tolerance = 0.00001) {
    if (ring.length <= 4) return ring.map(roundCoordinate);

    // Douglas-Peucker simplification
    const simplified = douglasPeucker(ring, tolerance);

    // Ensure closed
    if (simplified.length > 0) {
      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      if (Math.abs(first[0] - last[0]) > 0.000001 || Math.abs(first[1] - last[1]) > 0.000001) {
        simplified.push([...first]);
      }
    }

    return simplified.map(roundCoordinate);
  }

  function douglasPeucker(points, tolerance) {
    if (points.length <= 2) return points;

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

    if (maxDistance > tolerance) {
      const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const rightSegment = douglasPeucker(points.slice(maxIndex), tolerance);
      return leftSegment.slice(0, -1).concat(rightSegment);
    } else {
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

  // Helper to normalize coordinates to center around origin
  function normalizeCoordinates(coordinates) {
    // Find bounding box
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    coordinates.forEach(ring => {
      ring.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });
    });

    // Calculate center
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    console.log(`  Original center: [${centerLng.toFixed(6)}, ${centerLat.toFixed(6)}]`);
    console.log(`  Original bounds: ${(maxLng - minLng).toFixed(6)} x ${(maxLat - minLat).toFixed(6)}`);

    // Translate to origin
    return coordinates.map(ring =>
      ring.map(([lng, lat]) => [lng - centerLng, lat - centerLat])
    );
  }

  // Process based on type
  let optimized;

  if (geojson.type === 'FeatureCollection' && features.length > 1) {
    console.log('WARNING: Multiple features found. Using the largest polygon only.');

    // Find largest polygon
    let largestFeature = features[0];
    let maxCoords = 0;

    features.forEach(feature => {
      if (feature.geometry?.type === 'Polygon') {
        const coordCount = feature.geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
        if (coordCount > maxCoords) {
          maxCoords = coordCount;
          largestFeature = feature;
        }
      }
    });

    features = [largestFeature];
  }

  // Take first feature
  const feature = features[0];

  // Simplify with aggressive tolerance
  const tolerance = 0.0001; // Adjust this if needed
  console.log(`Using simplification tolerance: ${tolerance}`);

  let simplifiedCoordinates;
  if (feature.geometry.type === 'Polygon') {
    simplifiedCoordinates = feature.geometry.coordinates.map(ring => simplifyRing(ring, tolerance));
  } else if (feature.geometry.type === 'MultiPolygon') {
    // Convert MultiPolygon to single Polygon (use first/largest)
    console.log('Converting MultiPolygon to Polygon (using largest part)');
    const polygons = feature.geometry.coordinates;
    let largest = polygons[0];
    let maxCoords = largest[0].length;

    polygons.forEach(poly => {
      const coordCount = poly[0].length;
      if (coordCount > maxCoords) {
        maxCoords = coordCount;
        largest = poly;
      }
    });

    simplifiedCoordinates = largest.map(ring => simplifyRing(ring, tolerance));
  }

  // Normalize to origin
  const normalizedCoordinates = normalizeCoordinates(simplifiedCoordinates);

  // Create clean output
  optimized = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: normalizedCoordinates
    }
  };

  const outputStr = JSON.stringify(optimized, null, 2);
  fs.writeFileSync(outputFile, outputStr);

  const newCoordCount = normalizedCoordinates.reduce((sum, ring) => sum + ring.length, 0);
  console.log(`\nOptimized file saved to: ${outputFile}`);
  console.log(`New coordinate count: ${newCoordCount}`);
  console.log(`New file size: ${(outputStr.length / 1024).toFixed(2)} KB`);
  console.log(`Reduction: ${((1 - outputStr.length / raw.length) * 100).toFixed(1)}%`);
}

console.log('\nDone!');
