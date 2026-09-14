import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { runPlotaDiscovery, runPlotaSync } from '@/lib/planning-intelligence/ingest'
import {
  discoveryWindow,
  PlotaClient,
  REDUCED_SCOPE_ARCHIVE_FLOOR,
  type CensusScope,
} from '@/lib/planning-intelligence/plota'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function utcDate(daysAgo: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.PLOTA_SYNC_ENABLED !== 'true') {
    return NextResponse.json({
      error: 'Plota sync is disabled. This prevents accidental demo allowance use.',
    }, { status: 503 })
  }
  if (!process.env.PLOTA_API_KEY) {
    return NextResponse.json({ error: 'PLOTA_API_KEY is not configured' }, { status: 500 })
  }

  const params = request.nextUrl.searchParams
  const kind = params.get('kind') === 'backfill' ? 'backfill' : 'discovery'
  const dateFrom = params.get('date_from') ?? (kind === 'backfill' ? utcDate(31) : discoveryWindow().dateFrom)
  const dateTo = params.get('date_to') ?? utcDate(0)
  if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo) || dateFrom > dateTo) {
    return NextResponse.json({ error: 'date_from/date_to must be a valid ordered YYYY-MM-DD range' }, { status: 400 })
  }

  const scope: CensusScope = process.env.PLOTA_CENSUS_SCOPE === 'full' ? 'full' : 'reduced'
  if (kind === 'backfill' && scope === 'reduced' && dateFrom < REDUCED_SCOPE_ARCHIVE_FLOOR) {
    return NextResponse.json({
      error: [
        'Plota commercial_work and dmin filters apply to live records only.',
        'A reduced-census pre-2026 backfill would be incomplete, so it has been stopped.',
        'Confirm a supported archive route with Plota or approve the licensed full census first.',
      ].join(' '),
    }, { status: 409 })
  }
  // One page is deliberately the default while using a Demo key. A Starter deployment
  // can raise this without changing code; every page is checkpointed independently.
  const configuredMaxPages = Number.parseInt(process.env.PLOTA_MAX_PAGES_PER_RUN ?? '1', 10)
  const maxPages = Math.max(1, Math.min(Number.isFinite(configuredMaxPages) ? configuredMaxPages : 1, 100))
  const configuredPageSize = Number.parseInt(process.env.PLOTA_PAGE_SIZE ?? '10', 10)
  const pageSize = Math.max(1, Math.min(Number.isFinite(configuredPageSize) ? configuredPageSize : 10, 50))

  try {
    const sync = kind === 'discovery' && !params.has('date_from') && !params.has('date_to')
      ? runPlotaDiscovery : runPlotaSync
    const result = await sync({
      db: createPlanningAdminClient(),
      client: new PlotaClient(process.env.PLOTA_API_KEY),
      kind,
      scope,
      dateFrom,
      dateTo,
      pageSize,
      maxPages,
      brandLimbEnabled: process.env.PLANNING_BRAND_LIMB_ENABLED === 'true',
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[plota-sync] Failed', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Plota sync failed',
    }, { status: 500 })
  }
}
