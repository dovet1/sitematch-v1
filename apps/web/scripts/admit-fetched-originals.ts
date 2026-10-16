/** Development linking: admit to the intelligence tier the records fetched from Plota family lookups
 * that qualify for it in their own right.
 *
 * Family lookups store the originals and members they fetch outside the tier (`admitToTier: false`),
 * so nothing was classified before families were grouped. Grouping takes only families with a tier
 * member, so a fetched permission and its paperwork, none in the tier, were never grouped although
 * the permission shows on the Planning Monitor (2,174 such applications on 16 October 2026). Now that
 * grouping runs before classification, a fetched record that the ordinary eligibility rule would
 * admit is admitted and queued, exactly as if it had been ingested. Records the rule excludes stay out.
 *
 * Dry run by default. Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/admit-fetched-originals.ts [--commit]
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { decideEligibility } from '../src/lib/planning-intelligence/eligibility'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())
const commit = process.argv.includes('--commit')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) }) },
})

async function retry<T>(run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await run()
    if (!error) return data as T
    if (attempt >= 4) throw error
    await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
  }
}

async function main() {
  // Every fetched record is linked: as a family member, or as the original its follow-ons cite.
  const ids = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const page = await retry<Array<{ child_application_id: string; parent_application_id: string | null }>>(() =>
      db.from('planning_application_links').select('child_application_id,parent_application_id').order('id').range(from, from + 999))
    for (const row of page) { ids.add(row.child_application_id); if (row.parent_application_id) ids.add(row.parent_application_id) }
    if (page.length < 1000) break
  }

  const admit: Array<{ id: string; council: string; reference: string; limbs: string[] }> = []
  let fetched = 0, outside = 0
  const all = [...ids]
  for (let i = 0; i < all.length; i += 200) {
    const rows = await retry<Array<{ id: string; authority_slug: string; reference: string; intelligence_tier: boolean; classification_state: string; retrieved_via: string | null }>>(() =>
      db.from('planning_applications').select('id,authority_slug,reference,intelligence_tier,classification_state,retrieved_via:raw->>retrieved_via')
        .in('id', all.slice(i, i + 200)).eq('intelligence_tier', false).eq('classification_state', 'not_eligible'))
    const candidates = rows.filter(row => row.retrieved_via === 'associated' || row.retrieved_via === 'reference')
    fetched += candidates.length
    if (candidates.length === 0) continue
    const raws = await retry<Array<{ id: string; raw: PlotaApplication }>>(() =>
      db.from('planning_applications').select('id,raw').in('id', candidates.map(row => row.id)))
    const rawOf = new Map(raws.map(row => [row.id, row.raw]))
    for (const row of candidates) {
      const decision = decideEligibility(rawOf.get(row.id)!)
      if (!decision.intelligenceTier) { outside++; continue }
      admit.push({ id: row.id, council: row.authority_slug, reference: row.reference, limbs: decision.limbs })
    }
  }

  const byLimb: Record<string, number> = {}
  admit.forEach(row => row.limbs.forEach(limb => { byLimb[limb] = (byLimb[limb] ?? 0) + 1 }))
  console.log(JSON.stringify({ commit, linkedApplications: ids.size, fetchedOutsideTier: fetched, stayOutside: outside, toAdmit: admit.length, byLimb, sample: admit.slice(0, 5).map(row => `${row.council} ${row.reference}`) }))

  if (!commit) return
  let admitted = 0
  for (let i = 0; i < admit.length; i += 200) {
    const updated = await retry<Array<{ id: string }>>(() => db.from('planning_applications')
      .update({ intelligence_tier: true, classification_state: 'queued', updated_at: new Date().toISOString() })
      .in('id', admit.slice(i, i + 200).map(row => row.id)).eq('classification_state', 'not_eligible').select('id'))
    admitted += updated.length
  }
  console.log(JSON.stringify({ admitted }))
}

main().catch(error => { console.error(error); process.exitCode = 1 })
