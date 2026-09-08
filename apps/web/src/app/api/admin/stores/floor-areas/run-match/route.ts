import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminError } from '@/lib/admin-auth'
import type { RunMatchResponse } from '@/types/floor-area-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The cron route it calls declares 300s; a caller that gave up sooner would report a
// failure for a run that then completed, which is worse than waiting.
export const maxDuration = 300

/**
 * "Run now" — the button on /admin/stores/floor-areas.
 *
 * An admin who has just imported 400 stores should not wait for 03:00 to see them get a
 * floor area. The import route already triggers a match fire-and-forget, so this exists
 * for the cases that trigger does not cover: it failed silently, the import predates it,
 * or a dead letter has been fixed and needs another pass.
 *
 * It delegates to the cron route rather than reimplementing the batch, so there is one
 * matcher and one place a run is recorded. That route is the thing the cron has already
 * been verified against end to end; a second copy here would be a second thing to keep
 * true. The cost is an HTTP hop and holding CRON_SECRET in two places.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminUser()
  if (gate.error) return gate.error

  try {
    if (!process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET is not configured, so the matcher cannot be called.' } satisfies RunMatchResponse,
        { status: 500 }
      )
    }

    // request.nextUrl.origin last rather than first: behind a proxy it is whatever
    // reached the server, and the configured site URL is what we mean by "us".
    const base = process.env.NEXT_PUBLIC_SITE_URL
      || process.env.NEXT_PUBLIC_BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || request.nextUrl.origin

    const response = await fetch(`${base}/api/cron/match-store-floor-areas`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: body?.error || `Matcher returned ${response.status}` } satisfies RunMatchResponse,
        { status: 502 }
      )
    }

    return NextResponse.json(body as RunMatchResponse)
  } catch (error) {
    return adminError('Floor-area run-match', error)
  }
}
