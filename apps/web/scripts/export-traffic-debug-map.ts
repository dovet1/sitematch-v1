/**
 * M4 debug map: export a standalone, self-contained HTML (Leaflet + OSM tiles) that plots
 * a GEOGRAPHICALLY VARIED sample of candidate sites with their DfT AADF associations, so
 * we can eyeball the M4 gate question:
 *   "which count point does each site relate to, and where do the two linking methods
 *    (count_point_direct vs via_road) DISAGREE — and which is right?"
 * Each site draws a red connector to its best-DIRECT count point and an amber connector to
 * its best-VIA_ROAD count point; when they point at different count points, the divergence
 * is visible. Count points are sized by AADF and labelled with year + estimation method.
 *
 * Sampling spreads sites across a grid over their extent (seeded), same as M3. Geometry
 * comes from the debug_site_traffic_map() RPC.
 *
 * Run from apps/web (after associate:candidate-traffic):
 *   npm run export:traffic-debug-map -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--max-acres <n>] \
 *     [--sample 25] [--grid 6] [--radius 400] [--seed 42] [--out <path.html>]
 *     [--only-divergent]   # bias the sample to sites where the two methods disagree
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
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const maxAcres = arg('max-acres') ? Number(arg('max-acres')) : null
const sampleSize = arg('sample') ? Number(arg('sample')) : 25
const grid = arg('grid') ? Number(arg('grid')) : 6
const radiusM = arg('radius') ? Number(arg('radius')) : 400
const seed = arg('seed') ? Number(arg('seed')) : 42
const onlyDivergent = hasFlag('only-divergent')
const outPath = arg('out')
  ? path.resolve(arg('out') as string)
  : path.resolve(process.cwd(), '../../artifacts/find-sites-m4/traffic-debug-map.html')

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
  // Self-contained LOCAL debug file (Leaflet + OSM from CDN); not a published artifact.
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Find Sites M4 — traffic (DfT AADF) association debug map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin: 0; height: 100%; font: 13px/1.4 system-ui, sans-serif; }
  #map { position: absolute; inset: 0 340px 0 0; }
  #panel { position: absolute; top: 0; right: 0; bottom: 0; width: 340px; overflow: auto;
    padding: 12px 14px; background: #fafafa; border-left: 1px solid #ddd; box-sizing: border-box; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  .k { color: #666; }
  .legend div { margin: 2px 0; }
  .legend span.line { display: inline-block; width: 16px; height: 3px; vertical-align: middle; margin-right: 6px; }
  .legend span.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; vertical-align: middle; margin-right: 6px; }
  .swatch { display:inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
  ul { padding-left: 16px; margin: 6px 0; }
  code { background: #eee; padding: 0 3px; border-radius: 3px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>M4 traffic (DfT AADF)</h1>
  <div id="meta" class="k"></div>
  <div class="legend" style="margin-top:10px">
    <div><span class="line" style="background:#e11d48"></span> site → best DIRECT count point</div>
    <div><span class="line" style="background:#f59e0b"></span> site → best VIA_ROAD count point</div>
    <div><span class="line" style="background:#9ca3af"></span> context road (≤ radius)</div>
    <div><span class="line" style="background:#7c3aed"></span> site's associated road (M3)</div>
    <div><span class="dot" style="background:#10b981"></span> count point (size ∝ AADF; ring = a site's best pick)</div>
    <div><span class="swatch" style="background:rgba(37,99,235,.25);border:1px solid #2563eb"></span> candidate site</div>
  </div>
  <p class="k" style="margin-top:10px">Where a site's red and amber connectors point at DIFFERENT count points, the two linking methods disagree — check which road the site actually fronts. Click any count point / road / site for its attributes.</p>
  <div id="info"></div>
</div>
<script>
  const fc = ${fc};
  const meta = ${metaJson};
  document.getElementById('meta').innerHTML =
    'source <code>' + meta.site_source + '</code> · ' + meta.sample + ' sites · radius ' + meta.radius_m + 'm · seed ' + meta.seed +
    (meta.only_divergent ? ' · divergent-biased' : '');

  const map = L.map('map').setView([51.28, 1.08], 11);
  window.fc = fc; window.map = map;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const info = document.getElementById('info');
  function show(props) {
    info.innerHTML = '<h1 style="font-size:13px;margin:10px 0 4px">Selected</h1><ul>' +
      Object.entries(props).map(([k,v]) => '<li><span class="k">'+k+'</span>: '+ (v===null?'—':v) +'</li>').join('') + '</ul>';
  }

  // AADF -> marker radius (sqrt scale so a 40k road isn't 4x a 10k road's area).
  function aadfRadius(aadf) {
    if (aadf == null || aadf <= 0) return 3;
    return Math.max(3, Math.min(16, Math.sqrt(aadf) / 20));
  }

  L.geoJSON(fc, {
    style: f => {
      const layer = f.properties.layer;
      if (layer === 'context_road') return { color: '#9ca3af', weight: 2, opacity: 0.7 };
      if (layer === 'assoc_road')  return { color: '#7c3aed', weight: 3, opacity: 0.9 };
      if (layer === 'link_direct') return { color: '#e11d48', weight: 2, opacity: 0.9, dashArray: '4,4' };
      if (layer === 'link_via')    return { color: '#f59e0b', weight: 2, opacity: 0.9, dashArray: '6,4' };
      if (layer === 'site')        return { color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: 0.16 };
      return {};
    },
    pointToLayer: (f, latlng) => {
      const p = f.properties;
      const best = p.is_best_direct || p.is_best_via;
      return L.circleMarker(latlng, {
        radius: aadfRadius(p.aadf_all_motor_vehicles),
        color: best ? '#065f46' : '#10b981',
        weight: best ? 3 : 1,
        fillColor: '#10b981',
        fillOpacity: 0.75,
      });
    },
    onEachFeature: (f, lyr) => {
      lyr.on('click', () => show(f.properties));
      const p = f.properties;
      if (p.layer === 'traffic') {
        lyr.bindTooltip((p.road_number || p.road_category || 'CP') + ' · AADF ' +
          (p.aadf_all_motor_vehicles==null?'—':Number(p.aadf_all_motor_vehicles).toLocaleString()) +
          ' · ' + (p.year||'') + ' · ' + (p.estimation_method||''));
      } else if (p.layer === 'link_direct' || p.layer === 'link_via') {
        lyr.bindTooltip(p.method + ' · AADF ' +
          (p.aadf_all_motor_vehicles==null?'—':Number(p.aadf_all_motor_vehicles).toLocaleString()) +
          ' · ' + p.site_to_count_m + 'm');
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

// Page the set-returning RPC: PostgREST caps a single response at ~1,000 rows (the M2 trap).
async function fetchAllCentroids(): Promise<Centroid[]> {
  const out: Centroid[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .rpc('universe_site_centroids', {
        p_site_source: siteSource,
        p_min_acres: minAcres,
        p_max_acres: maxAcres,
      })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as Centroid[]
    out.push(...page)
    if (page.length < PAGE) break
  }
  return out
}

// Ids of sites whose two methods pick DIFFERENT count points (for --only-divergent).
// Pages the query: PostgREST caps a single response at ~1,000 rows and there are more
// best-pick rows than that, so an unpaged pull would silently truncate (the M2/M3 trap).
async function fetchDivergentIds(): Promise<Set<string>> {
  const rows: Array<{ candidate_site_id: string; method: string; traffic_count_id: string }> = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('candidate_site_traffic')
      .select('candidate_site_id, method, traffic_count_id')
      .eq('is_best_for_method', true)
      .order('candidate_site_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as typeof rows
    rows.push(...page)
    if (page.length < PAGE) break
  }
  const best = new Map<string, { direct?: string; via?: string }>()
  for (const r of rows) {
    const e = best.get(r.candidate_site_id) ?? {}
    if (r.method === 'count_point_direct') e.direct = r.traffic_count_id
    else if (r.method === 'via_road') e.via = r.traffic_count_id
    best.set(r.candidate_site_id, e)
  }
  const out = new Set<string>()
  for (const [id, e] of best) if (e.direct && e.via && e.direct !== e.via) out.add(id)
  return out
}

async function main() {
  let centroids = await fetchAllCentroids()
  if (centroids.length === 0) {
    console.error('No sites in the universe — run associate:candidate-traffic first.')
    process.exit(1)
  }
  if (onlyDivergent) {
    const div = await fetchDivergentIds()
    centroids = centroids.filter((c) => div.has(c.id))
    console.info(`Divergent sites (methods pick different count points): ${div.size.toLocaleString()}`)
    if (centroids.length === 0) {
      console.error('No divergent sites found — drop --only-divergent to sample the whole universe.')
      process.exit(1)
    }
  }
  console.info(`Universe: ${centroids.length.toLocaleString()} sites; sampling ${sampleSize} spread over a ${grid}×${grid} grid (seed ${seed}).`)

  const sample = geographicallyVariedSample(centroids, sampleSize)
  const ids = sample.map((s) => s.id)

  const { data: fc, error: mErr } = await supabase.rpc('debug_site_traffic_map', {
    p_site_ids: ids,
    p_radius_m: radiusM,
  })
  if (mErr) throw new Error(mErr.message)

  const html = htmlDocument(fc, {
    site_source: siteSource,
    sample: sample.length,
    radius_m: radiusM,
    seed,
    only_divergent: onlyDivergent,
    generated_at: new Date().toISOString(),
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html, 'utf8')
  const featureCount = (fc as { features?: unknown[] })?.features?.length ?? 0
  console.info(`\nWrote debug map: ${outPath}`)
  console.info(`  ${sample.length} sites, ${featureCount} features. Open it in a browser and inspect the associations.`)
  console.info('  Sampled sites:')
  for (const s of sample) {
    console.info(`    ${s.id.slice(0, 8)}  ${(s.area_acres != null ? `${Number(s.area_acres).toFixed(2)}ac` : '—').padStart(8)}  @ ${s.lat.toFixed(4)},${s.lon.toFixed(4)}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
