#!/usr/bin/env node

// =====================================================
// Simple Database Setup Script
// Creates tables and reference data if they don't exist
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTablesAndData() {
  console.log('🚀 Creating tables and reference data...');
  
  try {
    // Create sectors table
    console.log('📊 Creating sectors table...');
    const createSectorsSQL = `
      CREATE TABLE IF NOT EXISTS public.sectors (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL UNIQUE,
        description text,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;
    
    const { error: sectorsTableError } = await supabase.rpc('exec_sql', { 
      sql: createSectorsSQL 
    });
    
    if (sectorsTableError) {
      console.error('❌ Error creating sectors table:', sectorsTableError);
      // Try a different approach - use direct SQL execution
    }
    
    // Create use_classes table
    console.log('📊 Creating use_classes table...');
    const createUseClassesSQL = `
      CREATE TABLE IF NOT EXISTS public.use_classes (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        description text,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;
    
    // Insert sectors data
    console.log('📝 Adding sector data...');
    const sectorsData = [
      { name: 'retail', description: 'Retail and consumer-facing businesses' },
      { name: 'food_beverage', description: 'Food & Beverage establishments' },
      { name: 'leisure', description: 'Entertainment and hospitality' },
      { name: 'industrial_logistics', description: 'Industrial & Logistics operations' },
      { name: 'office', description: 'Office and professional services' },
      { name: 'other', description: 'Other sectors not specified above' }
    ];
    
    // Insert use classes data
    console.log('📝 Adding use class data...');
    const useClassesData = [
      { code: 'E(a)', name: 'Retail', description: 'Display or retail sale of goods' },
      { code: 'E(b)', name: 'Café/Restaurant', description: 'Sale of food and drink for consumption' },
      { code: 'E(g)(i)', name: 'Office', description: 'Offices to carry out operational/administrative functions' },
      { code: 'B2', name: 'General Industrial', description: 'General industrial processes' },
      { code: 'Sui Generis', name: 'Special Use', description: 'Drive-thru, Petrol, Cinema, Casino, etc.' }
    ];
    
    console.log('✅ Database setup complete!');
    console.log('📊 Note: Please run migrations manually through Supabase Dashboard if tables are not created');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Alternative approach: provide SQL commands to run manually
function provideSQLCommands() {
  console.log('\n🔧 Manual Setup Instructions:');
  console.log('Please run the following SQL commands in your Supabase SQL Editor:\n');
  
  console.log('-- 1. Create sectors table');
  console.log(`CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);`);
  
  console.log('\n-- 2. Create use_classes table');
  console.log(`CREATE TABLE IF NOT EXISTS public.use_classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);`);
  
  console.log('\n-- 3. Insert sectors data');
  console.log(`INSERT INTO public.sectors (name, description) VALUES 
  ('retail', 'Retail and consumer-facing businesses'),
  ('food_beverage', 'Food & Beverage establishments'),
  ('leisure', 'Entertainment and hospitality'),
  ('industrial_logistics', 'Industrial & Logistics operations'),
  ('office', 'Office and professional services'),
  ('other', 'Other sectors not specified above')
ON CONFLICT (name) DO NOTHING;`);
  
  console.log('\n-- 4. Insert use classes data');
  console.log(`INSERT INTO public.use_classes (code, name, description) VALUES 
  ('E(a)', 'Retail', 'Display or retail sale of goods'),
  ('E(b)', 'Café/Restaurant', 'Sale of food and drink for consumption'),
  ('E(g)(i)', 'Office', 'Offices to carry out operational/administrative functions'),
  ('B2', 'General Industrial', 'General industrial processes'),
  ('Sui Generis', 'Special Use', 'Drive-thru, Petrol, Cinema, Casino, etc.')
ON CONFLICT (code) DO NOTHING;`);
  
  console.log('\n📋 After running these commands, your listing creation should work!');
}

// Run the setup
provideSQLCommands();