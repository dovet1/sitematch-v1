import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, requireMonitorAccess } from '@/lib/planning-monitor/access'
import { CAPABILITIES } from '@/lib/planning-monitor/criteria'
import { enqueueBriefing } from '@/lib/planning-monitor/digest-queue'
import { listPatches, savePatch, type PatchLocationInput } from '@/lib/planning-monitor/patches'
import { MonitorQueryError } from '@/lib/planning-monitor/service'
import type { MonitorPatchListResponse } from '@/lib/planning-monitor/types'

export const dynamic = 'force-dynamic'

/** The signed-in user's patches and the filter capabilities the UI may offer. */
export async function GET() {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  try {
    const response: MonitorPatchListResponse = { patches: await listPatches(access.userId), capabilities: CAPABILITIES }
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[planning-monitor] list patches failed', error)
    return jsonError('Patches could not be loaded', 500)
  }
}

/**
 * Create a patch: { name, location, criteria, emailEnabled?, skipQuietWeeks? }. Geometry, criteria,
 * the first revision and the subscription are committed together; the first briefing is queued
 * in the background.
 */
export async function POST(request: NextRequest) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const read = await readJson(request, 2_100_000)
  if (!read.ok) return read.response
  const body = (read.body ?? {}) as Record<string, unknown>
  try {
    const result = await savePatch({
      userId: access.userId,
      patchId: null,
      expectedRevision: null,
      name: body.name,
      location: (body.location as PatchLocationInput | undefined) ?? null,
      criteria: body.criteria,
      emailEnabled: typeof body.emailEnabled === 'boolean' ? body.emailEnabled : false,
      skipQuietWeeks: typeof body.skipQuietWeeks === 'boolean' ? body.skipQuietWeeks : false,
      bodyBytes: read.bytes,
    })
    const briefing = await enqueueBriefing(result.patch, 'initial').catch((error: unknown) => {
      // The patch is saved either way; the card offers a retry when no briefing exists.
      console.error('[planning-monitor] initial briefing enqueue failed', error)
      return null
    })
    return NextResponse.json({ patch: result.patch, briefingRunId: briefing?.id ?? null }, { status: 201 })
  } catch (error) {
    if (error instanceof MonitorQueryError) return jsonError(error.message, error.status)
    console.error('[planning-monitor] create patch failed', error)
    return jsonError('Patch could not be saved', 500)
  }
}
