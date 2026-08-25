/**
 * M5: mirror the SiteMatcher estate INSIDE the Canterbury bbox into land_use_features as
 * point evidence, so the existing stores contribute to land-use fusion without any file
 * export. Each store becomes a point feature (broad class 'retail', medium confidence — a
 * store is firm evidence of ACTIVE COMMERCIAL OCCUPATION; refining to the store's own brand
 * category, food vs shop vs services, is deferred, see the M5 findings). Idempotent per store.
 *
 * Scoped to the SAME bbox as the rest of the pipeline (HMLR polygons / OS roads / DfT AADF)
 * via the existing get_stores_in_bbox() RPC — the national estate is far too large to sync
 * wholesale (it times out) and only Canterbury stores are relevant to the candidate sites.
 *
 * Run from apps/web (after applying 20260728000000_create_land_use_features.sql):
 *   npm run sync:store-land-use -- [--bbox 1.00,51.22,1.20,51.32]
 *
 * Then: npm run associate:candidate-land-use
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const bbox = (arg('bbox') ?? '1.00,51.22,1.20,51.32').split(',').map(Number)
if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
  console.error('--bbox must be minLon,minLat,maxLon,maxLat')
  process.exit(1)
}
const [minLon, minLat, maxLon, maxLat] = bbox

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface StoreRow {
  id: string
  store_id: string | null
  name: string | null
  lon: number | null
  lat: number | null
  brand_id: string | null
  fascia_id: string | null
  town: string | null
  postcode: string | null
}

async function main() {
  console.info(`Fetching stores in bbox ${minLon},${minLat},${maxLon},${maxLat} …`)
  const { data, error } = await supabase.rpc('get_stores_in_bbox', {
    p_min_lon: minLon,
    p_min_lat: minLat,
    p_max_lon: maxLon,
    p_max_lat: maxLat,
  })
  if (error) throw new Error(error.message)
  const stores = (data ?? []) as StoreRow[]
  console.info(`  ${stores.length.toLocaleString()} stores in the Canterbury bbox.`)
  if (stores.length === 0) {
    console.info('No stores to sync.')
    return
  }
  if (stores.length >= 5001) {
    console.warn('  WARNING: hit the get_stores_in_bbox LIMIT (5001) — the bbox may be too large; some stores omitted.')
  }

  // Store presence = active commercial occupation → broad class 'retail', medium confidence.
  const features = stores
    .filter((s) => s.lon != null && s.lat != null)
    .map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lon as number, s.lat as number] },
      properties: {
        normalised_class: 'retail',
        class_confidence: 'medium',
        name: s.name,
        source_reference: s.id,
        source_tags: {
          store_id: s.store_id,
          brand_id: s.brand_id,
          fascia_id: s.fascia_id,
          town: s.town,
          postcode: s.postcode,
          note: 'store presence = active commercial occupation; brand-category refinement deferred',
        },
      },
    }))

  const BATCH = 500
  let imported = 0
  for (let i = 0; i < features.length; i += BATCH) {
    const { data: n, error: iErr } = await supabase.rpc('import_land_use_features', {
      p_features: features.slice(i, i + BATCH),
      p_source: 'sitematcher_stores',
      p_provenance: {
        dataset: 'SiteMatcher stores',
        imported_at: new Date().toISOString(),
        licence: 'internal',
        bbox: [minLon, minLat, maxLon, maxLat],
      },
      p_source_srid: 4326,
    })
    if (iErr) throw new Error(iErr.message)
    imported += typeof n === 'number' ? n : 0
  }

  console.info(`Synced ${imported.toLocaleString()} stores into land_use_features (source=sitematcher_stores).`)
  console.info('Next: npm run associate:candidate-land-use')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
