import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, requireMonitorAccess } from '@/lib/planning-monitor/access'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { getOwnedPatch } from '@/lib/planning-monitor/patches'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The user's watched applications. A watch follows its development through later family changes. */
export async function GET() {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { data, error } = await createPlanningAdminClient()
    .from('planning_monitor_watches')
    .select('planning_application_id, patch_id, created_at')
    .eq('user_id', access.userId)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) return jsonError('Watches could not be loaded', 500)
  return NextResponse.json({ watches: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** Watch: { applicationId, patchId? }. Idempotent. */
export async function POST(request: NextRequest) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const read = await readJson(request, 10_000)
  if (!read.ok) return read.response
  const { applicationId, patchId } = (read.body ?? {}) as { applicationId?: unknown; patchId?: unknown }
  if (typeof applicationId !== 'string' || !UUID.test(applicationId)) return jsonError('applicationId is required', 400)
  if (patchId != null && (typeof patchId !== 'string' || !(await getOwnedPatch(access.userId, patchId)))) {
    return jsonError('Patch not found', 404)
  }
  const db = createPlanningAdminClient()
  const { data: application } = await db.from('planning_applications').select('id').eq('id', applicationId).maybeSingle()
  if (!application) return jsonError('Application not found', 404)
  const { error } = await db
    .from('planning_monitor_watches')
    .upsert({ user_id: access.userId, planning_application_id: applicationId, patch_id: patchId ?? null }, {
      onConflict: 'user_id,planning_application_id',
      ignoreDuplicates: true,
    })
  if (error) return jsonError('Watch could not be saved', 500)
  return NextResponse.json({ watched: true })
}

/**
 * Unwatch: { applicationId }. Removes every watch on the same development, so "Watching" turns off
 * even if the user first watched a different application in the family.
 */
export async function DELETE(request: NextRequest) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const read = await readJson(request, 10_000)
  if (!read.ok) return read.response
  const { applicationId } = (read.body ?? {}) as { applicationId?: unknown }
  if (typeof applicationId !== 'string' || !UUID.test(applicationId)) return jsonError('applicationId is required', 400)
  const db = createPlanningAdminClient()
  const ids = new Set([applicationId])
  const { data: link } = await db.from('development_applications').select('development_id').eq('planning_application_id', applicationId).maybeSingle()
  if (link?.development_id) {
    const { data: family } = await db.from('development_applications').select('planning_application_id').eq('development_id', link.development_id)
    for (const member of family ?? []) ids.add(member.planning_application_id as string)
  }
  const { error } = await db.from('planning_monitor_watches').delete().eq('user_id', access.userId).in('planning_application_id', [...ids])
  if (error) return jsonError('Watch could not be removed', 500)
  return NextResponse.json({ watched: false })
}
