import 'server-only'

import { createClient } from '@supabase/supabase-js'

export function createPlanningAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service credentials are not configured')
  }
  // This subsystem is migration-first; the repo's hand-maintained Database type does not
  // know these tables yet. Leaving schema inference open avoids pretending it does.
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type PlanningAdminClient = ReturnType<typeof createPlanningAdminClient>

