import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, requireMonitorAccess } from '@/lib/planning-monitor/access'
import { parseBBox, parseGrouping, resolveScope } from '@/lib/planning-monitor/request'
import { MonitorQueryError, queryMonitor } from '@/lib/planning-monitor/service'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 2_100_000

/**
 * Planning Monitor read: viewport clusters, a page of rows, and patch-wide plus in-view totals,
 * all from one predicate. Body:
 *   { scope: 'patch'|'uk', patchId?, draftLocation?, criteria?, grouping?, viewport?: [w,s,e,n],
 *     zoom?, include?: { totals, rows, clusters }, rowsInViewport?, cursor? }
 */
export async function POST(request: NextRequest) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const read = await readJson(request, MAX_BODY_BYTES)
  if (!read.ok) return read.response
  const body = (read.body ?? {}) as Record<string, unknown>

  try {
    const resolved = await resolveScope(access.userId, body, read.bytes)
    const include = (body.include ?? {}) as Record<string, unknown>
    const zoom = body.zoom == null ? null : Number(body.zoom)
    if (zoom != null && (!Number.isFinite(zoom) || zoom < 0 || zoom > 24)) throw new MonitorQueryError('zoom is out of range', 400)
    const result = await queryMonitor({
      userId: access.userId,
      scope: resolved.scope,
      criteria: resolved.criteria,
      geometry: resolved.geometry,
      grouping: parseGrouping(body.grouping),
      viewport: parseBBox(body.viewport),
      zoom,
      include: {
        totals: include.totals !== false,
        rows: include.rows !== false,
        clusters: include.clusters === true,
      },
      rowsInViewport: body.rowsInViewport === true,
      cursor: typeof body.cursor === 'string' ? body.cursor : null,
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof MonitorQueryError) return jsonError(error.message, error.status)
    console.error('[planning-monitor] query failed', error)
    return jsonError('Planning data could not be loaded', 500)
  }
}
