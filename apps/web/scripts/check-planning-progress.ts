/** Read-only operational snapshot; no provider or model requests. */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
loadEnvConfig(process.cwd())
async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const results = await Promise.all([
    db.rpc('planning_pipeline_status'),
    db.from('planning_provider_usage').select('monthly_remaining,occurred_at').eq('provider', 'plota').not('monthly_remaining', 'is', null).order('occurred_at', { ascending: false }).limit(1),
    db.from('planning_applications').select('id', { count: 'estimated', head: true }),
  ])
  for (const [index, result] of results.entries()) console.log(JSON.stringify({ kind: ['pipeline', 'latestQuota', 'estimatedStoreCount'][index], data: result.data, count: result.count, error: result.error }))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
