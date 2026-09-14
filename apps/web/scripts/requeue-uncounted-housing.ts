/** Re-evaluate stored housing descriptions without spending Plota or LLM requests.
 * Run from apps/web. Dry-run by default; --commit queues newly eligible records.
 * --after=<uuid> resumes a bounded scan; --max-rows=5000 controls the scan cap.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { decideEligibility, hasUncountedHousingProposal } from '../src/lib/planning-intelligence/eligibility'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())
async function main() {
  const commit = process.argv.includes('--commit')
  const maximum = Number(process.argv.find(arg => arg.startsWith('--max-rows='))?.split('=')[1] ?? 5000)
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 1000000) throw new Error('max-rows must be 1–1000000')
  let after = process.argv.find(arg => arg.startsWith('--after='))?.split('=')[1]
  if (after && !/^[0-9a-f-]{36}$/i.test(after)) throw new Error('after must be an application UUID')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials are required')
  const db = createClient(url, key, { auth: { persistSession: false } })
  let scanned = 0, candidates = 0, queued = 0, complete = false
  while (scanned < maximum) {
    const size = Math.min(100, maximum - scanned)
    let query = db.from('planning_applications').select('id,input_hash,raw,eligibility_limbs')
      .eq('provider', 'plota').eq('intelligence_tier', false).eq('classification_state', 'not_eligible')
      .is('stated_dwelling_count', null).order('id').limit(size)
    if (after) query = query.gt('id', after)
    const { data, error } = await query
    if (error) throw error
    for (const row of data ?? []) {
      const application = row.raw as PlotaApplication
      scanned++
      after = row.id
      if (!hasUncountedHousingProposal(application) || !decideEligibility(application).intelligenceTier) continue
      candidates++
      if (candidates <= 15) console.log(JSON.stringify({ candidate: row.id, description: application.description }))
      if (commit) {
        const result = await db.from('planning_applications').update({
          intelligence_tier: true, classification_state: 'queued',
          eligibility_limbs: [...new Set([...(row.eligibility_limbs ?? []), 'B'])],
          updated_at: new Date().toISOString(),
        }).eq('id', row.id).eq('input_hash', row.input_hash)
          .eq('intelligence_tier', false).eq('classification_state', 'not_eligible').select('id')
        if (result.error) throw result.error
        queued += result.data?.length ?? 0
      }
    }
    if ((data?.length ?? 0) < size) { complete = true; break }
    if (scanned % 1000 === 0) console.log(JSON.stringify({ commit, scanned, candidates, queued, after }))
  }
  console.log(JSON.stringify({ commit, scanned, candidates, queued, after, complete,
    note: 'Concurrent imports can add earlier UUIDs; a completed scan is a snapshot, so repeat after backfill settles.' }))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
