/** Bounded evaluation of the genuine research queue, using the production budget ledger.
 * From apps/web: npx tsx scripts/run-planning-research-batch.ts [--commit]
 * No queue staging, budget overrides, or recurring schedule.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { researchPlanningBatch } from '../src/lib/planning-intelligence/research'

loadEnvConfig(process.cwd())

async function main() {
  const limit = 3
  console.log(JSON.stringify({ limit, commit: process.argv.includes('--commit') }))
  if (!process.argv.includes('--commit')) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!url || !key || !apiKey) throw new Error('Required service credentials are not configured')
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const startedAt = new Date().toISOString()
  const result = await researchPlanningBatch({ db, apiKey, limit })
  console.log(JSON.stringify({ result }))
  // Research is unscheduled. Include IDs so concurrent manual runs, if any, are visible.
  const { data, error } = await db.from('planning_classification_runs')
    .select('id,development_id,planning_application_id,status,output,cost_usd,error')
    .eq('stage', 'web').gte('started_at', startedAt).order('started_at')
  if (error) throw error
  const { data: usage, error: usageError } = await db.from('planning_ai_usage')
    .select('classification_run_id,status,reserved_usd,actual_usd')
    .eq('stage', 'web').gte('occurred_at', startedAt)
  if (usageError) throw usageError
  // Run upserts can collapse repeated attempts; the ledger retains each charge.
  console.log(JSON.stringify({ startedAt, runs: data, usage }, null, 2))
}

main().catch(error => { console.error(error); process.exitCode = 1 })
