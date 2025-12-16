const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertStoreShape() {
  try {
    // Read the optimized GeoJSON file
    const geojsonPath = path.join(__dirname, '..', 'optimized-store-shape.geojson');
    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

    console.log('Inserting store shape...');
    console.log('GeoJSON type:', geojsonData.type);
    console.log('Number of features:', geojsonData.features?.length || 0);

    // Insert the store shape
    const { data, error } = await supabase
      .from('store_shapes')
      .insert({
        name: 'Test Store Shape',
        geojson: geojsonData,
        description: 'Test store shape for sitesketcher',
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Error inserting store shape:', error);
      process.exit(1);
    }

    console.log('Successfully inserted store shape!');
    console.log('ID:', data[0].id);
    console.log('Name:', data[0].name);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

insertStoreShape();
