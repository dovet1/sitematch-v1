/**
 * M8 debug map: export a standalone, self-contained HTML (Leaflet + OSM tiles) that plots a
 * GEOGRAPHICALLY VARIED sample of candidate sites with the constraint polygons touching them
 * — EA Flood Zones 2/3 (blue shades) and Green Belt (green) — so we can eyeball the M8 gate:
 *   "does the parcel really sit within the flood-zone / green-belt extent the layer draws,
 *    and is the recorded overlap fraction plausible?"
 * Watch for: parcels that only clip a zone at a corner (a near-miss the token list drops),
 * mis-projected layers, and sites shown clear that visibly sit inside a designation.
 *
 * Sampling spreads sites across a grid over their extent (seeded, reproducible).
 * Geometry comes from the debug_site_constraint_map() RPC.
 *
 * Run from apps/web (after associate:candidate-constraints):
 *   npm run export:constraint-debug-map -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--max-acres <n>] \
 *     [--sample 25] [--grid 6] [--radius 400] [--seed 42] [--out <path.html>]
 *
 *   npm run export:constraint-debug-map -- --only-constrained   # bias the sample to constrained sites
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const maxAcres = arg('max-acres') ? Number(arg('max-acres')) : null
const sampleSize = arg('sample') ? Number(arg('sample')) : 25
const grid = arg('grid') ? Number(arg('grid')) : 6
const radiusM = arg('radius') ? Number(arg('radius')) : 400
const seed = arg('seed') ? Number(arg('seed')) : 42
const onlyConstrained = flag('only-constrained')
const outPath = arg('out')
  ? path.resolve(arg('out') as string)
  : path.resolve(process.cwd(), '../../artifacts/find-sites-m8/constraint-debug-map.html')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Deterministic PRNG (mulberry32) so a given --seed reproduces the same sample.
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Centroid { id: string; lon: number; lat: number; area_acres: number | null }

function geographicallyVariedSample(rows: Centroid[], n: number): Centroid[] {
  if (rows.length <= n) return rows
  const rand = mulberry32(seed)
  const lons = rows.map((r) => r.lon)
  const lats = rows.map((r) => r.lat)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const spanLon = maxLon - minLon || 1e-9
  const spanLat = maxLat - minLat || 1e-9
  const cells = new Map<string, Centroid[]>()
  for (const r of rows) {
    const cx = Math.min(grid - 1, Math.floor(((r.lon - minLon) / spanLon) * grid))
    const cy = Math.min(grid - 1, Math.floor(((r.lat - minLat) / spanLat) * grid))
    const key = `${cx},${cy}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key)!.push(r)
  }
  const buckets = Array.from(cells.values())
  for (const b of buckets) b.sort(() => rand() - 0.5)
  buckets.sort(() => rand() - 0.5)
  const picked: Centroid[] = []
  let i = 0
  while (picked.length < n && buckets.some((b) => b.length)) {
    const b = buckets[i % buckets.length]
    if (b.length) picked.push(b.pop()!)
    i++
  }
  return picked
}

function htmlDocument(featureCollection: unknown, meta: Record<string, unknown>): string {
  const fc = JSON.stringify(featureCollection)
  const metaJson = JSON.stringify(meta)
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Find Sites M8 — constraints debug map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin: 0; height: 100%; font: 13px/1.4 system-ui, sans-serif; }
  #map { position: absolute; inset: 0 320px 0 0; }
  #panel { position: absolute; top: 0; right: 0; bottom: 0; width: 320px; overflow: auto;
    padding: 12px 14px; background: #fafafa; border-left: 1px solid #ddd; box-sizing: border-box; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  .k { color: #666; }
  .legend .swatch { display:inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
  ul { padding-left: 16px; margin: 6px 0; }
  code { background: #eee; padding: 0 3px; border-radius: 3px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>M8 constraints</h1>
  <div id="meta" class="k"></div>
  <div class="legend" style="margin-top:10px">
    <div><span class="swatch" style="background:rgba(37,99,235,.35);border:1px solid #1d4ed8"></span> Flood Zone 3 (associated)</div>
    <div><span class="swatch" style="background:rgba(96,165,250,.30);border:1px solid #3b82f6"></span> Flood Zone 2 (associated)</div>
    <div><span class="swatch" style="background:rgba(22,163,74,.28);border:1px solid #15803d"></span> Green Belt (associated)</div>
    <div><span class="swatch" style="background:rgba(148,163,184,.18);border:1px dashed #94a3b8"></span> context constraint (≤ radius)</div>
    <div><span class="swatch" style="background:rgba(234,88,12,.18);border:2px solid #ea580c"></span> candidate site</div>
  </div>
  <p class="k" style="margin-top:10px">Click a site or constraint for its attributes. Check the parcel really sits within the drawn extent, and that a corner-clip near-miss is not treated as an intersection.</p>
  <div id="info"></div>
</div>
<script>
  const fc = ${fc};
  const meta = ${metaJson};
  document.getElementById('meta').innerHTML =
    'source <code>' + meta.site_source + '</code> · ' + meta.sample + ' sites · radius ' + meta.radius_m + 'm · seed ' + meta.seed;

  const map = L.map('map').setView([51.28, 1.08], 11);
  window.fc = fc; window.map = map;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const info = document.getElementById('info');
  function show(props) {
    info.innerHTML = '<h1 style="font-size:13px;margin:10px 0 4px">Selected</h1><ul>' +
      Object.entries(props).map(([k,v]) => '<li><span class="k">'+k+'</span>: '+ (v===null?'—':(typeof v==='object'?JSON.stringify(v):v)) +'</li>').join('') + '</ul>';
  }

  function constraintColor(type) {
    if (type === 'flood_zone_3') return '#1d4ed8';
    if (type === 'flood_zone_2') return '#3b82f6';
    if (type === 'green_belt') return '#15803d';
    return '#6b7280';
  }

  L.geoJSON(fc, {
    style: f => {
      const layer = f.properties.layer;
      const type = f.properties.constraint_type;
      if (layer === 'context_constraint') return { color: '#94a3b8', weight: 1, dashArray: '4 3', fillColor: constraintColor(type), fillOpacity: 0.12, opacity: 0.6 };
      if (layer === 'assoc_constraint') return { color: constraintColor(type), weight: 1.5, fillColor: constraintColor(type), fillOpacity: 0.3 };
      if (layer === 'site') return { color: '#ea580c', weight: 2, fillColor: '#ea580c', fillOpacity: 0.18 };
      return {};
    },
    onEachFeature: (f, lyr) => {
      lyr.on('click', () => show(f.properties));
      if (f.properties.layer === 'assoc_constraint' || f.properties.layer === 'context_constraint')
        lyr.bindTooltip(f.properties.constraint_type);
      if (f.properties.layer === 'site') {
        const cs = (f.properties.constraints || []).map(c => c.constraint_type).join(', ') || 'clear';
        lyr.bindTooltip('site · ' + cs);
      }
    }
  }).addTo(map);

  const sites = L.geoJSON({ type:'FeatureCollection', features: fc.features.filter(f => f.properties.layer === 'site') });
  const b = sites.getBounds();
  let fitTries = 0;
  function fit() {
    map.invalidateSize();
    if (map.getSize().x > 0 && b.isValid()) { map.fitBounds(b.pad(0.15)); return; }
    if (fitTries++ < 40) setTimeout(fit, 100);
  }
  window.addEventListener('load', fit);
  fit();
</script>
</body>
</html>`
}

// Decode a little-endian EWKB POINT hex (as candidate_sites.centroid is returned) → lon/lat.
// Layout: 1B order + 4B type + 4B srid + 8B X + 8B Y (hex chars: 18 header, 16 X, 16 Y).
function parseEwkbPointHex(hex: string): { lon: number; lat: number } | null {
  if (!hex || hex.length < 50) return null
  const le = (h: string): number => {
    const bytes = new Uint8Array(8)
    for (let i = 0; i < 8; i++) bytes[i] = parseInt(h.substr(i * 2, 2), 16)
    return new DataView(bytes.buffer).getFloat64(0, true)
  }
  const lon = le(hex.substr(18, 16))
  const lat = le(hex.substr(34, 16))
  return Number.isFinite(lon) && Number.isFinite(lat) ? { lon, lat } : null
}

// Keyset-page candidate_sites for the id POOL (id + area only — light; selecting the
// geometry centroid alongside the unindexed area_acres filter pushes early pages over the
// statement timeout, so centroids are fetched separately by PK below). NOT the
// universe_site_centroids RPC, which recomputes centroids over the whole universe and times
// out (the M7 lesson).
async function fetchPoolIds(): Promise<{ id: string; area_acres: number | null }[]> {
  const out: { id: string; area_acres: number | null }[] = []
  const PAGE = 1000
  let last = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    let q = supabase
      .from('candidate_sites')
      .select('id, area_acres')
      .eq('source', siteSource)
      .gte('area_acres', minAcres)
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (maxAcres != null) q = q.lt('area_acres', maxAcres)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) out.push({ id: r.id as string, area_acres: r.area_acres as number | null })
    if (page.length < PAGE) break
    last = page[page.length - 1].id as string
  }
  return out
}

// Fetch centroids for a specific id set via PK .in() chunks (fast — no area-filter scan, uses
// the primary key). Decodes the EWKB point hex to lon/lat.
async function fetchCentroidsForIds(sites: { id: string; area_acres: number | null }[]): Promise<Centroid[]> {
  const areaById = new Map(sites.map((s) => [s.id, s.area_acres]))
  const ids = sites.map((s) => s.id)
  const out: Centroid[] = []
  const CHUNK = 100 // a larger .in() list makes an over-long URL → "fetch failed" (the M5 trap)
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data, error } = await supabase.from('candidate_sites').select('id, centroid').in('id', chunk)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const pt = parseEwkbPointHex(r.centroid as string)
      if (pt) out.push({ id: r.id as string, lon: pt.lon, lat: pt.lat, area_acres: areaById.get(r.id as string) ?? null })
    }
  }
  return out
}

// The set of sites that carry at least one constraint row (keyset on the small assoc table).
async function fetchConstrainedSiteIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  const PAGE = 1000
  let last = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const { data, error } = await supabase
      .from('candidate_site_constraints')
      .select('id, candidate_site_id')
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) ids.add(r.candidate_site_id as string)
    if (page.length < PAGE) break
    last = page[page.length - 1].id as string
  }
  return ids
}

async function main() {
  let pool = await fetchPoolIds()
  if (pool.length === 0) {
    console.error('No sites in the universe — run associate:candidate-constraints first.')
    process.exit(1)
  }
  if (onlyConstrained) {
    const keep = await fetchConstrainedSiteIds()
    pool = pool.filter((p) => keep.has(p.id))
    console.info(`--only-constrained: ${pool.length.toLocaleString()} sites with at least one constraint row.`)
    if (pool.length === 0) { console.error('No constrained sites found.'); process.exit(1) }
  }
  const centroids = await fetchCentroidsForIds(pool)
  console.info(`Universe: ${centroids.length.toLocaleString()} sites; sampling ${sampleSize} spread over a ${grid}×${grid} grid (seed ${seed}).`)

  const sample = geographicallyVariedSample(centroids, sampleSize)

  // Fetch the debug GeoJSON PER SITE and merge. EA flood polygons can be single
  // multipolygons with enormous vertex counts, so a batched call for several such sites
  // returns a response big enough to fail the fetch; per-site keeps each response bounded,
  // and a site that still overflows (intersects a huge floodplain) is skipped, not fatal.
  type FC = { type: 'FeatureCollection'; features: unknown[] }
  const merged: FC = { type: 'FeatureCollection', features: [] }
  const rendered: typeof sample = []
  const skipped: string[] = []
  for (const s of sample) {
    try {
      const { data, error } = await supabase.rpc('debug_site_constraint_map', {
        p_site_ids: [s.id],
        p_radius_m: radiusM,
      })
      if (error) throw new Error(error.message)
      const feats = (data as FC)?.features ?? []
      merged.features.push(...feats)
      rendered.push(s)
    } catch (e) {
      skipped.push(s.id)
      console.warn(`  skipped ${s.id.slice(0, 8)} (oversized/failed response: ${e instanceof Error ? e.message : e})`)
    }
  }

  const html = htmlDocument(merged, {
    site_source: siteSource,
    sample: rendered.length,
    radius_m: radiusM,
    seed,
    generated_at: new Date().toISOString(),
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html, 'utf8')
  console.info(`\nWrote debug map: ${outPath}`)
  console.info(`  ${rendered.length} sites rendered, ${merged.features.length} features${skipped.length ? `, ${skipped.length} skipped (oversized geometry)` : ''}. Open it in a browser and inspect the overlaps.`)
  console.info('  Rendered site references:')
  for (const s of rendered) {
    console.info(`    ${s.id.slice(0, 8)}  ${(s.area_acres != null ? `${Number(s.area_acres).toFixed(2)}ac` : '—').padStart(8)}  @ ${s.lat.toFixed(4)},${s.lon.toFixed(4)}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
