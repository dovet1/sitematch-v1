import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, requireMonitorAccess } from '@/lib/planning-monitor/access'
import { getOwnedPatch, restorePatch } from '@/lib/planning-monitor/patches'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** Undo a delete from the toast: { emailEnabled } restores the weekly email as it was. */
export async function POST(request: NextRequest, { params }: Params) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { id } = await params
  const read = await readJson(request, 1_000)
  if (!read.ok) return read.response
  const body = (read.body ?? {}) as Record<string, unknown>
  try {
    if (!(await restorePatch(access.userId, id, { emailEnabled: body.emailEnabled === true }))) {
      return jsonError('This patch can no longer be restored', 404)
    }
    return NextResponse.json({ patch: await getOwnedPatch(access.userId, id) })
  } catch (error) {
    console.error('[planning-monitor] restore patch failed', error)
    return jsonError('Patch could not be restored', 500)
  }
}
