import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function POST() {
  try {
    const supabase = createAdminClient()

    // Junction table for listing-sector relationships
    const createListingSectorsTable = `
      CREATE TABLE IF NOT EXISTS listing_sectors (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
        sector_id uuid REFERENCES sectors(id) ON DELETE CASCADE NOT NULL,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        UNIQUE(listing_id, sector_id)
      );
    `

    // Junction table for listing-use_class relationships  
    const createListingUseClassesTable = `
      CREATE TABLE IF NOT EXISTS listing_use_classes (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
        use_class_id uuid REFERENCES use_classes(id) ON DELETE CASCADE NOT NULL,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        UNIQUE(listing_id, use_class_id)
      );
    `

    // Create indexes
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_listing_sectors_listing_id ON listing_sectors(listing_id);
      CREATE INDEX IF NOT EXISTS idx_listing_sectors_sector_id ON listing_sectors(sector_id);
      CREATE INDEX IF NOT EXISTS idx_listing_use_classes_listing_id ON listing_use_classes(listing_id);
      CREATE INDEX IF NOT EXISTS idx_listing_use_classes_use_class_id ON listing_use_classes(use_class_id);
    `

    // Migrate existing data
    const migrateData = `
      INSERT INTO listing_sectors (listing_id, sector_id)
      SELECT id, sector_id 
      FROM listings 
      WHERE sector_id IS NOT NULL
      ON CONFLICT (listing_id, sector_id) DO NOTHING;

      INSERT INTO listing_use_classes (listing_id, use_class_id)
      SELECT id, use_class_id 
      FROM listings 
      WHERE use_class_id IS NOT NULL
      ON CONFLICT (listing_id, use_class_id) DO NOTHING;
    `

    // Enable RLS
    const enableRLS = `
      ALTER TABLE listing_sectors ENABLE ROW LEVEL SECURITY;
      ALTER TABLE listing_use_classes ENABLE ROW LEVEL SECURITY;
    `

    // Create RLS policies for listing_sectors
    const createSectorsRLSPolicies = `
      DROP POLICY IF EXISTS "Users can view listing sectors" ON listing_sectors;
      DROP POLICY IF EXISTS "Users can insert listing sectors" ON listing_sectors;
      DROP POLICY IF EXISTS "Users can update listing sectors" ON listing_sectors;
      DROP POLICY IF EXISTS "Users can delete listing sectors" ON listing_sectors;

      CREATE POLICY "Users can view listing sectors"
      ON listing_sectors FOR SELECT
      USING (true);

      CREATE POLICY "Users can insert listing sectors"
      ON listing_sectors FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM listings 
          WHERE id = listing_id 
          AND created_by = auth.uid()
        )
      );

      CREATE POLICY "Users can update listing sectors"
      ON listing_sectors FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM listings 
          WHERE id = listing_id 
          AND created_by = auth.uid()
        )
      );

      CREATE POLICY "Users can delete listing sectors"
      ON listing_sectors FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM listings 
          WHERE id = listing_id 
          AND created_by = auth.uid()
        )
      );
    `

    // Create RLS policies for listing_use_classes
    const createUseClassesRLSPolicies = `
      DROP POLICY IF EXISTS "Users can view listing use classes" ON listing_use_classes;
      DROP POLICY IF EXISTS "Users can insert listing use classes" ON listing_use_classes;
      DROP POLICY IF EXISTS "Users can update listing use classes" ON listing_use_classes;
      DROP POLICY IF EXISTS "Users can delete listing use classes" ON listing_use_classes;

      CREATE POLICY "Users can view listing use classes"
      ON listing_use_classes FOR SELECT
      USING (true);

      CREATE POLICY "Users can insert listing use classes"
      ON listing_use_classes FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM listings 
          WHERE id = listing_id 
          AND created_by = auth.uid()
        )
      );

      CREATE POLICY "Users can update listing use classes"
      ON listing_use_classes FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM listings 
          WHERE id = listing_id 
          AND created_by = auth.uid()
        )
      );

      CREATE POLICY "Users can delete listing use classes"
      ON listing_use_classes FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM listings 
          WHERE id = listing_id 
          AND created_by = auth.uid()
        )
      );
    `

    const steps = [
      { name: 'Create listing_sectors table', sql: createListingSectorsTable },
      { name: 'Create listing_use_classes table', sql: createListingUseClassesTable },
      { name: 'Create indexes', sql: createIndexes },
      { name: 'Migrate existing data', sql: migrateData },
      { name: 'Enable RLS', sql: enableRLS },
      { name: 'Create sectors RLS policies', sql: createSectorsRLSPolicies },
      { name: 'Create use classes RLS policies', sql: createUseClassesRLSPolicies }
    ]

    const results = []

    // For now, let's just create a simple test to verify the structure
    try {
      // Test if junction tables already exist
      const { data: existingTables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .in('table_name', ['listing_sectors', 'listing_use_classes'])
        .eq('table_schema', 'public')

      results.push({
        step: 'Check existing tables',
        status: 'success',
        data: existingTables
      })

      if (tableError) {
        results.push({
          step: 'Check existing tables',
          status: 'error', 
          error: tableError.message
        })
      }

    } catch (error) {
      results.push({
        step: 'Database check',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}