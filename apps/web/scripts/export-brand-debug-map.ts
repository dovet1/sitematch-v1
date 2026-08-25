/**
 * M7 debug map: export a standalone, self-contained HTML (Leaflet + OSM tiles) that
 * plots a GEOGRAPHICALLY VARIED sample of candidate sites, each joined by a line to its
 * nearest same-brand (parent-group) store, with the surrounding same-brand estate — so
 * we can eyeball the M7 gate question:
 *   "is the 'nearest existing store' the one a human would pick, and does the distance
 *    look right?"
 * Sites are coloured by same-brand-distance band (at / near / moderate / clear).
 *
 * Same-brand distance is SEARCH-TIME and per-brand, so a --brand is required. Sampling
 * spreads sites across a grid over their extent (seeded, reproducible). Geometry comes
 * from the debug_site_brand_map() RPC.
 *
 * Run from apps/web (after applying 20260732000000_same_brand_distance.sql):
 *   npm run export:brand-debug-map -- --brand <uuid> [--fascia <uuid,uuid>] \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--max-acres <n>] \
 *     [--sample 25] [--grid 6] [--context-km 10] [--seed 42] [--out <path.html>]
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
const contextKm = arg('context-km') ? Number(arg('context-km')) : 10
const seed = arg('seed') ? Number(arg('seed')) : 42
const brandId = arg('brand')
const fasciaIds = arg('fascia') ? (arg('fascia') as string).split(',').map((s) => s.trim()) : null
const outPath = arg('out')
  ? path.resolve(arg('out') as string)
  : path.resolve(process.cwd(), '../../artifacts/find-sites-m7/brand-debug-map.html')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
if (!brandId) {
  console.error('--brand <uuid> is required (same-brand distance is per-brand). Use inspect:candidate-brand --list-brands to pick one.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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

function geographicallyVariedSample(rows: Centroid[], nn: number): Centroid[] {
  if (rows.length <= nn) return rows
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
  while (picked.length < nn && buckets.some((b) => b.length)) {
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
<title>Find Sites M7 — same-brand distance debug map</title>
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
  .swatch { width: 12px; height: 12px; border-radius: 2px; display:inline-block; }
  ul { padding-left: 16px; margin: 6px 0; }
  code { background: #eee; padding: 0 3px; border-radius: 3px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>M7 same-brand distance</h1>
  <div id="meta" class="k"></div>
  <div class="legend" style="margin-top:10px">
    <div><span class="swatch" style="background:#dc2626"></span> site — at (≤0.25 mi)</div>
    <div><span class="swatch" style="background:#f59e0b"></span> site — near (≤1 mi)</div>
    <div><span class="swatch" style="background:#eab308"></span> site — moderate (≤3 mi)</div>
    <div><span class="swatch" style="background:#16a34a"></span> site — clear (>3 mi)</div>
    <div><span style="background:#6b7280"></span> line to nearest same-brand store</div>
    <div><span class="swatch" style="background:#111;border-radius:50%"></span> nearest same-brand store</div>
    <div><span class="swatch" style="background:#2563eb;border-radius:50%;opacity:.5"></span> other same-brand store (context)</div>
  </div>
  <p class="k" style="margin-top:10px">Click any site, store or line for its attributes. Check the line runs to the store a human would call nearest, and the distance looks right. Distance colouring is a screening band, never a suitability claim.</p>
  <div id="info"></div>
</div>
<script>
  const fc = ${fc};
  const meta = ${metaJson};
  document.getElementById('meta').innerHTML =
    'brand <code>' + (meta.brand_name || meta.brand_id) + '</code> · ' + meta.sample + ' sites · context ' + meta.context_km + 'km · seed ' + meta.seed;

  const MILE = 1609.344;
  function siteColor(d) {
    if (d === null || d === undefined) return '#9ca3af';
    if (d <= 400) return '#dc2626';
    if (d <= MILE) return '#f59e0b';
    if (d <= 3 * MILE) return '#eab308';
    return '#16a34a';
  }

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

  L.geoJSON(fc, {
    style: f => {
      const layer = f.properties.layer;
      if (layer === 'nearest_link') return { color: '#6b7280', weight: 2, opacity: 0.8, dashArray: '4 3' };
      if (layer === 'site') return { color: siteColor(f.properties.distance_m), weight: 2, fillColor: siteColor(f.properties.distance_m), fillOpacity: 0.35 };
      return {};
    },
    pointToLayer: (f, latlng) => {
      const layer = f.properties.layer;
      if (layer === 'nearest_store') return L.circleMarker(latlng, { radius: 5, color: '#111', fillColor: '#111', fillOpacity: 0.9, weight: 1 });
      if (layer === 'estate_store') return L.circleMarker(latlng, { radius: 3, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.5, weight: 1, opacity: 0.6 });
      return L.circleMarker(latlng, { radius: 2, color: '#111' });
    },
    onEachFeature: (f, lyr) => {
      lyr.on('click', () => show(f.properties));
      if (f.properties.layer === 'nearest_link') lyr.bindTooltip('~' + (f.properties.distance_m/1609.344).toFixed(2) + ' mi');
      if (f.properties.layer === 'nearest_store') lyr.bindTooltip((f.properties.name || f.properties.store || 'store') + ' · ' + (f.properties.town || ''));
      if (f.properties.layer === 'site') lyr.bindTooltip('site ' + (f.properties.source_reference || '') + ' · ' + (f.properties.distance_m===null?'no store':(f.properties.distance_m/1609.344).toFixed(2)+' mi'));
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

// universe_site_centroids recomputes ALL centroids per call and PostgREST caps each
// response at ~1,000 rows, so an offset walk over the whole universe both re-does the
// work 9× and can blow the statement timeout. For a 25-site EYEBALL sample we only need
// a pool to grid-sample from — one page (≈1,000 sites, UUID-ordered so spatially spread
// across Canterbury) is ample. Bump --sample-pool only if you need a wider draw.
async function fetchCentroidPool(): Promise<Centroid[]> {
  const pool = arg('sample-pool') ? Number(arg('sample-pool')) : 1000
  const { data, error } = await supabase
    .rpc('universe_site_centroids', {
      p_site_source: siteSource,
      p_min_acres: minAcres,
      p_max_acres: maxAcres,
    })
    .range(0, pool - 1)
  if (error) throw new Error(error.message)
  return (data ?? []) as Centroid[]
}

async function brandName(): Promise<string | null> {
  const { data } = await supabase.from('brands').select('name').eq('id', brandId).maybeSingle()
  return (data?.name as string) ?? null
}

async function main() {
  const centroids = await fetchCentroidPool()
  if (centroids.length === 0) {
    console.error('No sites in the universe — import candidate_sites first.')
    process.exit(1)
  }
  console.info(`Centroid pool: ${centroids.length.toLocaleString()} sites; sampling ${sampleSize} spread over a ${grid}×${grid} grid (seed ${seed}).`)

  const sample = geographicallyVariedSample(centroids, sampleSize)
  const ids = sample.map((s) => s.id)

  const { data: fc, error: mErr } = await supabase.rpc('debug_site_brand_map', {
    p_site_ids: ids,
    p_brand_id: brandId,
    p_fascia_ids: fasciaIds,
    p_context_km: contextKm,
  })
  if (mErr) throw new Error(mErr.message)

  const html = htmlDocument(fc, {
    brand_id: brandId,
    brand_name: await brandName(),
    sample: sample.length,
    context_km: contextKm,
    seed,
    generated_at: new Date().toISOString(),
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html, 'utf8')
  const featureCount = (fc as { features?: unknown[] })?.features?.length ?? 0
  console.info(`\nWrote debug map: ${outPath}`)
  console.info(`  ${sample.length} sites, ${featureCount} features. Open it in a browser and check the nearest-store lines + distances.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
