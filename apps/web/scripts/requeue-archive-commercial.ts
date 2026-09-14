/** Re-evaluate stored archive applications with the description-based commercial limbs.
 *
 * Plota's archive carries no commercial_work, so archive records received before 2026 could only
 * ever reach the tier through the housing limb. No Plota or model requests are made here; a
 * committed run only queues newly eligible records for the existing hourly classification worker.
 *
 * Run from apps/web. Dry-run by default; --commit queues newly eligible records.
 *   ../../node_modules/.bin/tsx scripts/requeue-archive-commercial.ts [--from=2025-09-10] [--to=2025-12-31] [--commit]
 * Walks one received date at a time (index-backed) and can be resumed with --from.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { decideEligibility } from '../src/lib/planning-intelligence/eligibility'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())

const argument = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1]
const DATE = /^\d{4}-\d{2}-\d{2}$/

async function main() {
  const commit = process.argv.includes('--commit')
  const from = argument('from') ?? '2025-09-10'
  const to = argument('to') ?? '2025-12-31'
  if (!DATE.test(from) || !DATE.test(to) || from > to) throw new Error('from and to must be YYYY-MM-DD with from <= to')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials are required')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const totals = { days: 0, scanned: 0, eligible: 0, queued: 0, byLimb: {} as Record<string, number> }
  const examples: Record<string, string[]> = {}
  for (let day = new Date(`${from}T00:00:00Z`); day.toISOString().slice(0, 10) <= to; day.setUTCDate(day.getUTCDate() + 1)) {
    const received = day.toISOString().slice(0, 10)
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('planning_applications')
        .select('id,input_hash,reference,description,procedure,source_kind,commercial_work,stated_dwelling_count,eligibility_limbs')
        .eq('date_received', received).eq('source_kind', 'historical')
        .eq('intelligence_tier', false).eq('classification_state', 'not_eligible')
        .order('id').range(offset, offset + 999)
      if (error) throw error
      for (const row of data ?? []) {
        totals.scanned++
        const decision = decideEligibility({
          id: row.id, reference: row.reference, authority: { slug: '', name: '' },
          description: row.description, procedure: row.procedure, source: row.source_kind,
          commercial_work: row.commercial_work, dwelling_count: row.stated_dwelling_count,
        } as PlotaApplication)
        const described = decision.limbs.filter(limb => limb.endsWith('-described'))
        if (!decision.intelligenceTier || described.length === 0) continue
        totals.eligible++
        for (const limb of described) {
          totals.byLimb[limb] = (totals.byLimb[limb] ?? 0) + 1
          if ((examples[limb] ??= []).length < 5) examples[limb].push(row.description.slice(0, 140))
        }
        if (!commit) continue
        // Guarded on the stored input and state, so a record re-ingested or classified meanwhile is
        // left alone rather than overwritten.
        const result = await db.from('planning_applications').update({
          intelligence_tier: true, classification_state: 'queued',
          eligibility_limbs: [...new Set([...(row.eligibility_limbs ?? []), ...decision.limbs])],
          updated_at: new Date().toISOString(),
        }).eq('id', row.id).eq('input_hash', row.input_hash)
          .eq('intelligence_tier', false).eq('classification_state', 'not_eligible').select('id')
        if (result.error) throw result.error
        totals.queued += result.data?.length ?? 0
      }
      if ((data?.length ?? 0) < 1000) break
    }
    totals.days++
    if (totals.days % 14 === 0) console.log(JSON.stringify({ commit, through: received, ...totals }))
  }
  console.log(JSON.stringify({ commit, from, to, ...totals, examples }, null, 2))
}

main().catch(error => { console.error(error); process.exitCode = 1 })
