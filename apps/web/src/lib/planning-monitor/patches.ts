import 'server-only'

import { createPlanningAdminClient, type PlanningAdminClient } from '@/lib/planning-intelligence/db'
import { CAPABILITIES, CRITERIA_VERSION, parseCriteria, type MonitorCriteria } from './criteria'
import { criteriaHash } from './hash'
import { radiusLabel, radiusPatch, validatePatchGeometry, type PatchGeometry, type PatchSource } from './geometry'
import { MonitorQueryError } from './service'
import type { MonitorPatch } from './types'

/**
 * Patch persistence. Every read and write is scoped to the owner here, in addition to row-level
 * security, because these calls use the service role.
 */

const PATCH_COLUMNS =
  'id, name, geometry, display_geometry, geometry_source, geometry_label, criteria, current_revision, current_revision_id, needs_attention, updated_at, planning_monitor_subscriptions(id, email_enabled, skip_quiet_weeks, timezone, next_due_at, unsubscribed_at)'

interface PatchRecord {
  id: string
  name: string
  geometry: PatchGeometry
  display_geometry: PatchGeometry
  geometry_source: PatchSource
  geometry_label: string | null
  criteria: MonitorCriteria
  current_revision: number
  current_revision_id: string | null
  needs_attention: string | null
  updated_at: string
  planning_monitor_subscriptions:
    | { id: string; email_enabled: boolean; skip_quiet_weeks: boolean; timezone: string; next_due_at: string | null; unsubscribed_at: string | null }
    | Array<{ id: string; email_enabled: boolean; skip_quiet_weeks: boolean; timezone: string; next_due_at: string | null; unsubscribed_at: string | null }>
    | null
}

function mapPatch(record: PatchRecord): MonitorPatch {
  const sub = Array.isArray(record.planning_monitor_subscriptions)
    ? record.planning_monitor_subscriptions[0] ?? null
    : record.planning_monitor_subscriptions
  return {
    id: record.id,
    name: record.name,
    geometry: record.geometry,
    displayGeometry: record.display_geometry,
    geometrySource: record.geometry_source,
    geometryLabel: record.geometry_label,
    criteria: record.criteria,
    revision: record.current_revision,
    revisionId: record.current_revision_id,
    needsAttention: record.needs_attention,
    updatedAt: record.updated_at,
    subscription: sub
      ? {
          id: sub.id,
          emailEnabled: sub.email_enabled,
          skipQuietWeeks: sub.skip_quiet_weeks,
          timezone: sub.timezone,
          nextDueAt: sub.next_due_at,
          unsubscribedAt: sub.unsubscribed_at,
        }
      : null,
  }
}

