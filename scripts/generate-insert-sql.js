#!/usr/bin/env node

/**
 * Generate SQL INSERT statement for optimized store shape
 * Usage: node scripts/generate-insert-sql.js optimized-store-shape.geojson > insert.sql
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node generate-insert-sql.js <geojson-file>');
  process.exit(1);
}

const geojsonFile = args[0];
const geojsonPath = path.resolve(geojsonFile);

// Read the optimized GeoJSON
const geojson = fs.readFileSync(geojsonPath, 'utf8');

// Escape single quotes for SQL
const escapedGeojson = geojson.replace(/'/g, "''");

// Generate SQL INSERT statement
const sql = `-- Insert optimized store shape into database
-- Run this in Supabase SQL Editor
-- File: ${path.basename(geojsonFile)}
-- Size: ${(Buffer.byteLength(geojson, 'utf8') / 1024).toFixed(2)} KB

INSERT INTO store_shapes (
  name,
  description,
  company_name,
  geojson,
  is_active,
  display_order
) VALUES (
  'LD(15)-PL-06 - Proposed Building Plan',
  'Detailed architectural floor plan with internal walls, rooms, and fixtures. Optimized from 8MB to 3.8MB (70% coordinate reduction).',
  'Custom Store',
  '${escapedGeojson}'::jsonb,
  true,
  1
);
`;

console.log(sql);
