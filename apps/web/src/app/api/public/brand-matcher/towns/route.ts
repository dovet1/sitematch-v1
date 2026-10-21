import { NextRequest, NextResponse } from 'next/server'
import { requirePlusAccess, directoryAdminClient } from '@/lib/directory'
import { isBrandMatcherDemographicsEnabled, isBrandMatcherEnabled } from '@/lib/feature-flags'
import { METERS_PER_MILE, sortStoreTowns, TOP_STORE_TOWNS, townBand } from '@/app/sitematcher-unified/lib/brand-matcher'
import type { BrandStoreTown, BrandStoreTownsResponse } from '@/app/sitematcher-unified/types/brand-matcher'

export const dynamic = 'force-dynamic'

// One brand's best-matching stores (top TOP_STORE_TOWNS) with their towns' population and
// affluence and how close each town is to the site's town, for the Brand Matcher Demographics
// panel. Loaded when the panel opens (migration 20261029000000).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    if (!(await isBrandMatcherEnabled()) || !(await isBrandMatcherDemographicsEnabled())) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const access = await requirePlusAccess()
    if (access.error) return access.error

    const params = request.nextUrl.searchParams
    const brandId = params.get('brandId') ?? ''
    const lat = Number(params.get('lat'))
    const lon = Number(params.get('lon'))
    if (!UUID.test(brandId) || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { data, error } = await directoryAdminClient().rpc('brand_matcher_brand_towns', {
      p_brand_id: brandId,
      p_lat: lat,
      p_lon: lon,
    })
    if (error) throw error

    const stores: BrandStoreTown[] = (
      (data ?? []) as {
        store_name: string | null
        store_town: string | null
        distance_m: number
        bua_gsscode: string | null
        bua_name: string | null
        population: number | null
        affluence: number | null
        gap: number | null
      }[]
    ).map((r) => ({
      name: r.store_name,
      town: r.store_town,
      miles: r.distance_m / METERS_PER_MILE,
      bua:
        r.bua_gsscode && r.bua_name && r.population != null && r.affluence != null
          ? { code: r.bua_gsscode, name: r.bua_name, population: Number(r.population), affluence: Number(r.affluence) }
          : null,
      band: townBand(r.gap),
      gap: r.gap,
    }))

    const payload: BrandStoreTownsResponse = {
      stores: sortStoreTowns(stores.filter((s) => s.bua)).slice(0, TOP_STORE_TOWNS),
      total: stores.length,
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Brand matcher towns failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
