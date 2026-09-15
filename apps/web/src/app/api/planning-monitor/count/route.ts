import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, requireMonitorAccess } from '@/lib/planning-monitor/access'
import { resolveScope } from '@/lib/planning-monitor/request'
import { MonitorQueryError, queryMonitor } from '@/lib/planning-monitor/service'
import type { MonitorCountResponse } from '@/lib/planning-monitor/types'

export const dynamic = 'force-dynamic'

/**
 * Lightweight match count for draft criteria in the Set Criteria modal. Same scope and predicate
 * as /query; returns totals only. The client debounces and aborts stale requests.
 */
export async function POST(request: NextRequest) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const read = await readJson(request, 2_100_000)
  if (!read.ok) return read.response
  const body = (read.body ?? {}) as Record<string, unknown>

  try {
    const resolved = await resolveScope(access.userId, body, read.bytes)
    const result = await queryMonitor({
      userId: access.userId,
      scope: resolved.scope,
      criteria: resolved.criteria,
      geometry: resolved.geometry,
      grouping: 'developments',
      viewport: null,
      zoom: null,
      include: { totals: true, rows: false, clusters: false },
      rowsInViewport: false,
      cursor: null,
    })
    const response: MonitorCountResponse = {
      criteriaHash: result.criteriaHash,
      totals: result.totals,
      totalsUnavailable: result.totalsUnavailable,
    }
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof MonitorQueryError) return jsonError(error.message, error.status)
    console.error('[planning-monitor] count failed', error)
    return jsonError('Match count could not be loaded', 500)
  }
}
