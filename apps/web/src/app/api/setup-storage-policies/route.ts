import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = createAdminClient()

    // Drop existing policies
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects',
      'DROP POLICY IF EXISTS "Authenticated users can upload brochures" ON storage.objects', 
      'DROP POLICY IF EXISTS "Authenticated users can upload site plans" ON storage.objects',
      'DROP POLICY IF EXISTS "Authenticated users can upload fit-outs" ON storage.objects',
      'DROP POLICY IF EXISTS "Authenticated users can upload headshots" ON storage.objects',
      'DROP POLICY IF EXISTS "Users can view own organization files" ON storage.objects',
      'DROP POLICY IF EXISTS "Users can update own organization files" ON storage.objects',
      'DROP POLICY IF EXISTS "Users can delete own organization files" ON storage.objects',
      'DROP POLICY IF EXISTS "Users can update own files" ON storage.objects',
      'DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects',
      'DROP POLICY IF EXISTS "Admins can manage all files" ON storage.objects',
      'DROP POLICY IF EXISTS "Public read access" ON storage.objects'
    ]

    // Create new policies that work with our schema
    const createPolicies = [
      // Enable RLS
      'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY',
      
      // Public read access for all buckets (since we want public file access)
      `CREATE POLICY "Public read access" ON storage.objects
        FOR SELECT TO anon, authenticated
        USING (bucket_id IN ('logos', 'brochures', 'site-plans', 'fit-outs', 'headshots'))`,
      
      // Upload policies - authenticated users can upload files
      `CREATE POLICY "Authenticated users can upload logos" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'logos'
          AND auth.uid() IS NOT NULL
        )`,
      
      `CREATE POLICY "Authenticated users can upload brochures" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'brochures'
          AND auth.uid() IS NOT NULL
        )`,
      
      `CREATE POLICY "Authenticated users can upload site plans" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'site-plans'
          AND auth.uid() IS NOT NULL
        )`,
      
      `CREATE POLICY "Authenticated users can upload fit-outs" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'fit-outs'
          AND auth.uid() IS NOT NULL
        )`,
      
      `CREATE POLICY "Authenticated users can upload headshots" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'headshots'
          AND auth.uid() IS NOT NULL
        )`,
      
      // Update/Delete policies for authenticated users
      `CREATE POLICY "Users can update own files" ON storage.objects
        FOR UPDATE TO authenticated
        USING (
          bucket_id IN ('logos', 'brochures', 'site-plans', 'fit-outs', 'headshots')
          AND auth.uid() IS NOT NULL
        )`,
      
      `CREATE POLICY "Users can delete own files" ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id IN ('logos', 'brochures', 'site-plans', 'fit-outs', 'headshots')
          AND auth.uid() IS NOT NULL
        )`,
      
      // Admin policies
      `CREATE POLICY "Admins can manage all files" ON storage.objects
        FOR ALL TO authenticated
        USING (
          bucket_id IN ('logos', 'brochures', 'site-plans', 'fit-outs', 'headshots')
          AND auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
          )
        )`
    ]

    const results = []

    // For now, let's just return the SQL statements that need to be run manually
    results.push({ 
      message: 'Storage policies need to be updated manually in Supabase dashboard',
      dropPolicies,
      createPolicies 
    })

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Storage policy setup error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed'
    }, { status: 500 })
  }
}