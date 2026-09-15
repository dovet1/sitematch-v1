import 'server-only'

import { NextResponse } from 'next/server'
import { requireGapFinderAccess } from '@/lib/gapfinder-access'
import { isPlanningMonitorEnabled } from '@/lib/feature-flags'

export type MonitorAccess = { ok: true; userId: string } | { ok: false; response: NextResponse }

/**
 * Every Planning Monitor endpoint: the mode's kill-switch, a signed-in user, and the workspace's
 * Plus entitlement. Checked before any cache or database read so private patch data cannot be
 * served to the wrong user.
 */
export async function requireMonitorAccess(): Promise<MonitorAccess> {
  if (!(await isPlanningMonitorEnabled())) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  const access = await requireGapFinderAccess()
  if (!access.authorized) return { ok: false, response: access.response }
  return { ok: true, userId: access.userId }
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Read a JSON body with a size limit. */
export async function readJson(request: Request, maxBytes: number): Promise<{ ok: true; body: unknown; bytes: number } | { ok: false; response: NextResponse }> {
  const text = await request.text()
  const bytes = Buffer.byteLength(text)
  if (bytes > maxBytes) return { ok: false, response: jsonError('Request body too large', 413) }
  try {
    return { ok: true, body: JSON.parse(text), bytes }
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) }
  }
}
