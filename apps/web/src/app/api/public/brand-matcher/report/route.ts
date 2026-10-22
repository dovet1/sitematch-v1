import { NextRequest, NextResponse } from 'next/server'
import { requirePlusAccess } from '@/lib/directory'
import { isBrandMatcherDemographicsEnabled, isBrandMatcherEnabled } from '@/lib/feature-flags'
import { byFit, toReportBrand } from '@/app/sitematcher/lib/brand-report'
import { BRAND_REPORT_MAX, type BrandReportResponse } from '@/app/sitematcher/types/brand-matcher'
import { brandStoreTowns, matchSite, parseQuery } from '../engine'

export const dynamic = 'force-dynamic'

// The shareable brand report (docs/design_handoff_brand_report_export): the member's chosen
// brands for one site, re-matched here so the figures are current, with each brand's
// best-matching stores for Demographics. Contacts are stripped here, never in the view:
// toReportBrand copies a match field by field and has no contacts.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseBrandIds(raw: unknown): string[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return 'Choose at least one brand'
  const ids = Array.from(new Set(raw.filter((x): x is string => typeof x === 'string' && UUID.test(x))))
  if (ids.length !== raw.length) return 'Invalid brand id'
  if (ids.length > BRAND_REPORT_MAX) return `Reports hold up to ${BRAND_REPORT_MAX} brands`
  return ids
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isBrandMatcherEnabled())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const access = await requirePlusAccess()
    if (access.error) return access.error

    const body = (await request.json().catch(() => null)) as {
      query?: unknown
      brandIds?: unknown
    } | null
    const query = parseQuery(body?.query)
    if (typeof query === 'string') return NextResponse.json({ error: query }, { status: 400 })
    const brandIds = parseBrandIds(body?.brandIds)
    if (typeof brandIds === 'string') return NextResponse.json({ error: brandIds }, { status: 400 })

    const result = await matchSite(query)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    const { site } = result.payload
    const wanted = new Set(brandIds)
    const chosen = byFit(result.payload.matches.filter((m) => wanted.has(m.brandId)))

    // A failed store read leaves that brand's Demographics list empty rather than failing the report.
    const towns = (await isBrandMatcherDemographicsEnabled()) && site.town
    const storeTowns = await Promise.all(
      chosen.map((m) =>
        towns
          ? brandStoreTowns(m.brandId, site.lat, site.lon).catch((error) => {
              console.error('Brand report store towns failed:', error)
              return null
            })
          : null
      )
    )

    const payload: BrandReportResponse = {
      site,
      query: result.payload.query,
      brands: chosen.map((m, i) => toReportBrand(m, storeTowns[i])),
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Brand report failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
