import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { runPlotaLaneDiscovery, type DiscoveryLane } from '@/lib/planning-intelligence/ingest'
import {
  deepDiscoveryWindow,
  lateDiscoveryWindow,
  PlotaClient,
} from '@/lib/planning-intelligence/plota'

const WINDOWS = { late: lateDiscoveryWindow, deep: deepDiscoveryWindow }

/**
 * Shared by the late and deep cron routes so their checks and limits cannot drift apart.
 *
 * Plota filters on receipt date but lists an application only once it is validated, and a
 * fifth of commercially relevant applications are validated more than two weeks after
 * receipt. Main discovery reads only the latest week, so without these lanes those records
 * would never be fetched once the one-off backfill has passed their dates.
 *
 * Each lane is its own route rather than a query parameter on the sync endpoint for the same
 * reason as refresh: a cron entry that lost its query string would silently run discovery.
 */
export async function runDiscoveryLaneRoute(request: NextRequest, lane: DiscoveryLane) {
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
  const window = WINDOWS[lane]()
  if (!window) {
    return NextResponse.json({
      success: true, lane, skipped: 'The whole window predates the live-only filter floor',
    })
  }

  const configuredMaxPages = Number.parseInt(process.env.PLOTA_MAX_PAGES_PER_RUN ?? '1', 10)
  const maxPages = Math.max(1, Math.min(Number.isFinite(configuredMaxPages) ? configuredMaxPages : 1, 100))
  const configuredPageSize = Number.parseInt(process.env.PLOTA_PAGE_SIZE ?? '10', 10)
  const pageSize = Math.max(1, Math.min(Number.isFinite(configuredPageSize) ? configuredPageSize : 10, 50))

  try {
    const result = await runPlotaLaneDiscovery(lane, {
      db: createPlanningAdminClient(),
      client: new PlotaClient(process.env.PLOTA_API_KEY),
      ...window,
      pageSize,
      maxPages,
      brandLimbEnabled: process.env.PLANNING_BRAND_LIMB_ENABLED === 'true',
    })
    return NextResponse.json({ success: true, lane, ...result })
  } catch (error) {
    console.error(`[plota-${lane}-discovery] Failed`, error)
    return NextResponse.json({
      success: false,
      lane,
      error: error instanceof Error ? error.message : `Plota ${lane} discovery failed`,
    }, { status: 500 })
  }
}
