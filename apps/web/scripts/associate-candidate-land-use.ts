/**
 * M5 association + fusion: attach land-use evidence to every candidate site in the
 * enrichment universe (HMLR polygons >= --min-acres, default 0.3 ac), then FUSE that
 * evidence into each site's normalised class + confidence.
 *
 * Two steps per batch:
 *   1. associate_candidate_site_land_use()  — PostGIS spatial join (polygon overlap +
 *      point inside/nearby). Idempotent per site; recomputes against ALL land_use_features.
 *   2. fuseSiteLandUse()  — the PURE, Jest-tested reduction (src/lib/site-matching/
 *      land-use-fusion.ts) run HERE in TS, then written back via
 *      apply_candidate_land_use_fusion(). `unknown` stays `unknown`; weak evidence never
 *      forces a class; conflicting strong evidence → 'mixed'.
 *
 * OCCUPIER-AGNOSTIC enrichment of the reusable dataset — no occupier acceptance rules are
 * applied here (that is a search-time decision). Re-running is safe.
 *
 * Requires land_use_features populated (import:land-use and/or sync:store-land-use).
 *
 * Run from apps/web (after applying both M5 migrations):
 *   npm run associate:candidate-land-use -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--nearby-point 25] \
 *     [--min-overlap 0.02] [--batch 200]
 *
 * Then: npm run inspect:candidate-land-use
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { fuseSiteLandUse, type EvidenceRelation, type LandUseEvidence } from '../src/lib/site-matching/land-use-fusion'
import type { LandUseConfidence } from '../src/lib/site-matching/types'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const nearbyPointM = arg('nearby-point') ? Number(arg('nearby-point')) : 25
const minOverlap = arg('min-overlap') ? Number(arg('min-overlap')) : 0.02
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

// Fetch ALL universe ids with a stable ORDER BY (the M2 paged-.range() lesson).
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

interface LandUseRow {
  candidate_site_id: string
  normalised_class: string
  class_confidence: string | null
  relation: string
  overlap_fraction: number | null
  source: string
  source_reference: string | null
  name: string | null
}

// Pull all association rows for a batch of sites (paged — a busy urban batch can exceed
// the PostgREST 1,000-row cap, the same M2/M3/M4 trap).
async function fetchAssociations(siteIds: string[]): Promise<Map<string, LandUseEvidence[]>> {
  const bySite = new Map<string, LandUseEvidence[]>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('candidate_site_land_use')
      .select('candidate_site_id, normalised_class, class_confidence, relation, overlap_fraction, source, source_reference, name')
      .in('candidate_site_id', siteIds)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as LandUseRow[]
    for (const r of rows) {
      const ev: LandUseEvidence = {
        landUseClass: r.normalised_class,
        confidence: (r.class_confidence ?? 'low') as LandUseConfidence,
        relation: r.relation as EvidenceRelation,
        overlapFraction: r.overlap_fraction,
        source: r.source,
        sourceReference: r.source_reference,
        name: r.name,
      }
      const list = bySite.get(r.candidate_site_id)
      if (list) list.push(ev)
      else bySite.set(r.candidate_site_id, [ev])
    }
    if (rows.length < PAGE) break
  }
  return bySite
}

async function main() {
  console.info(
    `M5 land-use association + fusion: site-source=${siteSource} min-acres=${minAcres} ` +
      `nearby-point=${nearbyPointM}m min-overlap=${minOverlap}`,
  )

  const { count: fCount } = await supabase
    .from('land_use_features')
    .select('id', { count: 'exact', head: true })
  console.info(`Land-use evidence features available: ${(fCount ?? 0).toLocaleString()}`)
  if (!fCount) {
    console.info('No land_use_features — run import:land-use and/or sync:store-land-use first.')
    return
  }

  const ids = await fetchUniverseIds()
  console.info(`Enrichment universe: ${ids.length.toLocaleString()} candidate sites >= ${minAcres} ac.`)
  if (ids.length === 0) return

  const provenance = {
    nearby_point_m: nearbyPointM,
    min_overlap_fraction: minOverlap,
    computed_at: new Date().toISOString(),
  }

  let processed = 0
  let assocRows = 0
  let classified = 0
  let unknown = 0
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)

    // 1. spatial association
    const { data: aData, error: aErr } = await supabase.rpc('associate_candidate_site_land_use', {
      p_site_ids: batch,
      p_nearby_point_m: nearbyPointM,
      p_min_overlap_fraction: minOverlap,
      p_provenance: provenance,
    })
    if (aErr) throw new Error(aErr.message)
    assocRows += typeof aData === 'number' ? aData : 0

    // 2. fuse in TS + write back
    const bySite = await fetchAssociations(batch)
    const updates = batch.map((siteId) => {
      const fused = fuseSiteLandUse(bySite.get(siteId) ?? [])
      if (fused.landUse == null) unknown++
      else classified++
      return {
        site_id: siteId,
        current_land_use: fused.landUse,
        land_use_confidence: fused.confidence,
        land_use_evidence: fused.evidence,
      }
    })
    const { error: uErr } = await supabase.rpc('apply_candidate_land_use_fusion', { p_updates: updates })
    if (uErr) throw new Error(uErr.message)

    processed += batch.length
    if (processed % 1000 === 0 || processed === ids.length) {
      console.info(
        `  processed ${processed.toLocaleString()}/${ids.length.toLocaleString()} sites ` +
          `(${assocRows.toLocaleString()} assoc rows; ${classified.toLocaleString()} classified, ${unknown.toLocaleString()} unknown)…`,
      )
    }
  }

  console.info(
    `\nAssociation + fusion complete: ${processed.toLocaleString()} sites; ` +
      `${assocRows.toLocaleString()} candidate_site_land_use rows; ` +
      `${classified.toLocaleString()} classified, ${unknown.toLocaleString()} still unknown.`,
  )
  console.info('Next: npm run inspect:candidate-land-use  (the M5 gate: coverage + confidence + agreement)\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
