import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { runPlotaRefresh } from '@/lib/planning-intelligence/ingest'
import { PlotaClient, type CensusScope } from '@/lib/planning-intelligence/plota'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Re-check applications we already store.
 *
 * Discovery only ever looks for records that are new to us. An application approved three
 * months after it was received changes in Plota and never changes here, so the tab keeps
 * showing it as undecided. This route re-searches the received-date months that still hold
 * undecided records, least recently checked first, and upserts what comes back.
 *
 * It is a separate route rather than a query parameter on the sync endpoint because a Vercel
 * cron entry that lost its query string would silently run discovery instead, and discovery
 * succeeding is indistinguishable from refresh working.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.PLOTA_SYNC_ENABLED !== 'true') {
    return NextResponse.json({
      error: 'Plota sync is disabled. This prevents accidental allowance use.',
    }, { status: 503 })
  }
  if (!process.env.PLOTA_API_KEY) {
    return NextResponse.json({ error: 'PLOTA_API_KEY is not configured' }, { status: 500 })
  }

  const scope: CensusScope = process.env.PLOTA_CENSUS_SCOPE === 'full' ? 'full' : 'reduced'
  const params = request.nextUrl.searchParams
  const configuredCohorts = Number.parseInt(
    params.get('cohorts') ?? process.env.PLOTA_REFRESH_COHORTS ?? '3', 10
  )
  const cohortLimit = Math.max(1, Math.min(Number.isFinite(configuredCohorts) ? configuredCohorts : 3, 24))
  const configuredMaxPages = Number.parseInt(process.env.PLOTA_MAX_PAGES_PER_RUN ?? '1', 10)
  const maxPages = Math.max(1, Math.min(Number.isFinite(configuredMaxPages) ? configuredMaxPages : 1, 100))
  const configuredPageSize = Number.parseInt(process.env.PLOTA_PAGE_SIZE ?? '10', 10)
  const pageSize = Math.max(1, Math.min(Number.isFinite(configuredPageSize) ? configuredPageSize : 10, 50))

  try {
    const result = await runPlotaRefresh({
      db: createPlanningAdminClient(),
      client: new PlotaClient(process.env.PLOTA_API_KEY),
      scope,
      cohortLimit,
      pageSize,
      maxPages,
      brandLimbEnabled: process.env.PLANNING_BRAND_LIMB_ENABLED === 'true',
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[plota-refresh] Failed', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Plota refresh failed',
    }, { status: 500 })
  }
}
