/**
 * M9 results debug map: a standalone, self-contained HTML (Leaflet + OSM tiles) plotting
 * the top-N ranked candidate parcels from a find-sites-search run, coloured by match label
 * (strong / potential / weak), with their associated + context roads, and the KNOWN-SITE
 * recall points (existing brand stores) overlaid so we can eyeball:
 *   - do the top picks sit where a human would expect a roadside drive-thru plot?
 *   - did the pipeline's shortlist land near the real drive-thrus we already know?
 *
 * Reads the results.json written by find-sites-search (shortlist ids + scores + recall),
 * then fetches parcel/road geometry via the M3 debug_site_road_map() RPC (chunked). No
 * new SQL. Screening visualisation only — never a suitability/access claim.
 *
 * Run from apps/web (after npm run find-sites-search):
 *   npm run export:find-sites-results-map -- [--in <dir>] [--radius 250] [--out <path.html>]
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

const inDir = arg('in')
  ? path.resolve(arg('in') as string)
  : path.resolve(process.cwd(), '../../artifacts/find-sites-m9')
const radiusM = arg('radius') ? Number(arg('radius')) : 250
const outPath = arg('out') ? path.resolve(arg('out') as string) : path.join(inDir, 'results-map.html')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface Feature { type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }
interface FC { type: 'FeatureCollection'; features: Feature[] }

// debug_site_road_map returns parcel polygons + roads + nodes; a huge multi-site response
// can fail the fetch (the M8 lesson), so chunk the ids small and merge.
async function fetchGeometry(ids: string[]): Promise<FC> {
  const merged: Feature[] = []
  const CHUNK = 20
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase.rpc('debug_site_road_map', {
      p_site_ids: ids.slice(i, i + CHUNK),
      p_radius_m: radiusM,
    })
    if (error) throw new Error(error.message)
    const fc = data as FC
    if (fc?.features) merged.push(...fc.features)
  }
  return { type: 'FeatureCollection', features: merged }
}

function htmlDocument(fc: FC, meta: Record<string, unknown>): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Find Sites M9 — top-${meta.top} results</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin: 0; height: 100%; font: 13px/1.4 system-ui, sans-serif; }
  #map { position: absolute; inset: 0 320px 0 0; }
  #panel { position: absolute; top: 0; right: 0; bottom: 0; width: 320px; overflow: auto;
    padding: 12px 14px; background: #fafafa; border-left: 1px solid #ddd; box-sizing: border-box; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  .k { color: #666; }
  .swatch { width: 12px; height: 12px; border-radius: 2px; display:inline-block; margin-right:6px; }
  ul { padding-left: 16px; margin: 6px 0; }
  code { background: #eee; padding: 0 3px; border-radius: 3px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel">
  <h1>M9 results — top ${meta.top}</h1>
  <div id="meta" class="k"></div>
  <div style="margin-top:10px">
    <div><span class="swatch" style="background:#16a34a"></span> Strong parcel signal</div>
    <div><span class="swatch" style="background:#eab308"></span> Potential</div>
    <div><span class="swatch" style="background:#f97316"></span> Worth reviewing</div>
    <div><span class="swatch" style="background:#2563eb"></span> associated road</div>
    <div><span class="swatch" style="background:#d1d5db"></span> context road</div>
    <div><span class="swatch" style="background:#dc2626;border-radius:50%"></span> known store (recall) — ★ in shortlist</div>
  </div>
  <p class="k" style="margin-top:10px">Click a parcel for its tier + passed/partial/failed/unknown evidence. Oversized titles (larger than the requested footprint) are retained and labelled, not dropped. Screening only — a registered title is an indicative freehold extent, never an exact plot; availability/access/planning/viability stay unknown.</p>
  <div id="info"></div>
</div>
<script>
  const fc = ${JSON.stringify(fc)};
  const meta = ${JSON.stringify(meta)};
  const RANK = meta.rankById || {};       // siteId -> {rank, score, label, name}
  const KNOWN = meta.known || [];          // recall points
  document.getElementById('meta').innerHTML =
    'brand <code>' + (meta.brand_name || 'none') + '</code> · ' + meta.top + ' parcels · radius ' + meta.radius + 'm';

  const labelColor = { strong:'#16a34a', potential:'#eab308', review:'#f97316', unlikely:'#9ca3af' };

  const map = L.map('map').setView([51.28, 1.08], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);

  const info = document.getElementById('info');
  function show(props) {
    info.innerHTML = '<h1 style="font-size:13px;margin:10px 0 4px">Selected</h1><ul>' +
      Object.entries(props).map(([k,v]) => '<li><span class="k">'+k+'</span>: '+ (v===null||v===undefined?'—':v) +'</li>').join('') + '</ul>';
  }

  L.geoJSON(fc, {
    style: f => {
      const layer = f.properties.layer;
      if (layer === 'site') {
        const r = RANK[f.properties.id] || {};
        const c = labelColor[r.tier] || '#9ca3af';
        return { color: c, weight: 2, fillColor: c, fillOpacity: 0.4 };
      }
      if (layer === 'association') return { color: '#2563eb', weight: 3, opacity: 0.85 };
      if (layer === 'context_road') return { color: '#d1d5db', weight: 1.5, opacity: 0.7 };
      return {};
    },
    pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 2, color: '#6b7280', fillColor:'#6b7280', fillOpacity:0.6, weight:1 }),
    onEachFeature: (f, lyr) => {
      if (f.properties.layer === 'site') {
        const r = RANK[f.properties.id] || {};
        lyr.on('click', () => show({ rank: r.rank, tier: r.tierLabel, signal: r.signal, oversized: r.oversized ? 'yes' : null, name: r.name, ...f.properties }));
        lyr.bindTooltip('#' + (r.rank ?? '?') + ' · ' + (r.tierLabel ?? '') + (r.oversized ? ' · oversized' : ''));
      } else {
        lyr.on('click', () => show(f.properties));
      }
    }
  }).addTo(map);

  // Known-site recall points.
  const knownLayer = L.geoJSON({ type:'FeatureCollection', features: KNOWN.filter(k => k.lon!=null && k.lat!=null).map(k => ({
    type:'Feature', geometry:{ type:'Point', coordinates:[k.lon, k.lat] },
    properties:{ layer:'known', label:k.label, rank:k.rank, inTopN:k.inTopN, inUniverse:k.inUniverse, score:k.score, mapped: k.siteId? (k.contained?'in parcel':('~'+Math.round(k.distanceM||0)+'m')):'universe miss' }
  })) }, {
    pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: f.properties.inTopN?8:6, color:'#7f1d1d', fillColor:'#dc2626', fillOpacity:0.9, weight: f.properties.inTopN?3:1 }),
    onEachFeature: (f, lyr) => { lyr.on('click', () => show(f.properties)); lyr.bindTooltip((f.properties.inTopN?'★ ':'') + f.properties.label + ' · ' + f.properties.mapped); }
  }).addTo(map);

  const sites = L.geoJSON({ type:'FeatureCollection', features: fc.features.filter(f => f.properties.layer === 'site') });
  const b = sites.getBounds();
  let tries = 0;
  function fit() {
    map.invalidateSize();
    if (map.getSize().x > 0 && b.isValid()) { map.fitBounds(b.pad(0.15)); return; }
    if (tries++ < 40) setTimeout(fit, 100);
  }
  window.addEventListener('load', fit);
  fit();
</script>
</body>
</html>`
}

async function main() {
  const resultsPath = path.join(inDir, 'results.json')
  if (!fs.existsSync(resultsPath)) {
    console.error(`No results.json at ${resultsPath} — run npm run find-sites-search first.`)
    process.exit(1)
  }
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as {
    brand: { name: string } | null
    params: { topN: number }
    recall: { outcomes: Record<string, unknown>[] } | null
    shortlist: { rank: number; siteId: string; tier: string; tierLabel: string; signal: number; oversized: boolean; name: string | null }[]
  }

  const shortlist = results.shortlist ?? []
  if (shortlist.length === 0) {
    console.error('Shortlist is empty (no eligible sites) — nothing to map.')
    process.exit(1)
  }
  const ids = shortlist.map((s) => s.siteId)
  console.info(`Fetching geometry for ${ids.length} shortlisted parcels (radius ${radiusM}m)…`)
  const fc = await fetchGeometry(ids)

  const rankById: Record<string, unknown> = {}
  for (const s of shortlist) rankById[s.siteId] = { rank: s.rank, tier: s.tier, tierLabel: s.tierLabel, signal: s.signal, oversized: s.oversized, name: s.name }

  const html = htmlDocument(fc, {
    brand_name: results.brand?.name ?? null,
    top: shortlist.length,
    radius: radiusM,
    rankById,
    known: results.recall?.outcomes ?? [],
    generated_at: new Date().toISOString(),
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html, 'utf8')
  console.info(`\nWrote results map: ${outPath}`)
  console.info(`  ${shortlist.length} parcels, ${fc.features.length} features, ${(results.recall?.outcomes ?? []).length} known-store points.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
