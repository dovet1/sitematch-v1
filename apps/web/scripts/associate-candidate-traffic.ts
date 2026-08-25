/**
 * M4 association: attach DfT AADF count points to every candidate site in the enrichment
 * universe (HMLR polygons >= --min-acres, default 0.3 ac), via the PostGIS RPC
 * associate_candidate_site_traffic(), under BOTH linking methods so they can be compared:
 *   - count_point_direct : nearest count point to the site polygon (raw proximity)
 *   - via_road           : count point snapped to the site's associated road link (M3)
 *
 * OCCUPIER-AGNOSTIC enrichment of the reusable dataset — no occupier AADF thresholds are
 * applied here. Re-running is safe: the RPC clears + recomputes per site.
 *
 * Requires M3 to have run (candidate_site_roads populated) for the via_road method, plus
 * traffic_counts imported. Run from apps/web (after applying
 * 20260726000000_create_traffic_counts.sql + 20260727000000_associate_candidate_traffic.sql):
 *   npm run associate:candidate-traffic -- \
 *     [--site-source hmlr_inspire] [--traffic-source dft_aadf] [--road-source os_open_roads] \
 *     [--min-acres 0.3] [--max-distance 300] [--road-snap 30] [--year <n>] [--batch 200]
 *
 * To compare against DfT Major Roads geometry: import that layer into road_links with
 * source=dft_major_roads, re-run `associate:candidate-roads --road-source dft_major_roads`,
 * then re-run this with `--road-source dft_major_roads`.
 *
 * Then: npm run inspect:candidate-traffic
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const trafficSource = arg('traffic-source') ?? 'dft_aadf'
const roadSource = arg('road-source') ?? 'os_open_roads'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const maxDistanceM = arg('max-distance') ? Number(arg('max-distance')) : 300
const roadSnapM = arg('road-snap') ? Number(arg('road-snap')) : 30
const year = arg('year') ? Number(arg('year')) : null
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

// Read the imported DfT dataset version so it travels into association provenance.
async function trafficDatasetVersion(): Promise<string | null> {
  const { data } = await supabase
    .from('traffic_counts')
    .select('provenance')
    .eq('source', trafficSource)
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
    `M4 traffic association: site-source=${siteSource} traffic-source=${trafficSource} ` +
      `road-source=${roadSource} min-acres=${minAcres} max-distance=${maxDistanceM}m ` +
      `road-snap=${roadSnapM}m year=${year ?? 'latest'}`,
  )

  const { count: tCount } = await supabase
    .from('traffic_counts')
    .select('id', { count: 'exact', head: true })
    .eq('source', trafficSource)
  console.info(`Traffic count points available (source ${trafficSource}): ${(tCount ?? 0).toLocaleString()}`)
  if (!tCount) {
    console.info('No traffic points imported — run import:traffic-counts first.')
    return
  }

  const trafficVersion = await trafficDatasetVersion()
  const ids = await fetchUniverseIds()
  console.info(`Enrichment universe: ${ids.length.toLocaleString()} candidate sites >= ${minAcres} ac.`)
  if (ids.length === 0) {
    console.info('Nothing to associate — import candidate_sites first.')
    return
  }

  const provenance = {
    method: 'direct_and_via_road',
    traffic_source: trafficSource,
    traffic_dataset_version: trafficVersion,
    road_source: roadSource,
    max_distance_m: maxDistanceM,
    road_snap_m: roadSnapM,
    year_mode: year ?? 'latest',
    computed_at: new Date().toISOString(),
  }

  let processed = 0
  let rowsWritten = 0
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data, error } = await supabase.rpc('associate_candidate_site_traffic', {
      p_site_ids: batch,
      p_max_distance_m: maxDistanceM,
      p_road_snap_m: roadSnapM,
      p_traffic_source: trafficSource,
      p_road_source: roadSource,
      p_year: year,
      p_provenance: provenance,
    })
    if (error) throw new Error(error.message)
    rowsWritten += typeof data === 'number' ? data : 0
    processed += batch.length
    if (processed % 1000 === 0 || processed === ids.length) {
      console.info(`  associated ${processed.toLocaleString()}/${ids.length.toLocaleString()} sites (${rowsWritten.toLocaleString()} traffic rows)…`)
    }
  }

  console.info(
    `\nAssociation complete: ${processed.toLocaleString()} sites processed, ` +
      `${rowsWritten.toLocaleString()} candidate_site_traffic rows written (both methods).`,
  )
  console.info('Next: npm run inspect:candidate-traffic  (coverage + direct-vs-via_road method comparison)\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