export async function listPatches(userId: string, db: PlanningAdminClient = createPlanningAdminClient()): Promise<MonitorPatch[]> {
  const { data, error } = await db
    .from('planning_monitor_patches')
    .select(PATCH_COLUMNS)
    .eq('owner_id', userId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return ((data ?? []) as unknown as PatchRecord[]).map(mapPatch)
}

/** The owner's patch, or null. Never returns another user's patch. */
export async function getOwnedPatch(
  userId: string,
  patchId: string,
  db: PlanningAdminClient = createPlanningAdminClient()
): Promise<MonitorPatch | null> {
  if (!/^[0-9a-f-]{36}$/i.test(patchId)) return null
  const { data, error } = await db
    .from('planning_monitor_patches')
    .select(PATCH_COLUMNS)
    .eq('id', patchId)
    .eq('owner_id', userId)
    .is('archived_at', null)
    .maybeSingle()
  if (error) throw error
  return data ? mapPatch(data as unknown as PatchRecord) : null
}

export type PatchLocationInput =
  | { kind: 'drawn' | 'uploaded'; geometry: unknown; label?: string | null }
  | { kind: 'boundary'; geometry: unknown; label: string; ref: Record<string, unknown> }
  | { kind: 'radius'; center: { lng: number; lat: number }; radiusMeters: number; placeName: string }

export interface SavePatchInput {
  userId: string
  patchId: string | null
  expectedRevision: number | null
  name: unknown
  location: PatchLocationInput | null
  criteria: unknown
  emailEnabled: boolean | null
  skipQuietWeeks: boolean | null
  bodyBytes: number
}

export interface SavePatchResult {
  patch: MonitorPatch
  created: boolean
  criteriaChanged: boolean
}

export function resolveLocation(location: PatchLocationInput, bodyBytes?: number) {
  if (location.kind === 'radius') {
    const { center, radiusMeters, placeName } = location
    if (!center || typeof center.lng !== 'number' || typeof center.lat !== 'number' || typeof placeName !== 'string') {
      return { ok: false as const, error: 'A radius patch needs a centre and a place name' }
    }
    const result = radiusPatch(center, radiusMeters)
    if (!result.ok) return result
    return {
      ...result,
      source: 'radius' as const,
      label: radiusLabel(placeName.slice(0, 60), radiusMeters),
      ref: { center, radiusMeters, placeName: placeName.slice(0, 60) },
    }
  }
  const result = validatePatchGeometry(location.geometry, bodyBytes)
  if (!result.ok) return result
  return {
    ...result,
    source: location.kind,
    label: typeof location.label === 'string' ? location.label.slice(0, 80) : null,
    ref: location.kind === 'boundary' ? location.ref : {},
  }
}

/**
 * Save geometry, criteria and notification preference together, creating a new immutable
 * revision. A save that changes nothing about matching still records a revision (a rename, or a
 * notification change) but reports `criteriaChanged: false` so no replacement preview is queued.
 */
export async function savePatch(input: SavePatchInput, db: PlanningAdminClient = createPlanningAdminClient()): Promise<SavePatchResult> {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 80) throw new MonitorQueryError('Give the patch a name of up to 80 characters', 400)

  const parsed = parseCriteria(input.criteria)
  if (!parsed.ok) throw new MonitorQueryError(parsed.error, 400)

  const existing = input.patchId ? await getOwnedPatch(input.userId, input.patchId, db) : null
  if (input.patchId && !existing) throw new MonitorQueryError('Patch not found', 404)

  let geometry: PatchGeometry
  let display: PatchGeometry
  let source: PatchSource
  let label: string | null
  let ref: Record<string, unknown>
  if (input.location) {
    const resolved = resolveLocation(input.location, input.bodyBytes)
    if (!resolved.ok) throw new MonitorQueryError(resolved.error, 400)
    geometry = resolved.geometry
    display = resolved.display
    source = resolved.source
    label = resolved.label
    ref = resolved.ref
  } else if (existing) {
    geometry = existing.geometry
    display = existing.displayGeometry
    source = existing.geometrySource
    label = existing.geometryLabel
    ref = {}
  } else {
    throw new MonitorQueryError('Draw, upload or search for an area first', 400)
  }

  const hash = criteriaHash(parsed.criteria)
  const criteriaChanged =
    !existing ||
    criteriaHash(existing.criteria) !== hash ||
    JSON.stringify(existing.geometry) !== JSON.stringify(geometry)

  const { data, error } = await db.rpc('planning_monitor_save_patch', {
    p_owner_id: input.userId,
    p_patch_id: input.patchId,
    p_expected_revision: input.expectedRevision,
    p_name: name,
    p_geometry: geometry,
    p_display_geometry: display,
    p_geometry_source: source,
    p_geometry_label: label,
    p_geometry_ref: existing && !input.location ? null : ref,
    p_criteria: parsed.criteria,
    p_criteria_version: CRITERIA_VERSION,
    p_criteria_hash: hash,
    p_capability_version: CAPABILITIES.version,
    p_email_enabled: input.emailEnabled,
    p_skip_quiet_weeks: input.skipQuietWeeks,
  })
  if (error) {
    if (error.code === '40001') throw new MonitorQueryError(error.message, 409)
    if (error.code === 'P0002') throw new MonitorQueryError('Patch not found', 404)
    if (error.code === '22023') throw new MonitorQueryError(error.message, 400)
    throw error
  }
  const saved = ((data ?? []) as Array<{ patch_id: string; created: boolean }>)[0]
  const patch = await getOwnedPatch(input.userId, saved.patch_id, db)
  if (!patch) throw new Error('Saved patch could not be read back')
  return { patch, created: saved.created, criteriaChanged }
}

export async function archivePatch(userId: string, patchId: string, db: PlanningAdminClient = createPlanningAdminClient()) {
  const { data, error } = await db
    .from('planning_monitor_patches')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', patchId)
    .eq('owner_id', userId)
    .is('archived_at', null)
    .select('id')
  if (error) throw error
  if (!data?.length) return false
  // Archiving stops future emails; existing reports stay readable.
  await db.from('planning_monitor_subscriptions').update({ email_enabled: false, updated_at: new Date().toISOString() }).eq('patch_id', patchId)
  return true
}

/** How long a deleted patch can be brought back from the undo toast. */
export const RESTORE_WINDOW_MS = 10 * 60_000

/**
 * Undo an archive made moments ago. Restores the patch and, if the caller says it was on, its
 * weekly email. Refuses anything archived longer ago than the undo window.
 */
export async function restorePatch(
  userId: string,
  patchId: string,
  options: { emailEnabled: boolean },
  db: PlanningAdminClient = createPlanningAdminClient()
) {
  const { data, error } = await db
    .from('planning_monitor_patches')
    .update({ archived_at: null, is_active: true })
    .eq('id', patchId)
    .eq('owner_id', userId)
    .gte('archived_at', new Date(Date.now() - RESTORE_WINDOW_MS).toISOString())
    .select('id')
  if (error) throw error
  if (!data?.length) return false
  if (options.emailEnabled) {
    await db.from('planning_monitor_subscriptions').update({ email_enabled: true, updated_at: new Date().toISOString() }).eq('patch_id', patchId)
  }
  return true
}

export async function updateSubscription(
  userId: string,
  patchId: string,
  changes: { emailEnabled?: boolean; skipQuietWeeks?: boolean },
  db: PlanningAdminClient = createPlanningAdminClient()
) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof changes.emailEnabled === 'boolean') {
    update.email_enabled = changes.emailEnabled
    if (changes.emailEnabled) update.unsubscribed_at = null
  }
  if (typeof changes.skipQuietWeeks === 'boolean') update.skip_quiet_weeks = changes.skipQuietWeeks
  const { data, error } = await db
    .from('planning_monitor_subscriptions')
    .update(update)
    .eq('patch_id', patchId)
    .eq('user_id', userId)
    .select('id')
  if (error) throw error
  if (changes.emailEnabled) {
    await db.from('planning_alert_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('enabled', true)
  }
  return Boolean(data?.length)
}
