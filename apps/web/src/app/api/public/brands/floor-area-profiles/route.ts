import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'
import { sqFtFromM2 } from '@/app/sitematcher-unified/lib/size-filter'

export const dynamic = 'force-dynamic'

// Observed floor-area distributions for a set of brands, for the Assess-Area
// size filter.
//
// Two things happen here rather than in the client, on purpose:
//
//   1. brand_floor_area_profiles is service_role-only (the EPC address fields
//      that fed it carry OS/Royal Mail restrictions, and a measured national
//      estate is the product). Reads reach users through this route, gated on
//      the same Plus subscription as the rest of the workspace — never by
//      querying the table from the browser.
//   2. The table stores m2. Conversion to sq ft happens once, here, so no
//      caller can ship a 10.76x error.
//
// The profiles themselves are already built from confidence='high' store
// matches only, so no further gate is applied to them.
//
// A second pass covers the brands the profiles table refuses to summarise. It
// requires five stores before it will compute quartiles — correctly, since
// quartiles over three points are noise — which leaves ~70 brands with nothing
// to show. For those the route returns the individual measured shops together
// with the size of the estate they came from, so the panel can show figures
// without ever drawing them as a distribution, and the reader can see how much
// of the estate they cover: three of three shops is a census, two of thirty is
// a corner. Only confidence='high' rows are eligible here too — the lower tiers
// were the wrong premises about half the time in assessment.

