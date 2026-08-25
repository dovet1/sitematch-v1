/**
 * M3 debug map: export a standalone, self-contained HTML (Leaflet + OSM tiles) that
 * plots a GEOGRAPHICALLY VARIED sample of candidate sites with their road associations
 * and the surrounding road network, so we can eyeball the M3 gate question:
 *   "is the SELECTED road the one the site actually relates to?"
 * Look for systematic errors: parallel roads, dual carriageways, roundabouts, shared
 * road numbers, large polygons touching several roads.
 *
 * Sampling spreads sites across a grid over their extent (not a clustered random draw),
 * seeded for reproducibility. Geometry comes from the debug_site_road_map() RPC.
 *
 * Run from apps/web (after associate:candidate-roads):
 *   npm run export:road-debug-map -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--max-acres <n>] \
 *     [--sample 25] [--grid 6] [--radius 250] [--seed 42] [--out <path.html>]
 *
 * Open the printed file in a browser and click roads/sites for their attributes.
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

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const maxAcres = arg('max-acres') ? Number(arg('max-acres')) : null
const sampleSize = arg('sample') ? Number(arg('sample')) : 25
const grid = arg('grid') ? Number(arg('grid')) : 6
const radiusM = arg('radius') ? Number(arg('radius')) : 250
const seed = arg('seed') ? Number(arg('seed')) : 42
const outPath = arg('out')
  ? path.resolve(arg('out') as string)
  : path.resolve(process.cwd(), '../../artifacts/find-sites-m3/road-debug-map.html')

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

/** Spread the sample across a grid over the sites' extent: bucket by cell, then
 *  round-robin over non-empty cells picking a random site from each until we have N. */
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
  // Shuffle each cell's contents deterministically.
  const buckets = Array.from(cells.values())
  for (const b of buckets) b.sort(() => rand() - 0.5)
  // Shuffle cell order so round-robin doesn't bias to a corner.
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
  // Self-contained: Leaflet from CDN + OSM tiles. This is a LOCAL debug file opened in
  // a browser, not a published artifact, so external tiles/scripts are fine.
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Find Sites M3 — road association debug map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin: 0; height: 100%; font: 13px/1.4 system-ui, sans-serif; }
  #map { position: absolute; inset: 0 320px 0 0; }
  #panel { position: absolute; top: 0; right: 0; bottom: 0; width: 320px; overflow: auto;
    padding: 12px 14px; background: #fafafa; border-left: 1px solid #ddd; box-sizing: border-box; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  .k { color: #666; }
  .legend span { display: inline-block; width: 12px; height: 3px; vertical-align: middle; margin-right: 6px; }
  .swatch { width: 12px; height: 12px; border-radius: 2px; }
  ul { padding-left: 16px; margin: 6px 0; }
  code { background: #eee; padding: 0 3px; border-radius: 3px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>M3 road association</h1>
  <div id="meta" class="k"></div>
  <div class="legend" style="margin-top:10px">
    <div><span style="background:#e11d48"></span> nearest road (overall)</div>
    <div><span style="background:#f59e0b"></span> nearest A/B/Motorway</div>
    <div><span style="background:#9ca3af"></span> context road (≤ radius)</div>
    <div><span class="swatch" style="display:inline-block;background:rgba(37,99,235,.25);border:1px solid #2563eb"></span> candidate site</div>
    <div><span class="swatch" style="display:inline-block;background:#111;border-radius:50%"></span> road node</div>
  </div>
  <p class="k" style="margin-top:10px">Click any road or site for its attributes. Check the coloured (associated) road is the one the site actually relates to. Watch for parallel roads, dual carriageways, roundabouts, shared numbers.</p>
  <div id="info"></div>
</div>
<script>
  const fc = ${fc};
  const meta = ${metaJson};
  document.getElementById('meta').innerHTML =
    'source <code>' + meta.site_source + '</code> · ' + meta.sample + ' sites · radius ' + meta.radius_m + 'm · seed ' + meta.seed;

  const map = L.map('map').setView([51.28, 1.08], 11);
  window.fc = fc; window.map = map; // exposed for debugging
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const info = document.getElementById('info');
  function show(props) {
    info.innerHTML = '<h1 style="font-size:13px;margin:10px 0 4px">Selected</h1><ul>' +
      Object.entries(props).map(([k,v]) => '<li><span class="k">'+k+'</span>: '+ (v===null?'—':v) +'</li>').join('') + '</ul>';
  }

  function relColor(rel) {
    if (rel === 'nearest_overall') return '#e11d48';
    if (rel === 'nearest_primary_class') return '#f59e0b';
    return '#7c3aed';
  }

  const layers = { context_road: [], association: [], node: [], site: [] };
  L.geoJSON(fc, {
    filter: f => true,
    style: f => {
      const layer = f.properties.layer;
      if (layer === 'context_road') return { color: '#9ca3af', weight: 2, opacity: 0.8 };
      if (layer === 'association') return { color: relColor(f.properties.relation), weight: 4, opacity: 0.95 };
      if (layer === 'site') return { color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: 0.18 };
      return {};
    },
    pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 2.5, color: '#111', fillColor: '#fff', fillOpacity: 0.9, weight: 1, opacity: 0.7 }),
    onEachFeature: (f, lyr) => {
      lyr.on('click', () => show(f.properties));
      if (f.properties.layer === 'association') {
        lyr.bindTooltip((f.properties.road_number || f.properties.road_classification || 'road') + ' · ' + f.properties.distance_m + 'm');
      }
    }
  }).addTo(map);

  // Fit to the site polygons. fitBounds needs a non-zero container; in some embedded
  // browsers the container gets its size a little late, so retry until it does.
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

// Page the set-returning RPC: PostgREST caps a single response at ~1,000 rows, so a
// one-shot call would silently sample from only the first 1,000 sites (the M2 trap).
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

async function main() {
  const centroids = await fetchAllCentroids()
  if (centroids.length === 0) {
    console.error('No sites in the universe — run associate:candidate-roads first.')
    process.exit(1)
  }
  console.info(`Universe: ${centroids.length.toLocaleString()} sites; sampling ${sampleSize} spread over a ${grid}×${grid} grid (seed ${seed}).`)

  const sample = geographicallyVariedSample(centroids, sampleSize)
  const ids = sample.map((s) => s.id)

  const { data: fc, error: mErr } = await supabase.rpc('debug_site_road_map', {
    p_site_ids: ids,
    p_radius_m: radiusM,
  })
  if (mErr) throw new Error(mErr.message)

  const html = htmlDocument(fc, {
    site_source: siteSource,
    sample: sample.length,
    radius_m: radiusM,
    seed,
    generated_at: new Date().toISOString(),
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html, 'utf8')
  const featureCount = (fc as { features?: unknown[] })?.features?.length ?? 0
  console.info(`\nWrote debug map: ${outPath}`)
  console.info(`  ${sample.length} sites, ${featureCount} features. Open it in a browser and inspect the associations.`)
  console.info('  Sampled site references:')
  for (const s of sample) {
    console.info(`    ${s.id.slice(0, 8)}  ${(s.area_acres != null ? `${Number(s.area_acres).toFixed(2)}ac` : '—').padStart(8)}  @ ${s.lat.toFixed(4)},${s.lon.toFixed(4)}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
