import { NextRequest, NextResponse } from 'next/server'
import {
  MAX_BODY_BYTES,
  RateLimitError,
  fetchPlanningApplications,
  validateBoundary,
  type Boundary,
} from './planit'

export const dynamic = 'force-dynamic'

/**
 * Planning applications inside a boundary — used by the unified workspace's
 * Planning tab (Find Gaps BUA polygon / Assess Area circle or isochrone).
 *
 * POST body: { boundary: GeoJSON Polygon | MultiPolygon }
 *
 * Returns:
 * {
 *   applications: PlanningApplication[],
 *   total: number,
 *   truncated: boolean   // partial results (tile cap, upstream timeout, 429)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { applications: [], total: 0, truncated: false, error: 'Request body too large' },
        { status: 400 }
      )
    }
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { applications: [], total: 0, truncated: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    const boundary = (body as { boundary?: unknown })?.boundary
    const invalid = validateBoundary(boundary)
    if (invalid) {
      return NextResponse.json(
        { applications: [], total: 0, truncated: false, error: invalid },
        { status: 400 }
      )
    }

    const result = await fetchPlanningApplications(boundary as Boundary)
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          applications: [],
          total: 0,
          truncated: false,
          error: 'Planning data is temporarily rate-limited — try again in a few minutes',
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      {
        applications: [],
        total: 0,
        truncated: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
