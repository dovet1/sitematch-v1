import 'server-only'

import { defaultCriteria, parseCriteria, type MonitorCriteria } from './criteria'
import { getOwnedPatch, resolveLocation, type PatchLocationInput } from './patches'
import { MonitorQueryError } from './service'
import type { PatchGeometry } from './geometry'
import type { BBox, MonitorGrouping, MonitorScope } from './types'

/**
 * Shared request parsing for /query and /count, so both accept exactly the same scope, patch,
 * draft geometry and criteria and therefore evaluate the same predicate.
 */

export interface ResolvedScope {
  scope: MonitorScope
  criteria: MonitorCriteria
  geometry: PatchGeometry | null
}

export function parseBBox(value: unknown): BBox | null {
  if (value == null) return null
  if (!Array.isArray(value) || value.length !== 4 || !value.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    throw new MonitorQueryError('viewport must be [west, south, east, north]', 400)
  }
  const [w, s, e, n] = value as number[]
  if (w >= e || s >= n || w < -180 || e > 180 || s < -90 || n > 90) throw new MonitorQueryError('viewport is not a valid box', 400)
  return [w, s, e, n]
}

export function parseGrouping(value: unknown): MonitorGrouping {
  if (value == null || value === 'developments') return 'developments'
  if (value === 'applications') return 'applications'
  throw new MonitorQueryError('grouping must be developments or applications', 400)
}

/**
 * - scope "uk": criteria from the body (the user's current filters), or the defaults.
 * - scope "patch" with patchId: the owned patch's geometry; its saved criteria unless the body
 *   supplies draft criteria (the edit modal's preview).
 * - scope "patch" with draftLocation: an unsaved drawing, upload, boundary or radius.
 */
export async function resolveScope(userId: string, body: Record<string, unknown>, bodyBytes: number): Promise<ResolvedScope> {
  const scope = body.scope === 'uk' ? 'uk' : body.scope === 'patch' ? 'patch' : null
  if (!scope) throw new MonitorQueryError('scope must be patch or uk', 400)

  let criteria: MonitorCriteria | null = null
  if (body.criteria !== undefined) {
    const parsed = parseCriteria(body.criteria)
    if (!parsed.ok) throw new MonitorQueryError(parsed.error, 400)
    criteria = parsed.criteria
  }

  if (scope === 'uk') return { scope, criteria: criteria ?? defaultCriteria(), geometry: null }

  if (body.draftLocation) {
    const resolved = resolveLocation(body.draftLocation as PatchLocationInput, bodyBytes)
    if (!resolved.ok) throw new MonitorQueryError(resolved.error, 400)
    return { scope, criteria: criteria ?? defaultCriteria(), geometry: resolved.geometry }
  }
  if (typeof body.patchId !== 'string') throw new MonitorQueryError('patchId or draftLocation is required for My patch', 400)
  const patch = await getOwnedPatch(userId, body.patchId)
  // Not found and not yours are the same answer.
  if (!patch) throw new MonitorQueryError('Patch not found', 404)
  return { scope, criteria: criteria ?? patch.criteria, geometry: patch.geometry }
}