// A catchment's missing list can run to a few hundred brands. Above this the
// request is a mistake, not a use case.
const MAX_BRAND_IDS = 600
// PostgREST puts the `in` list in the URL, so it is chunked.
const CHUNK = 150

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ProfileRow {
  brand_id: string
  fascia_id: string | null
  min_m2: number
  p25_m2: number
  median_m2: number
  p75_m2: number
  max_m2: number
  sample_count: number
  coefficient_of_variation: number | null
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireGapFinderAccess()
    if (!access.authorized) return access.response

    const body = (await request.json().catch(() => null)) as {
      brandIds?: unknown
    } | null

    if (!body || !Array.isArray(body.brandIds)) {
      return NextResponse.json(
        { profiles: {}, measured: {}, error: 'brandIds must be an array' },
        { status: 400 }
      )
    }

    const brandIds = Array.from(
      new Set(
        body.brandIds.filter(
          (id): id is string => typeof id === 'string' && UUID.test(id)
        )
      )
    )

    if (brandIds.length === 0)
      return NextResponse.json({ profiles: {}, measured: {} })
    if (brandIds.length > MAX_BRAND_IDS) {
      return NextResponse.json(
        {
          profiles: {},
          measured: {},
          error: `At most ${MAX_BRAND_IDS} brand ids per request`,
        },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const rows: ProfileRow[] = []
    for (let i = 0; i < brandIds.length; i += CHUNK) {
      const { data, error } = await supabase
        .from('brand_floor_area_profiles')
        .select(
          'brand_id, fascia_id, min_m2, p25_m2, median_m2, p75_m2, max_m2, sample_count, coefficient_of_variation'
        )
        .in('brand_id', brandIds.slice(i, i + CHUNK))
      if (error) throw error
      rows.push(...((data ?? []) as unknown as ProfileRow[]))
    }

    // Fascia names come from a second lookup rather than an embedded join: the
    // profiles table has no FK metadata cached in PostgREST for a nullable
    // fascia_id, and multi-format brands are the only rows that need a name.
    const fasciaIds = Array.from(
      new Set(rows.map((r) => r.fascia_id).filter((id): id is string => id != null))
    )
    const fasciaNames = new Map<string, string>()
    for (let i = 0; i < fasciaIds.length; i += CHUNK) {
      const { data, error } = await supabase
        .from('fascias')
        .select('id, name')
        .in('id', fasciaIds.slice(i, i + CHUNK))
      if (error) throw error
      for (const f of (data ?? []) as unknown as { id: string; name: string }[]) {
        fasciaNames.set(f.id, f.name)
      }
    }

    const measured = await measuredEstates(
      supabase,
      brandIds.filter((id) => !rows.some((r) => r.brand_id === id))
    )

    const profiles: Record<string, unknown[]> = {}
    for (const r of rows) {
      const list = profiles[r.brand_id] ?? (profiles[r.brand_id] = [])
      list.push({
        brandId: r.brand_id,
        fasciaId: r.fascia_id,
        fasciaName: r.fascia_id ? (fasciaNames.get(r.fascia_id) ?? null) : null,
        minSqFt: sqFtFromM2(r.min_m2),
        p25SqFt: sqFtFromM2(r.p25_m2),
        medianSqFt: sqFtFromM2(r.median_m2),
        p75SqFt: sqFtFromM2(r.p75_m2),
        maxSqFt: sqFtFromM2(r.max_m2),
        sampleCount: r.sample_count,
        coefficientOfVariation: r.coefficient_of_variation,
      })
    }

    return NextResponse.json({ profiles, measured })
  } catch (error) {
    console.error('Floor-area profiles API error:', error)
    return NextResponse.json(
      {
        profiles: {},
        measured: {},
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// For brands with no distribution profile: how many shops they trade from, and
// the high-confidence measurements we hold. Both numbers travel together —
// a measurement without its denominator cannot be weighed, and the panel shows
// the fraction on every card that carries one.
//
// The store lookup is bounded by the uncovered brands only (~70 brands, a few
// hundred shops in current data), because a brand with a distribution never
// reaches here.
async function measuredEstates(
  supabase: ReturnType<typeof createAdminClient>,
  brandIds: string[]
): Promise<Record<string, { brandId: string; totalStores: number; measuredSqFt: number[] }>> {
  const out: Record<
    string,
    { brandId: string; totalStores: number; measuredSqFt: number[] }
  > = {}
  if (brandIds.length === 0) return out

  const stores: { id: string; brand_id: string }[] = []
  for (let i = 0; i < brandIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('stores')
      .select('id, brand_id')
      .in('brand_id', brandIds.slice(i, i + CHUNK))
    if (error) throw error
    stores.push(...((data ?? []) as unknown as { id: string; brand_id: string }[]))
  }

  const storesByBrand = new Map<string, string[]>()
  for (const s of stores) {
    const list = storesByBrand.get(s.brand_id)
    if (list) list.push(s.id)
    else storesByBrand.set(s.brand_id, [s.id])
  }

  const candidateStoreIds: string[] = []
  const brandOfStore = new Map<string, string>()
  for (const [brandId, ids] of Array.from(storesByBrand)) {
    for (const id of ids) {
      candidateStoreIds.push(id)
      brandOfStore.set(id, brandId)
    }
  }
  if (candidateStoreIds.length === 0) return out

  const areas: { store_id: string; floor_area_sqft: number | null }[] = []
  for (let i = 0; i < candidateStoreIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('store_floor_areas')
      .select('store_id, floor_area_sqft')
      .eq('confidence', 'high')
      .in('store_id', candidateStoreIds.slice(i, i + CHUNK))
    if (error) throw error
    areas.push(
      ...((data ?? []) as unknown as {
        store_id: string
        floor_area_sqft: number | null
      }[])
    )
  }

  for (const a of areas) {
    if (a.floor_area_sqft == null) continue
    const brandId = brandOfStore.get(a.store_id)
    if (!brandId) continue
    const entry =
      out[brandId] ??
      (out[brandId] = {
        brandId,
        totalStores: storesByBrand.get(brandId)?.length ?? 0,
        measuredSqFt: [],
      })
    entry.measuredSqFt.push(Number(a.floor_area_sqft))
  }

  for (const entry of Object.values(out)) {
    entry.measuredSqFt.sort((x, y) => x - y)
  }
  return out
}
