/**
 * M6 debug map: export a standalone, self-contained HTML (Leaflet + OSM tiles) that
 * plots a GEOGRAPHICALLY VARIED sample of candidate sites with their derived geometry —
 * the frontage road(s), the measured frontage SEGMENT, and the nearest junction/
 * roundabout node — so we can eyeball the M6 gate question:
 *   "is the frontage measured against the edge the parcel actually presents to the road,
 *    and is the nearest junction/roundabout the right one?"
 * Watch for: frontage picked up along a boundary that only clips the buffer, parcels
 * set back from the road (frontage `none`), and junctions across an intervening barrier.
 *
 * Sampling spreads sites across a grid over their extent (seeded, reproducible).
 * Geometry comes from the debug_site_geometry_map() RPC.
 *
 * Run from apps/web (after associate:candidate-geometry):
 *   npm run export:geometry-debug-map -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--max-acres <n>] \
 *     [--sample 25] [--grid 6] [--radius 250] [--frontage-buffer 12] [--seed 42] [--out <path.html>]
 *
 *   npm run export:geometry-debug-map -- --only-with-frontage   # bias the sample to measured-frontage sites
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
const radiusM = arg('radius') ? Number(arg('radius')) : 250
const frontageBufferM = arg('frontage-buffer') ? Number(arg('frontage-buffer')) : 12
const seed = arg('seed') ? Number(arg('seed')) : 42
const onlyWithFrontage = flag('only-with-frontage')
const outPath = arg('out')
  ? path.resolve(arg('out') as string)
  : path.resolve(process.cwd(), '../../artifacts/find-sites-m6/geometry-debug-map.html')

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
<title>Find Sites M6 — derived geometry debug map</title>
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
  <h1>M6 derived geometry</h1>
  <div id="meta" class="k"></div>
  <div class="legend" style="margin-top:10px">
    <div><span style="background:#16a34a;height:6px"></span> measured frontage segment</div>
    <div><span style="background:#e11d48"></span> frontage road (most frontage)</div>
    <div><span style="background:#f59e0b"></span> best classified road</div>
    <div><span style="background:#c4b5fd"></span> other associated road</div>
    <div><span style="background:#9ca3af"></span> context road (≤ radius)</div>
    <div><span class="swatch" style="display:inline-block;background:rgba(37,99,235,.25);border:1px solid #2563eb"></span> candidate site</div>
    <div><span class="swatch" style="display:inline-block;background:#7c3aed;border-radius:50%"></span> junction / roundabout node</div>
  </div>
  <p class="k" style="margin-top:10px">Click any road, site or node for its attributes. Check the green frontage segment runs along the edge the parcel presents to the road; check the nearest junction is the right one.</p>
  <div id="info"></div>
</div>
<script>
  const fc = ${fc};
  const meta = ${metaJson};
  document.getElementById('meta').innerHTML =
    'source <code>' + meta.site_source + '</code> · ' + meta.sample + ' sites · radius ' + meta.radius_m + 'm · buffer ' + meta.frontage_buffer_m + 'm · seed ' + meta.seed;

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

  function frontageRoadColor(rel) {
    if (rel === 'frontage') return '#e11d48';       // the road contributing the most frontage
    if (rel === 'classified') return '#f59e0b';     // best classified (A/B/Motorway) road
    return '#c4b5fd';                                // other associated road
  }
  function nodeColor(form) {
    return form === 'roundabout' ? '#db2777' : '#7c3aed';
  }

  L.geoJSON(fc, {
    style: f => {
      const layer = f.properties.layer;
      if (layer === 'context_road') return { color: '#9ca3af', weight: 2, opacity: 0.7 };
      if (layer === 'frontage_road') { const r = f.properties.relation; return { color: frontageRoadColor(r), weight: r === 'associated' ? 2 : 4, opacity: r === 'associated' ? 0.7 : 0.95 }; }
      if (layer === 'frontage') return { color: '#16a34a', weight: 6, opacity: 0.95 };
      if (layer === 'site') return { color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: 0.15 };
      return {};
    },
    pointToLayer: (f, latlng) => {
      const form = f.properties.form_of_road_node;
      const significant = form === 'junction' || form === 'roundabout';
      return L.circleMarker(latlng, {
        radius: significant ? 4 : 2,
        color: significant ? nodeColor(form) : '#111',
        fillColor: significant ? nodeColor(form) : '#fff',
        fillOpacity: significant ? 0.9 : 0.5, weight: 1, opacity: significant ? 0.95 : 0.4,
      });
    },
    onEachFeature: (f, lyr) => {
      lyr.on('click', () => show(f.properties));
      if (f.properties.layer === 'frontage') lyr.bindTooltip('frontage ~' + f.properties.frontage_m + 'm');
      if (f.properties.layer === 'frontage_road') lyr.bindTooltip((f.properties.road_number || f.properties.road_classification || 'road') + ' · ~' + f.properties.frontage_m + 'm');
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

// Page universe_site_centroids (PostgREST caps a single response at ~1,000 rows — the M2 trap).
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

// Optionally restrict the id pool to sites that actually have a measured frontage.
async function fetchFrontageSiteIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('candidate_site_geometry')
      .select('candidate_site_id, frontage_m')
      .gt('frontage_m', 1)
      .order('candidate_site_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) ids.add(r.candidate_site_id as string)
    if (page.length < PAGE) break
  }
  return ids
}

async function main() {
  let centroids = await fetchAllCentroids()
  if (centroids.length === 0) {
    console.error('No sites in the universe — run associate:candidate-geometry first.')
    process.exit(1)
  }
  if (onlyWithFrontage) {
    const keep = await fetchFrontageSiteIds()
    centroids = centroids.filter((c) => keep.has(c.id))
    console.info(`--only-with-frontage: ${centroids.length.toLocaleString()} sites with a measured frontage > 1 m.`)
  }
  console.info(`Universe: ${centroids.length.toLocaleString()} sites; sampling ${sampleSize} spread over a ${grid}×${grid} grid (seed ${seed}).`)

  const sample = geographicallyVariedSample(centroids, sampleSize)
  const ids = sample.map((s) => s.id)

  const { data: fc, error: mErr } = await supabase.rpc('debug_site_geometry_map', {
    p_site_ids: ids,
    p_radius_m: radiusM,
    p_frontage_buffer_m: frontageBufferM,
  })
  if (mErr) throw new Error(mErr.message)

  const html = htmlDocument(fc, {
    site_source: siteSource,
    sample: sample.length,
    radius_m: radiusM,
    frontage_buffer_m: frontageBufferM,
    seed,
    generated_at: new Date().toISOString(),
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html, 'utf8')
  const featureCount = (fc as { features?: unknown[] })?.features?.length ?? 0
  console.info(`\nWrote debug map: ${outPath}`)
  console.info(`  ${sample.length} sites, ${featureCount} features. Open it in a browser and inspect the frontage segments + junctions.`)
  console.info('  Sampled site references:')
  for (const s of sample) {
    console.info(`    ${s.id.slice(0, 8)}  ${(s.area_acres != null ? `${Number(s.area_acres).toFixed(2)}ac` : '—').padStart(8)}  @ ${s.lat.toFixed(4)},${s.lon.toFixed(4)}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
