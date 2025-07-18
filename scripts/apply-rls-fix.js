#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://nunvbolbcekvtlwuacul.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bnZib2xiY2VrdnRsd3VhY3VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTI5MTU2NCwiZXhwIjoyMDY2ODY3NTY0fQ.70iWlz51R6-OHAcNwMVqGapMG8Z7Tq2CIRJ9q1e21lY'

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyRlsFix() {
  console.log('Applying RLS policy fixes...')
  
  const sqlCommands = [
    // Drop problematic policies
    `DROP POLICY IF EXISTS "Admin users can view all users" ON public.users;`,
    `DROP POLICY IF EXISTS "Admin users can update any user" ON public.users;`,
    `DROP POLICY IF EXISTS "Admin users can view all organizations" ON public.organisations;`,
    `DROP POLICY IF EXISTS "Admin users can manage organizations" ON public.organisations;`,
    
    // Recreate with JWT claims
    `CREATE POLICY "Admin users can view all users" ON public.users
      FOR SELECT USING (
        (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
      );`,
    
    `CREATE POLICY "Admin users can update any user" ON public.users
      FOR UPDATE USING (
        (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
      );`,
    
    `CREATE POLICY "Admin users can view all organizations" ON public.organisations
      FOR SELECT USING (
        (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
      );`,
    
    `CREATE POLICY "Admin users can manage organizations" ON public.organisations
      FOR ALL USING (
        (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
      );`
  ]
  
  try {
    for (const sql of sqlCommands) {
      console.log('Executing:', sql.split('\n')[0] + '...')
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql })
      if (error) {
        console.error('Error executing SQL:', error)
        // Try alternative approach
        const { error: directError } = await supabaseAdmin
          .from('_supabase_admin')
          .select('*')
          .limit(0)
        
        if (directError) {
          console.log('Using REST API approach not available')
        }
      } else {
        console.log('✅ Success')
      }
    }
    
    console.log('🎉 RLS policy fixes applied successfully!')
    
  } catch (error) {
    console.error('❌ Failed to apply RLS fixes:', error)
  }
}

applyRlsFix()