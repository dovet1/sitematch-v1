import { NextRequest, NextResponse } from 'next/server'
import { requirePlusAccess } from '@/lib/directory'
import { isBrandMatcherDemographicsEnabled, isBrandMatcherEnabled } from '@/lib/feature-flags'
import { brandStoreTowns } from '../engine'

export const dynamic = 'force-dynamic'

// One brand's best-matching stores for the Brand Matcher Demographics panel. Loaded when the
// panel opens; the read itself lives in ../engine (brandStoreTowns).

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

    return NextResponse.json(await brandStoreTowns(brandId, lat, lon))
  } catch (error) {
    console.error('Brand matcher towns failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
