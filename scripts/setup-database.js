#!/usr/bin/env node

// =====================================================
// Database Setup Script
// Ensures required reference data exists in the database
// =====================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables directly from the file
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl, supabaseKey;

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1];
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseKey = line.split('=')[1];
  }
});

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Starting database setup...');
  
  try {
    // First, let's check what tables exist
    console.log('📊 Checking existing tables...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_names');
    
    if (tablesError) {
      console.log('⚠️  Cannot check tables, proceeding with setup...');
    } else {
      console.log('🗂️  Existing tables:', tables);
    }
    
    // Check if sectors table exists and has data
    console.log('📊 Checking sectors table...');
    const { data: sectors, error: sectorsError } = await supabase
      .from('sectors')
      .select('id, name')
      .limit(1);
    
    if (sectorsError) {
      console.error('❌ Error accessing sectors table:', sectorsError.message);
      return;
    }
    
    if (!sectors || sectors.length === 0) {
      console.log('📝 Adding sector data...');
      const sectorsToInsert = [
        { name: 'retail', description: 'Retail and consumer-facing businesses' },
        { name: 'food_beverage', description: 'Food & Beverage establishments' },
        { name: 'leisure', description: 'Entertainment and hospitality' },
        { name: 'industrial_logistics', description: 'Industrial & Logistics operations' },
        { name: 'office', description: 'Office and professional services' },
        { name: 'healthcare', description: 'Healthcare and medical services' },
        { name: 'automotive', description: 'Automotive and transport services' },
        { name: 'roadside', description: 'Roadside and highway services' },
        { name: 'other', description: 'Other sectors not specified above' }
      ];
      
      const { error: insertSectorsError } = await supabase
        .from('sectors')
        .insert(sectorsToInsert);
      
      if (insertSectorsError) {
        console.error('❌ Error inserting sectors:', insertSectorsError.message);
        return;
      }
      
      console.log('✅ Sectors added successfully');
    } else {
      console.log('✅ Sectors table already has data');
    }
    
    // Check if use_classes table exists and has data
    console.log('📊 Checking use_classes table...');
    const { data: useClasses, error: useClassesError } = await supabase
      .from('use_classes')
      .select('id, code, name')
      .limit(1);
    
    if (useClassesError) {
      console.error('❌ Error accessing use_classes table:', useClassesError.message);
      return;
    }
    
    if (!useClasses || useClasses.length === 0) {
      console.log('📝 Adding use class data...');
      const useClassesToInsert = [
        { code: 'E(a)', name: 'Retail', description: 'Display or retail sale of goods' },
        { code: 'E(b)', name: 'Café/Restaurant', description: 'Sale of food and drink for consumption' },
        { code: 'E(g)(i)', name: 'Office', description: 'Offices to carry out operational/administrative functions' },
        { code: 'E(g)(iii)', name: 'Light Industrial', description: 'Light industrial processes' },
        { code: 'B2', name: 'General Industrial', description: 'General industrial processes' },
        { code: 'B8', name: 'Storage/Distribution', description: 'Storage or distribution of goods' },
        { code: 'C1', name: 'Hotel', description: 'Hotels and accommodation' },
        { code: 'Sui Generis', name: 'Special Use', description: 'Drive-thru, Petrol, Cinema, Casino, etc.' }
      ];
      
      const { error: insertUseClassesError } = await supabase
        .from('use_classes')
        .insert(useClassesToInsert);
      
      if (insertUseClassesError) {
        console.error('❌ Error inserting use classes:', insertUseClassesError.message);
        return;
      }
      
      console.log('✅ Use classes added successfully');
    } else {
      console.log('✅ Use classes table already has data');
    }
    
    // Verify data was inserted correctly
    console.log('🔍 Verifying setup...');
    const { data: finalSectors } = await supabase.from('sectors').select('id, name');
    const { data: finalUseClasses } = await supabase.from('use_classes').select('id, code, name');
    
    console.log(`✅ Database setup complete!`);
    console.log(`📊 Sectors available: ${finalSectors?.length || 0}`);
    console.log(`📊 Use classes available: ${finalUseClasses?.length || 0}`);
    
    if (finalSectors?.length > 0) {
      console.log('📋 Available sectors:', finalSectors.map(s => s.name).join(', '));
    }
    
    if (finalUseClasses?.length > 0) {
      console.log('📋 Available use classes:', finalUseClasses.map(uc => `${uc.code} (${uc.name})`).join(', '));
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the setup
setupDatabase().then(() => {
  console.log('🎉 Database setup completed');
}).catch(error => {
  console.error('💥 Database setup failed:', error);
  process.exit(1);
});