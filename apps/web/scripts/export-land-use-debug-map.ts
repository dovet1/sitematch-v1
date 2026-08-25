/**
 * M5 debug map: export a standalone, self-contained HTML (Leaflet + OSM tiles) that plots
 * a GEOGRAPHICALLY VARIED sample of candidate sites with their FUSED land-use class and
 * the land-use evidence + surrounding context that produced it, so we can eyeball the M5
 * gate question:
 *   "does the classification reflect what is visibly on the ground — and where it is
 *    `unknown`, is that a genuine gap or a missed signal?"
 * Each site polygon is filled by its fused class colour (grey hatch = unknown); associated
 * land-use features (the evidence) are outlined and clickable; faint context land-use
 * polygons within a radius show the surroundings.
 *
 * Sampling spreads sites across a grid over their extent (seeded), same as M3/M4.
 * Geometry comes from the debug_site_land_use_map() RPC.
 *
 * Run from apps/web (after associate:candidate-land-use):
 *   npm run export:land-use-debug-map -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--max-acres <n>] \
 *     [--sample 25] [--grid 6] [--radius 150] [--seed 42] \
 *     [--only-unknown] [--only-classified] [--out <path.html>]
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
const radiusM = arg('radius') ? Number(arg('radius')) : 150
const seed = arg('seed') ? Number(arg('seed')) : 42
const onlyUnknown = hasFlag('only-unknown')
const onlyClassified = hasFlag('only-classified')
const outPath = arg('out')
  ? path.resolve(arg('out') as string)
  : path.resolve(process.cwd(), '../../artifacts/find-sites-m5/land-use-debug-map.html')

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

interface Centroid { id: string; lon: number; lat: number; area_acres: number | null; current_land_use?: string | null }

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
<title>Find Sites M5 — land-use fusion debug map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin: 0; height: 100%; font: 13px/1.4 system-ui, sans-serif; }
  #map { position: absolute; inset: 0 320px 0 0; }
  #panel { position: absolute; top: 0; right: 0; bottom: 0; width: 320px; overflow: auto;
    padding: 12px 14px; background: #fafafa; border-left: 1px solid #ddd; box-sizing: border-box; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  .k { color: #666; }
  .legend .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
  ul { padding-left: 16px; margin: 6px 0; }
  code { background: #eee; padding: 0 3px; border-radius: 3px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>M5 land-use fusion</h1>
  <div id="meta" class="k"></div>
  <div class="legend" id="legend" style="margin-top:10px"></div>
  <p class="k" style="margin-top:10px">Site polygons are filled by their FUSED class (hatched grey = unknown). Click a site, an evidence feature, or a context polygon for details. Ask: does the class match what is on the ground? Is each unknown a genuine gap?</p>
  <div id="info"></div>
</div>
<script>
  const fc = ${fc};
  const meta = ${metaJson};
  document.getElementById('meta').innerHTML =
    'source <code>' + meta.site_source + '</code> · ' + meta.sample + ' sites · radius ' + meta.radius_m + 'm · seed ' + meta.seed;

  // Broad-class colour ramp (categorical, brand-neutral).
  const CLASS_COLORS = {
    residential:'#f59e0b', retail:'#e11d48', food_drink:'#db2777', pub_bar:'#be123c',
    fuel:'#ea580c', parking:'#a3a3a3', commercial:'#2563eb', industrial:'#7c3aed',
    storage_distribution:'#6d28d9', community:'#0891b2', leisure_recreation:'#16a34a',
    agricultural:'#a16207', natural:'#15803d', transport:'#334155', utility:'#57534e',
    vacant_or_brownfield:'#0d9488', construction:'#c2410c', mixed:'#9333ea'
  };
  function classColor(c) { return CLASS_COLORS[c] || '#9ca3af'; }

  const legend = document.getElementById('legend');
  legend.innerHTML =
    Object.entries(CLASS_COLORS).map(([k,v]) => '<div><span class="swatch" style="background:'+v+'"></span>'+k+'</div>').join('') +
    '<div><span class="swatch" style="background:repeating-linear-gradient(45deg,#ddd,#ddd 3px,#fff 3px,#fff 6px);border:1px solid #999"></span>unknown</div>' +
    '<div style="margin-top:4px"><span class="swatch" style="background:none;border:2px solid #111"></span>evidence feature</div>';

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

  L.geoJSON(fc, {
    style: f => {
      const layer = f.properties.layer;
      if (layer === 'site') {
        const c = f.properties.current_land_use;
        if (!c) return { color:'#666', weight:2, fillColor:'#bbb', fillOpacity:0.28, dashArray:'4 3' };
        return { color: classColor(c), weight: 2, fillColor: classColor(c), fillOpacity: 0.45 };
      }
      if (layer === 'assoc_land_use') return { color:'#111', weight:2, fillColor: classColor(f.properties.normalised_class), fillOpacity:0.15 };
      if (layer === 'context_land_use') return { color: classColor(f.properties.normalised_class), weight:1, opacity:0.5, fillColor: classColor(f.properties.normalised_class), fillOpacity:0.08 };
      return {};
    },
    pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 4, color:'#111', fillColor: classColor(f.properties.normalised_class), fillOpacity: 0.9, weight: 1 }),
    onEachFeature: (f, lyr) => {
      lyr.on('click', () => show(f.properties));
      if (f.properties.layer === 'site') lyr.bindTooltip('site: ' + (f.properties.current_land_use || 'unknown') + (f.properties.land_use_confidence ? ' ('+f.properties.land_use_confidence+')' : ''));
      else if (f.properties.layer === 'assoc_land_use') lyr.bindTooltip(f.properties.normalised_class + ' · ' + f.properties.relation + (f.properties.source ? ' · '+f.properties.source : ''));
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

// Page the centroids RPC (M2/M3 trap: PostgREST caps a single response at ~1,000 rows).
async function fetchAllCentroids(): Promise<Centroid[]> {
  const out: Centroid[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .rpc('universe_site_centroids', { p_site_source: siteSource, p_min_acres: minAcres, p_max_acres: maxAcres })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as Centroid[]
    out.push(...page)
    if (page.length < PAGE) break
  }
  return out
}

// When biasing to unknown/classified sites, fetch just the matching id SET server-side
// (filtered by current_land_use null-ness) — paged, no giant IN() list in the URL.
async function fetchIdsByClassification(wantUnknown: boolean): Promise<Set<string>> {
  const ids = new Set<string>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('candidate_sites')
      .select('id')
      .eq('source', siteSource)
      .gte('area_acres', minAcres)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    q = wantUnknown ? q.is('current_land_use', null) : q.not('current_land_use', 'is', null)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = data ?? []
    for (const r of rows) ids.add(r.id as string)
    if (rows.length < PAGE) break
  }
  return ids
}

async function main() {
  let centroids = await fetchAllCentroids()
  if (centroids.length === 0) {
    console.error('No sites in the universe — run associate:candidate-land-use first.')
    process.exit(1)
  }

  if (onlyUnknown || onlyClassified) {
    const idSet = await fetchIdsByClassification(onlyUnknown)
    centroids = centroids.filter((c) => idSet.has(c.id))
    console.info(`Filtered to ${onlyUnknown ? 'unknown' : 'classified'} sites: ${centroids.length.toLocaleString()}.`)
    if (centroids.length === 0) { console.error('No sites after filter.'); process.exit(1) }
  }

  console.info(`Universe: ${centroids.length.toLocaleString()} sites; sampling ${sampleSize} spread over a ${grid}×${grid} grid (seed ${seed}).`)
  const sample = geographicallyVariedSample(centroids, sampleSize)
  const ids = sample.map((s) => s.id)

  const { data: fc, error: mErr } = await supabase.rpc('debug_site_land_use_map', { p_site_ids: ids, p_radius_m: radiusM })
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
  console.info(`  ${sample.length} sites, ${featureCount} features. Open it in a browser and inspect the classifications.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
