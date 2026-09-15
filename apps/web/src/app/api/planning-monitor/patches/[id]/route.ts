import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, requireMonitorAccess } from '@/lib/planning-monitor/access'
import { enqueueBriefing } from '@/lib/planning-monitor/digest-queue'
import { archivePatch, getOwnedPatch, savePatch, updateSubscription, type PatchLocationInput } from '@/lib/planning-monitor/patches'
import { MonitorQueryError } from '@/lib/planning-monitor/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { id } = await params
  const patch = await getOwnedPatch(access.userId, id).catch(() => null)
  if (!patch) return jsonError('Patch not found', 404)
  return NextResponse.json({ patch }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/**
 * Save an edited patch: { expectedRevision, name, location?, criteria, emailEnabled?, skipQuietWeeks? }.
 * Omitting `location` keeps the saved geometry. A change to geometry or criteria creates a new
 * revision and queues one replacement preview; earlier reports keep their own revision.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { id } = await params
  const read = await readJson(request, 2_100_000)
  if (!read.ok) return read.response
  const body = (read.body ?? {}) as Record<string, unknown>
  try {
    const result = await savePatch({
      userId: access.userId,
      patchId: id,
      expectedRevision: typeof body.expectedRevision === 'number' ? body.expectedRevision : null,
      name: body.name,
      location: (body.location as PatchLocationInput | undefined) ?? null,
      criteria: body.criteria,
      emailEnabled: typeof body.emailEnabled === 'boolean' ? body.emailEnabled : null,
      skipQuietWeeks: typeof body.skipQuietWeeks === 'boolean' ? body.skipQuietWeeks : null,
      bodyBytes: read.bytes,
    })
    const briefing = result.criteriaChanged
      ? await enqueueBriefing(result.patch, 'preview').catch((error: unknown) => {
          console.error('[planning-monitor] preview enqueue failed', error)
          return null
        })
      : null
    return NextResponse.json({ patch: result.patch, briefingRunId: briefing?.id ?? null })
  } catch (error) {
    if (error instanceof MonitorQueryError) return jsonError(error.message, error.status)
    console.error('[planning-monitor] save patch failed', error)
    return jsonError('Patch could not be saved', 500)
  }
}

/** Notification preferences only: { emailEnabled?, skipQuietWeeks? }. No new revision. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { id } = await params
  const read = await readJson(request, 10_000)
  if (!read.ok) return read.response
  const body = (read.body ?? {}) as Record<string, unknown>
  const patch = await getOwnedPatch(access.userId, id).catch(() => null)
  if (!patch) return jsonError('Patch not found', 404)
  try {
    await updateSubscription(access.userId, id, {
      emailEnabled: typeof body.emailEnabled === 'boolean' ? body.emailEnabled : undefined,
      skipQuietWeeks: typeof body.skipQuietWeeks === 'boolean' ? body.skipQuietWeeks : undefined,
    })
    return NextResponse.json({ patch: await getOwnedPatch(access.userId, id) })
  } catch (error) {
    console.error('[planning-monitor] update subscription failed', error)
    return jsonError('Preferences could not be saved', 500)
  }
}

/** Archive: stops future emails, keeps reports. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { id } = await params
  try {
    if (!(await archivePatch(access.userId, id))) return jsonError('Patch not found', 404)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[planning-monitor] archive patch failed', error)
    return jsonError('Patch could not be removed', 500)
  }
}
