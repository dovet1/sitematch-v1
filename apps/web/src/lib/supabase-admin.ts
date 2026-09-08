import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

// Keep API routes that only need service-role access isolated from the shared
// Supabase module. That module also creates browser/SSR auth clients at import
// time, which can leave a stale invalid export in Next's development bundle.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are not configured')
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
