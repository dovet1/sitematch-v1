/** Run one bounded production worker without enabling a recurring schedule.
 * From apps/web: npx tsx scripts/run-planning-worker.ts discovery --commit
 * Defaults to a dry run. Research is intentionally not supported.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { runPlotaRefresh, runPlotaSync } from '../src/lib/planning-intelligence/ingest'
import { PlotaClient, type CensusScope } from '../src/lib/planning-intelligence/plota'
import { classifyPlanningBatch } from '../src/lib/planning-intelligence/classify'

loadEnvConfig(process.cwd())

async function main() {
  const kind = process.argv[2]
  if (!['discovery', 'refresh', 'classification'].includes(kind)) {
    throw new Error('Choose discovery, refresh, or classification')
  }
  // Classification batch size follows the cron's env so local catch-up and the
  // scheduled worker stay in step; classifyPlanningBatch still hard-caps it at 100.
  const classificationLimit = Math.max(1, Number.parseInt(process.env.PLANNING_CLASSIFICATION_BATCH_SIZE ?? '20', 10) || 20)
  const options = { pageSize: 50, maxPages: 100, cohortLimit: 3, limit: 20 }
  const scope: CensusScope = process.env.PLOTA_CENSUS_SCOPE === 'full' ? 'full' : 'reduced'
  console.log(JSON.stringify({ kind, scope, ...options, commit: process.argv.includes('--commit') }))
  if (!process.argv.includes('--commit')) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials are not configured')
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  if (kind === 'classification') {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OpenRouter key is not configured')
    const drain = process.argv.includes('--drain')
    // Atomic queue claims and budget reservations make these consumers independent.
    // Bound the entire catch-up to 5,000 items; stop on any error or budget deferral.
    const totals = { considered: 0, classified: 0, failed: 0, deferredBudget: 0 }
    for (let round = 0; round < (drain ? 63 : 1); round++) {
      const remaining = 5000 - totals.considered
      const workers = drain ? Math.min(4, Math.ceil(remaining / classificationLimit)) : 1
      const results = await Promise.allSettled(Array.from({ length: workers }, (_, index) =>
        classifyPlanningBatch({ db, apiKey: process.env.OPENROUTER_API_KEY!,
          limit: Math.min(classificationLimit, remaining - index * classificationLimit) })))
      let considered = 0
      let roundClassified = 0
      let roundFailed = 0
      for (const result of results) {
        if (result.status === 'fulfilled') {
          considered += result.value.considered
          roundClassified += result.value.classified
          roundFailed += result.value.failed
          for (const key of ['considered', 'classified', 'failed', 'deferredBudget'] as const) totals[key] += result.value[key]
        }
      }
      console.log(JSON.stringify({ round: round + 1, ...totals }))
      const rejected = results.find(result => result.status === 'rejected')
      if (rejected?.status === 'rejected') throw rejected.reason
      // Failed items are held for review by migration 20260930000000. Continue when
      // other workers succeeded, but stop if the whole round fails or funds run out.
      if (!considered || (roundFailed > 0 && roundClassified === 0) || totals.deferredBudget || totals.considered >= 5000) break
    }
    return
  }
  if (!process.env.PLOTA_API_KEY) throw new Error('Plota key is not configured')
  const client = new PlotaClient(process.env.PLOTA_API_KEY)
  const common = { db, client, scope, ...options, brandLimbEnabled: process.env.PLANNING_BRAND_LIMB_ENABLED === 'true' }
  if (kind === 'refresh') {
    console.log(JSON.stringify(await runPlotaRefresh(common)))
  } else {
    const date = new Date()
    const dateTo = date.toISOString().slice(0, 10)
    date.setUTCDate(date.getUTCDate() - 14)
    console.log(JSON.stringify(await runPlotaSync({ ...common, kind: 'discovery', dateFrom: date.toISOString().slice(0, 10), dateTo })))
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
