/**
 * M3 association: associate every candidate site in the enrichment universe (HMLR
 * polygons >= --min-acres, default 0.3 ac) with its relevant road link(s) from the
 * imported road network, via the PostGIS RPC associate_candidate_site_roads().
 *
 * This is OCCUPIER-AGNOSTIC enrichment of the reusable dataset — no occupier area/road
 * criteria are applied here (those live in the search funnel). Re-running is safe: the
 * RPC clears + recomputes associations per site.
 *
 * Run from apps/web (after applying 20260725000000_associate_candidate_roads.sql and
 * importing candidate_sites + road_links):
 *   npm run associate:candidate-roads -- \
 *     [--site-source hmlr_inspire] [--road-source os_open_roads] \
 *     [--min-acres 0.3] [--max-distance 200] [--top-k 8] [--batch 200]
 *
 * Then report coverage with:  npm run inspect:candidate-roads
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const roadSource = arg('road-source') ?? 'os_open_roads'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const maxDistanceM = arg('max-distance') ? Number(arg('max-distance')) : 200
const topK = arg('top-k') ? Number(arg('top-k')) : 8
const batchSize = arg('batch') ? Number(arg('batch')) : 200

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Read the version of the imported road dataset so it travels into association provenance.
async function roadDatasetVersion(): Promise<string | null> {
  const { data } = await supabase
    .from('road_links')
    .select('provenance')
    .eq('source', roadSource)
    .limit(1)
    .maybeSingle()
  const prov = (data?.provenance ?? {}) as { version?: string | null }
  return prov.version ?? null
}

// Fetch ALL universe site ids with a stable ORDER BY (the M2 lesson: paged .range()
// without ORDER BY repeats/skips rows). Only ids are pulled, so this stays light.
async function fetchUniverseIds(): Promise<string[]> {
  const { count, error: cErr } = await supabase
    .from('candidate_sites')
    .select('id', { count: 'exact', head: true })
    .eq('source', siteSource)
    .gte('area_acres', minAcres)
  if (cErr) throw new Error(cErr.message)
  const total = count ?? 0
  const ids: string[] = []
  const PAGE = 1000
  for (let from = 0; from < total; from += PAGE) {
    const { data, error } = await supabase
      .from('candidate_sites')
      .select('id')
      .eq('source', siteSource)
      .gte('area_acres', minAcres)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    ids.push(...(data ?? []).map((r) => r.id as string))
  }
  return ids
}

async function main() {
  console.info(
    `M3 association: site-source=${siteSource} road-source=${roadSource} ` +
      `min-acres=${minAcres} max-distance=${maxDistanceM}m top-k=${topK}`,
  )

  const roadVersion = await roadDatasetVersion()
  const ids = await fetchUniverseIds()
  console.info(`Enrichment universe: ${ids.length.toLocaleString()} candidate sites >= ${minAcres} ac.`)
  if (ids.length === 0) {
    console.info('Nothing to associate — import candidate_sites first.')
    return
  }

  const provenance = {
    method: 'nearest_topk_plus_primary_class_within_radius',
    road_source: roadSource,
    road_dataset_version: roadVersion,
    max_distance_m: maxDistanceM,
    top_k: topK,
    computed_at: new Date().toISOString(),
  }

  let processed = 0
  let rowsWritten = 0
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data, error } = await supabase.rpc('associate_candidate_site_roads', {
      p_site_ids: batch,
      p_max_distance_m: maxDistanceM,
      p_top_k: topK,
      p_road_source: roadSource,
      p_provenance: provenance,
    })
    if (error) throw new Error(error.message)
    rowsWritten += typeof data === 'number' ? data : 0
    processed += batch.length
    if (processed % 1000 === 0 || processed === ids.length) {
      console.info(`  associated ${processed.toLocaleString()}/${ids.length.toLocaleString()} sites (${rowsWritten.toLocaleString()} road rows)…`)
    }
  }

  console.info(
    `\nAssociation complete: ${processed.toLocaleString()} sites processed, ` +
      `${rowsWritten.toLocaleString()} candidate_site_roads rows written.`,
  )
  console.info('Next: npm run inspect:candidate-roads  (coverage + drive-thru funnel, reported separately)\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
