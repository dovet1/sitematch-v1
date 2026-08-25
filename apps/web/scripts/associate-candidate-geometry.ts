/**
 * M6 enrichment: compute derived geometry (approximate road frontage + nearest
 * significant junction/roundabout distance) for every candidate site in the
 * enrichment universe (HMLR polygons >= --min-acres, default 0.3 ac), via the
 * PostGIS RPC associate_candidate_site_geometry().
 *
 * Reads the M3 road associations (candidate_site_roads) for the frontage roads and
 * road_nodes for junctions — so run this AFTER associate:candidate-roads. It is
 * OCCUPIER-AGNOSTIC enrichment of the reusable dataset (no frontage/junction occupier
 * criteria are applied here — those live in the search funnel). Re-running is safe:
 * the RPC clears + recomputes per site.
 *
 * Run from apps/web (after applying 20260730000000_associate_candidate_geometry.sql):
 *   npm run associate:candidate-geometry -- \
 *     [--site-source hmlr_inspire] [--road-source os_open_roads] [--node-source os_open_roads] \
 *     [--min-acres 0.3] [--frontage-buffer 12] [--junction-radius 500] [--batch 200]
 *
 * Then report coverage with:  npm run inspect:candidate-geometry
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
const nodeSource = arg('node-source') ?? 'os_open_roads'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const frontageBufferM = arg('frontage-buffer') ? Number(arg('frontage-buffer')) : 12
const junctionRadiusM = arg('junction-radius') ? Number(arg('junction-radius')) : 500
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

// Read the imported road dataset version so it travels into association provenance.
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
    `M6 derived geometry: site-source=${siteSource} road-source=${roadSource} ` +
      `min-acres=${minAcres} frontage-buffer=${frontageBufferM}m junction-radius=${junctionRadiusM}m`,
  )

  const roadVersion = await roadDatasetVersion()
  const ids = await fetchUniverseIds()
  console.info(`Enrichment universe: ${ids.length.toLocaleString()} candidate sites >= ${minAcres} ac.`)
  if (ids.length === 0) {
    console.info('Nothing to enrich — import candidate_sites + run associate:candidate-roads first.')
    return
  }

  const provenance = {
    method: 'buffer_boundary_frontage_plus_nearest_significant_node',
    road_source: roadSource,
    node_source: nodeSource,
    road_dataset_version: roadVersion,
    frontage_buffer_m: frontageBufferM,
    junction_radius_m: junctionRadiusM,
    computed_at: new Date().toISOString(),
  }

  let processed = 0
  let rowsWritten = 0
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data, error } = await supabase.rpc('associate_candidate_site_geometry', {
      p_site_ids: batch,
      p_frontage_buffer_m: frontageBufferM,
      p_junction_radius_m: junctionRadiusM,
      p_road_source: roadSource,
      p_node_source: nodeSource,
      p_provenance: provenance,
    })
    if (error) throw new Error(error.message)
    rowsWritten += typeof data === 'number' ? data : 0
    processed += batch.length
    if (processed % 1000 === 0 || processed === ids.length) {
      console.info(`  enriched ${processed.toLocaleString()}/${ids.length.toLocaleString()} sites (${rowsWritten.toLocaleString()} geometry rows)…`)
    }
  }

  console.info(
    `\nDerived geometry complete: ${processed.toLocaleString()} sites processed, ` +
      `${rowsWritten.toLocaleString()} candidate_site_geometry rows written.`,
  )
  console.info('Next: npm run inspect:candidate-geometry  (frontage + junction coverage, two funnels reported separately)\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
