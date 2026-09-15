/** Read-only Phase 1 probe for the Planning Monitor (docs/planning-monitor-implementation-plan.md).
 * Sizes the store the Monitor reads nationally: how many records exist, how many pass the base
 * commercial / 15+ homes rule inside the default 30-day window, and how that splits across the
 * four nations. Counts only; nothing is written.
 * Run from apps/web: ../../node_modules/.bin/tsx scripts/check-planning-monitor-coverage.ts
 *
 * Nations are approximated from the authority slug prefix Plota uses where present and otherwise
 * reported as "unassigned"; this is a sampling aid, not a boundary test.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const COMMERCIAL_LIMBS = '{A,A-described,D,D-described}'

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const count = async (label: string, build: (q: any) => any) => {
    const started = Date.now()
    const { count, error } = await build(db.from('planning_applications').select('id', { count: 'exact', head: true }))
    console.log(JSON.stringify({ label, count, ms: Date.now() - started, error: error?.message }))
  }

  // Exact whole-table counts exceed the API role's statement timeout; the planner estimate is enough to size it.
  {
    const { count: estimate, error } = await db.from('planning_applications').select('id', { count: 'planned', head: true })
    console.log(JSON.stringify({ label: 'all records (planner estimate)', count: estimate, error: error?.message }))
  }
  await count('received in last 30 days', (q) => q.gte('date_received', since))
  await count('last 30 days, commercial limb', (q) => q.gte('date_received', since).overlaps('eligibility_limbs', COMMERCIAL_LIMBS))
  await count('last 30 days, stated 15+ homes', (q) => q.gte('date_received', since).gte('stated_dwelling_count', 15))
  await count('no location', (q) => q.is('location', null))
  for (const provenance of ['source_exact', 'source_centroid', 'postcode_centroid', 'missing']) {
    await count(`provenance ${provenance}`, (q) => q.eq('location_provenance', provenance))
  }
  await count('decided in last 7 days', (q) => q.gte('date_decided', new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)))

  const { data: coverage, error } = await db.from('planning_authority_coverage').select('authority_slug, freshness_state, metadata').limit(1000)
  if (error) {
    console.log(JSON.stringify({ label: 'authority coverage', error: error.message }))
  } else {
    const byState = new Map<string, number>()
    const byNation = new Map<string, number>()
    for (const row of coverage ?? []) {
      byState.set(row.freshness_state, (byState.get(row.freshness_state) ?? 0) + 1)
      const nation = String((row.metadata as Record<string, unknown> | null)?.nation ?? 'unassigned')
      byNation.set(nation, (byNation.get(nation) ?? 0) + 1)
    }
    console.log(JSON.stringify({ label: 'authority coverage', authorities: coverage?.length, byState: Object.fromEntries(byState), byNation: Object.fromEntries(byNation) }))
  }

  for (const table of ['planning_monitor_patches', 'planning_change_events', 'development_facts']) {
    // A HEAD request drops the error body, so a missing relation would read as present.
    const { error: tableError } = await db.from(table).select('*').limit(1)
    console.log(JSON.stringify({ label: `table ${table}`, present: !tableError, error: tableError?.message }))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
