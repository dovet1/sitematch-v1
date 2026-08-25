/**
 * M8 enrichment: intersect every candidate site in the enrichment universe (HMLR polygons
 * >= --min-acres, default 0.3 ac) with the authoritative constraint layers
 * (constraint_features: EA Flood Zones 2/3, English Green Belt), via the PostGIS RPC
 * associate_candidate_site_constraints(). Writes one aggregated candidate_site_constraints
 * row per (site, constraint_type) with the union overlap-fraction of the site.
 *
 * OCCUPIER-AGNOSTIC enrichment of the reusable dataset — no exclude/warn/prefer decision is
 * applied here (that is a search-time concern of the engine's planning_constraints
 * evaluator). Re-running is safe: the RPC clears + recomputes per site (recomputing against
 * ALL constraint_features, so importing another layer and re-running picks it up).
 *
 * Requires constraint_features populated (import:constraints).
 *
 * Batch note: the union-of-intersections maths is heavier than a distance association
 * (like M6's frontage), so the default batch is small (40). Bump/reduce with --batch.
 *
 * Run from apps/web (after applying both M8 migrations):
 *   npm run associate:candidate-constraints -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--min-overlap 0.001] [--batch 40]
 *
 * Then: npm run inspect:candidate-constraints
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const minOverlap = arg('min-overlap') ? Number(arg('min-overlap')) : 0.001
const batchSize = arg('batch') ? Number(arg('batch')) : 40

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Fetch ALL universe ids via KEYSET pagination (id > :last) — NOT offset .range(): a deep
// OFFSET over the 74k candidate_sites table is O(offset) and blows the statement timeout
// (the M7 lesson). Seed with the zero-UUID (NOT '', an invalid uuid).
async function fetchUniverseIds(): Promise<string[]> {
  const ids: string[] = []
  const PAGE = 1000
  let last = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const { data, error } = await supabase
      .from('candidate_sites')
      .select('id')
      .eq('source', siteSource)
      .gte('area_acres', minAcres)
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(error.message)
    const page = data ?? []
    ids.push(...page.map((r) => r.id as string))
    if (page.length < PAGE) break
    last = page[page.length - 1].id as string
  }
  return ids
}

async function main() {
  console.info(
    `M8 constraint association: site-source=${siteSource} min-acres=${minAcres} ` +
      `min-overlap=${minOverlap} batch=${batchSize}`,
  )

  const { count: fCount } = await supabase
    .from('constraint_features')
    .select('id', { count: 'exact', head: true })
  console.info(`Constraint features available: ${(fCount ?? 0).toLocaleString()}`)
  if (!fCount) {
    console.info('No constraint_features — run import:constraints (Flood Zones + Green Belt) first.')
    return
  }

  const ids = await fetchUniverseIds()
  console.info(`Enrichment universe: ${ids.length.toLocaleString()} candidate sites >= ${minAcres} ac.`)
  if (ids.length === 0) return

  const provenance = {
    min_overlap_fraction: minOverlap,
    computed_at: new Date().toISOString(),
  }

  let processed = 0
  let rowsWritten = 0
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data, error } = await supabase.rpc('associate_candidate_site_constraints', {
      p_site_ids: batch,
      p_min_overlap_fraction: minOverlap,
      p_provenance: provenance,
    })
    if (error) throw new Error(error.message)
    rowsWritten += typeof data === 'number' ? data : 0
    processed += batch.length
    if (processed % 1000 === 0 || processed === ids.length) {
      console.info(`  enriched ${processed.toLocaleString()}/${ids.length.toLocaleString()} sites (${rowsWritten.toLocaleString()} constraint rows)…`)
    }
  }

  console.info(
    `\nConstraint association complete: ${processed.toLocaleString()} sites processed, ` +
      `${rowsWritten.toLocaleString()} candidate_site_constraints rows written.`,
  )
  console.info('Next: npm run inspect:candidate-constraints  (the M8 gate: coverage per constraint type, two funnels)\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
