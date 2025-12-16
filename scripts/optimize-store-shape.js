#!/usr/bin/env node

/**
 * Optimize store shape GeoJSON for database insertion
 * Reduces large DWG-converted GeoJSON files (8MB+) to <200KB while preserving all architectural details
 *
 * Usage: node scripts/optimize-store-shape.js input.geojson output.geojson [tolerance]
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node optimize-store-shape.js input.geojson output.geojson [tolerance]');
  console.error('  tolerance: optional, default 0.000001 (higher = more simplification)');
  process.exit(1);
}

const [inputFile, outputFile, toleranceArg] = args;
const tolerance = parseFloat(toleranceArg) || 0.000001;

console.log('=== GeoJSON Optimization Script ===\n');
console.log(`Input file: ${inputFile}`);
console.log(`Output file: ${outputFile}`);
console.log(`Simplification tolerance: ${tolerance}\n`);

// Read input file
const rawData = fs.readFileSync(inputFile, 'utf8');
const originalSize = Buffer.byteLength(rawData, 'utf8');
console.log(`Original file size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

const geojson = JSON.parse(rawData);

// Analyze input structure
console.log(`\nInput structure:`);
console.log(`  Type: ${geojson.type}`);

let features = [];
if (geojson.type === 'FeatureCollection') {
  features = geojson.features;
  console.log(`  Features: ${features.length}`);
} else if (geojson.type === 'Feature') {
  features = [geojson];
  console.log(`  Single feature`);
}

// Count original coordinates
let originalCoordCount = 0;
features.forEach(feature => {
  if (feature.geometry) {
    originalCoordCount += countCoordinates(feature.geometry);
  }
});
console.log(`  Total coordinates: ${originalCoordCount.toLocaleString()}`);

// Helper functions

function countCoordinates(geometry) {
  let count = 0;

  function countInGeometry(geom) {
    switch (geom.type) {
      case 'Point':
        return 1;
      case 'LineString':
        return geom.coordinates.length;
      case 'Polygon':
        return geom.coordinates.reduce((sum, ring) => sum + ring.length, 0);
      case 'MultiPoint':
        return geom.coordinates.length;
      case 'MultiLineString':
        return geom.coordinates.reduce((sum, line) => sum + line.length, 0);
      case 'MultiPolygon':
        return geom.coordinates.reduce((sum, polygon) =>
          sum + polygon.reduce((s, ring) => s + ring.length, 0), 0
        );
      case 'GeometryCollection':
        return geom.geometries.reduce((sum, g) => sum + countInGeometry(g), 0);
      default:
        return 0;
    }
  }

  return countInGeometry(geometry);
}

function roundCoord(coord) {
  return coord.map(v => Math.round(v * 1000000) / 1000000);
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

function simplifyLineString(coords, tol) {
  if (coords.length <= 2) return coords.map(roundCoord);
  const simplified = douglasPeucker(coords, tol);
  return simplified.map(roundCoord);
}

function simplifyPolygonRing(ring, tol) {
  if (ring.length <= 4) return ring.map(roundCoord);

  const simplified = douglasPeucker(ring, tol);

  // Ensure closed
  if (simplified.length > 0) {
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (Math.abs(first[0] - last[0]) > 0.000001 || Math.abs(first[1] - last[1]) > 0.000001) {
      simplified.push([...first]);
    }
  }

  return simplified.map(roundCoord);
}

function simplifyGeometry(geometry, tol) {
  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: roundCoord(geometry.coordinates)
      };

    case 'LineString':
      return {
        ...geometry,
        coordinates: simplifyLineString(geometry.coordinates, tol)
      };

    case 'Polygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(ring => simplifyPolygonRing(ring, tol))
      };

    case 'MultiPoint':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(roundCoord)
      };

    case 'MultiLineString':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(line => simplifyLineString(line, tol))
      };

    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(polygon =>
          polygon.map(ring => simplifyPolygonRing(ring, tol))
        )
      };

    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map(g => simplifyGeometry(g, tol))
      };

    default:
      return geometry;
  }
}

function extractAllCoordinates(geometry) {
  const coords = [];

  function extract(geom) {
    switch (geom.type) {
      case 'Point':
        coords.push(geom.coordinates);
        break;
      case 'LineString':
        coords.push(...geom.coordinates);
        break;
      case 'Polygon':
        geom.coordinates.forEach(ring => coords.push(...ring));
        break;
      case 'MultiPoint':
        coords.push(...geom.coordinates);
        break;
      case 'MultiLineString':
        geom.coordinates.forEach(line => coords.push(...line));
        break;
      case 'MultiPolygon':
        geom.coordinates.forEach(polygon =>
          polygon.forEach(ring => coords.push(...ring))
        );
        break;
      case 'GeometryCollection':
        geom.geometries.forEach(g => extract(g));
        break;
    }
  }

  extract(geometry);
  return coords;
}

function translateCoordinates(coords, deltaLng, deltaLat) {
  if (typeof coords[0] === 'number') {
    return [coords[0] + deltaLng, coords[1] + deltaLat];
  }
  return coords.map(c => translateCoordinates(c, deltaLng, deltaLat));
}

function translateGeometry(geometry, deltaLng, deltaLat) {
  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: [geometry.coordinates[0] + deltaLng, geometry.coordinates[1] + deltaLat]
      };
    case 'LineString':
    case 'MultiPoint':
    case 'Polygon':
    case 'MultiLineString':
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: translateCoordinates(geometry.coordinates, deltaLng, deltaLat)
      };
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map(g => translateGeometry(g, deltaLng, deltaLat))
      };
    default:
      return geometry;
  }
}

// Calculate centroid (avoid stack overflow with large arrays)
console.log('\nCalculating centroid...');
let allCoords = [];
features.forEach(feature => {
  if (feature.geometry) {
    const coords = extractAllCoordinates(feature.geometry);
    // Use concat or loop instead of spread to avoid stack overflow
    for (const coord of coords) {
      allCoords.push(coord);
    }
  }
});

const centerLng = allCoords.reduce((sum, coord) => sum + coord[0], 0) / allCoords.length;
const centerLat = allCoords.reduce((sum, coord) => sum + coord[1], 0) / allCoords.length;

console.log(`  Original center: [${centerLng.toFixed(6)}, ${centerLat.toFixed(6)}]`);

// Simplify and normalize features
console.log('\nOptimizing features...');
const optimizedFeatures = features.map((feature, index) => {
  if (!feature.geometry) return feature;

  // Simplify geometry
  const simplified = simplifyGeometry(feature.geometry, tolerance);

  // Translate to origin
  const translated = translateGeometry(simplified, -centerLng, -centerLat);

  // Strip unnecessary properties, keep only Layer info if it exists
  return {
    type: 'Feature',
    geometry: translated,
    properties: {
      layer: feature.properties?.Layer || feature.properties?.layer
    }
  };
});

// Create output GeoJSON
let optimized;
if (geojson.type === 'FeatureCollection') {
  optimized = {
    type: 'FeatureCollection',
    features: optimizedFeatures
  };
} else {
  optimized = optimizedFeatures[0];
}

// Calculate stats first (needed for metadata)
let newCoordCount = 0;
optimizedFeatures.forEach(feature => {
  if (feature.geometry) {
    newCoordCount += countCoordinates(feature.geometry);
  }
});

// Check for accompanying metadata file and update it
// Try both .raw.metadata.json and .metadata.json patterns
let metadataFile = inputFile.replace('.raw.geojson', '.raw.metadata.json');
if (!fs.existsSync(metadataFile)) {
  metadataFile = inputFile.replace('.geojson', '.metadata.json');
}

let metadata = null;

if (fs.existsSync(metadataFile)) {
  console.log(`\nFound metadata file: ${metadataFile}`);
  metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));

  // Update metadata with optimization stats
  metadata.optimized_feature_count = optimizedFeatures.length;
  metadata.optimization_tolerance = tolerance;
  metadata.coordinate_reduction_percent = ((1 - newCoordCount / originalCoordCount) * 100).toFixed(1);
}

// Write output (minified for database, with optional pretty version)
const outputStr = JSON.stringify(optimized);  // Minified
const prettyOutputStr = JSON.stringify(optimized, null, 2);  // For viewing

fs.writeFileSync(outputFile, outputStr);

// Also write a pretty version for viewing
const prettyOutputFile = outputFile.replace('.geojson', '.pretty.geojson');
fs.writeFileSync(prettyOutputFile, prettyOutputStr);

// Write updated metadata alongside optimized GeoJSON
if (metadata) {
  const outputMetadataFile = outputFile.replace(/\.geojson$/, '.metadata.json');
  fs.writeFileSync(outputMetadataFile, JSON.stringify(metadata, null, 2));
  console.log(`Metadata file updated: ${outputMetadataFile}`);
}

// Final summary
const newSize = Buffer.byteLength(outputStr, 'utf8');
const prettySize = Buffer.byteLength(prettyOutputStr, 'utf8');

console.log('\n=== OPTIMIZATION COMPLETE ===');
console.log(`\nOutput files:`);
console.log(`  Minified (for database): ${outputFile}`);
console.log(`  Pretty (for viewing): ${prettyOutputFile}`);
console.log(`\nSize:`);
console.log(`  Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Optimized (minified): ${(newSize / 1024).toFixed(2)} KB`);
console.log(`  Optimized (pretty): ${(prettySize / 1024).toFixed(2)} KB`);
console.log(`  Reduction: ${((1 - newSize / originalSize) * 100).toFixed(1)}%`);
console.log(`\nCoordinates:`);
console.log(`  Original: ${originalCoordCount.toLocaleString()}`);
console.log(`  Optimized: ${newCoordCount.toLocaleString()}`);
console.log(`  Reduction: ${((1 - newCoordCount / originalCoordCount) * 100).toFixed(1)}%`);
console.log(`\nNormalized to center: [0, 0]`);
console.log(`\nUse the MINIFIED version for database insertion!`);
