import { NextRequest, NextResponse } from 'next/server'
import { requirePlusAccess, directoryAdminClient } from '@/lib/directory'
import { runFindSitesSearch } from '@/lib/site-matching/search-service'
import type { FindSitesPreset, FindSitesSearchParams } from '@/lib/site-matching/find-sites-dto'

export const dynamic = 'force-dynamic'
// The read layer walks the ~8k-site universe + all enrichment; give it headroom.
export const maxDuration = 120

const PRESETS: FindSitesPreset[] = ['drive-thru', 'roadside', 'retail', 'industrial']

function parseIds(raw: string | null): string[] | null {
  const ids = raw?.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  return ids && ids.length > 0 ? ids : null
}

function num(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null
  const x = Number(raw)
  return Number.isNaN(x) ? null : x
}

/**
 * Read-only Find Sites search over the real Canterbury candidate universe. Returns tiered,
 * evidence-backed parcels (never a definitive "% suitable"). Plus-gated; the actual reads run
 * through the service-role client (candidate_* + the read-only same-brand / recall / geometry
 * RPCs), mirroring api/public/directory/brands. Nothing here writes.
 *
 * Query parameters:
 * - preset: drive-thru | roadside | retail | industrial   (required)
 * - bbox: minLon,minLat,maxLon,maxLat                      (optional; defaults to Canterbury)
 * - brandId: uuid                                          (optional; appends same-brand gate)
 * - fasciaIds: comma-separated uuids                       (optional; narrows the brand rollup)
 * - minMiles, minAcres, topN: numbers                      (optional)
 * - siteSource: string                                     (optional; defaults hmlr_inspire)
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requirePlusAccess()
    if (gate.error) return gate.error

    const { searchParams } = new URL(request.url)

    const preset = searchParams.get('preset') as FindSitesPreset | null
    if (!preset || !PRESETS.includes(preset)) {
      return NextResponse.json(
        { error: `Invalid preset. One of: ${PRESETS.join(', ')}.` },
        { status: 400 }
      )
    }

    let bbox: [number, number, number, number] | undefined
    const bboxRaw = searchParams.get('bbox')
    if (bboxRaw) {
      const parts = bboxRaw.split(',').map((s) => Number(s))
      if (parts.length !== 4 || parts.some((v) => Number.isNaN(v))) {
        return NextResponse.json({ error: 'Invalid bbox.' }, { status: 400 })
      }
      bbox = [parts[0], parts[1], parts[2], parts[3]]
    }

    const params: FindSitesSearchParams = {
      preset,
      bbox,
      brandId: searchParams.get('brandId') || null,
      fasciaIds: parseIds(searchParams.get('fasciaIds')),
      minMiles: num(searchParams.get('minMiles')) ?? undefined,
      minAcres: num(searchParams.get('minAcres')) ?? undefined,
      topN: num(searchParams.get('topN')) ?? undefined,
      siteSource: searchParams.get('siteSource') || undefined,
    }

    const admin = directoryAdminClient()
    const resolveBrandName = async (brandId: string): Promise<string | null> => {
      const { data } = await admin.from('brands').select('name').eq('id', brandId).maybeSingle()
      return (data?.name as string) ?? null
    }

    const result = await runFindSitesSearch(admin, params, { resolveBrandName })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Find Sites search failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
