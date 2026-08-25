/**
 * M2 inspection: summarise the real candidate-site universe so we can judge whether
 * the source (e.g. HMLR INSPIRE titles) is a useful unit of candidate discovery —
 * BEFORE building enrichment around it. Prints counts, area/compactness distribution
 * and a random sample to eyeball on a map.
 *
 * Run from apps/web:
 *   npm run inspect:candidate-sites -- [--source hmlr_inspire] [--sample 20]
 *
 * This produces evidence for the M2 STOP gate, not a fabricated demo. Cross-check the
 * sample references/geometries visually against the map/source.
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const sourceFilter = arg('source')
const sampleSize = arg('sample') ? Number(arg('sample')) : 20

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Acreage buckets aligned to the drive-thru window (0.3–0.7 ac) for quick reading.
const BUCKETS: Array<[string, number, number]> = [
  ['< 0.1 ac', 0, 0.1],
  ['0.1–0.3 ac', 0.1, 0.3],
  ['0.3–0.7 ac (target)', 0.3, 0.7],
  ['0.7–2 ac', 0.7, 2],
  ['2–10 ac', 2, 10],
  ['> 10 ac', 10, Infinity],
]

async function main() {
  let base = supabase.from('candidate_sites').select('*', { count: 'exact', head: true })
  if (sourceFilter) base = base.eq('source', sourceFilter)
  const { count, error } = await base
  if (error) throw new Error(error.message)
  const total = count ?? 0
  console.info(`\ncandidate_sites total${sourceFilter ? ` (source=${sourceFilter})` : ''}: ${total.toLocaleString()}\n`)
  if (total === 0) {
    console.info('Nothing to inspect yet — run the importer first.')
    return
  }

  // Pull acreage + compactness in pages for the distribution (avoids RPC).
  // A stable ORDER BY is required: without it Postgres may repeat/skip rows across
  // paged .range() calls, which silently undercounts the distribution.
  const rows: Array<{ area_acres: number | null; compactness: number | null; current_land_use: string | null }> = []
  const PAGE = 1000
  for (let from = 0; from < total; from += PAGE) {
    let q = supabase
      .from('candidate_sites')
      .select('area_acres, compactness, current_land_use')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (sourceFilter) q = q.eq('source', sourceFilter)
    const { data, error: pageErr } = await q
    if (pageErr) throw new Error(pageErr.message)
    rows.push(...(data ?? []))
  }

  console.info('Area distribution:')
  for (const [label, lo, hi] of BUCKETS) {
    const n = rows.filter((r) => r.area_acres != null && r.area_acres >= lo && r.area_acres < hi).length
    const pct = total > 0 ? Math.round((100 * n) / total) : 0
    console.info(`  ${label.padEnd(22)} ${String(n).padStart(7)}  ${'█'.repeat(Math.round(pct / 2))} ${pct}%`)
  }

  const compacts = rows.map((r) => r.compactness).filter((c): c is number => c != null).sort((a, b) => a - b)
  if (compacts.length) {
    const q = (p: number) => compacts[Math.min(compacts.length - 1, Math.floor(p * compacts.length))]
    console.info(`\nCompactness (0=sliver, 1=circle): p10=${q(0.1).toFixed(2)} median=${q(0.5).toFixed(2)} p90=${q(0.9).toFixed(2)}`)
    const slivers = compacts.filter((c) => c < 0.15).length
    console.info(`  very elongated (<0.15): ${slivers.toLocaleString()} (${Math.round((100 * slivers) / total)}%) — likely road/infrastructure artefacts`)
  }

  const withLandUse = rows.filter((r) => r.current_land_use != null).length
  console.info(`\nLand use known: ${withLandUse.toLocaleString()} / ${total.toLocaleString()} (${Math.round((100 * withLandUse) / total)}%)`)

  // Random sample to eyeball against the map.
  let sq = supabase
    .from('candidate_sites')
    .select('id, name, area_acres, compactness, current_land_use, source_reference, centroid')
    .limit(sampleSize)
  if (sourceFilter) sq = sq.eq('source', sourceFilter)
  const { data: sample, error: sErr } = await sq
  if (sErr) throw new Error(sErr.message)
  console.info(`\nSample of ${sample?.length ?? 0} (classify each visually — residential / commercial / agricultural / infrastructure artefact / large mixed / standalone dev parcel):`)
  for (const s of sample ?? []) {
    console.info(
      `  ${(s.source_reference ?? s.id).toString().slice(0, 24).padEnd(24)} ` +
        `${(s.area_acres != null ? `${Number(s.area_acres).toFixed(2)}ac` : '—').padStart(9)} ` +
        `compact=${s.compactness != null ? Number(s.compactness).toFixed(2) : '—'} ` +
        `use=${s.current_land_use ?? 'unknown'}`,
    )
  }

  console.info('\nM2 question: is an HMLR INSPIRE polygon a sufficiently useful STARTING unit for candidate discovery,')
  console.info('or only after filtering/enrichment? Record the answer + these numbers in docs/find_sites_mvp.md.\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
