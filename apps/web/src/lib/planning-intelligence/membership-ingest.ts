import type { PlanningAdminClient } from './db'
import {
  planFamilyMemberships,
  type CurrentMembership,
  type DevelopmentGuard,
  type FamilyPlan,
  type MembershipApplication,
  type MembershipInput,
  type StoredLink,
} from './development-membership'
import { prioritiseFamilyLookups } from './family-priority'
import { planningLinkingEnabled } from './link-ingest'
import type { LinkKind, LinkSource, LinkStrength } from './linking'

/**
 * Development linking, step 5: read families from the database, plan them, apply the plans.
 *
 * Used by `scripts/assign-development-families.ts` for a council and by ingestion for the families
 * a page touched. Each family is applied by `planning_apply_family_plan` in its own transaction; one
 * family failing (usually a guard that changed since the read) is recorded and the rest continue.
 */
export function planningMembershipEnabled(): boolean {
  return planningLinkingEnabled() && process.env.PLANNING_MEMBERSHIP_ENABLED === 'true'
}

/**
 * The councils where ingestion may group applications into families, from
 * PLANNING_MEMBERSHIP_COUNCILS (comma-separated slugs). Linking evidence can run nationally while
 * grouping stays on the pilot: grouping changes what the tab shows and can clear or re-queue
 * grades, so it widens only when the user lists a council. Unset or empty means no council at all.
 */
export function membershipCouncils(value = process.env.PLANNING_MEMBERSHIP_COUNCILS): Set<string> {
  return new Set((value ?? '').split(',').map(council => council.trim()).filter(Boolean))
}

const CHUNK = 200
const APPLICATION_COLUMNS = 'id,authority_slug,reference,description,procedure,address,postcode,uprn,intelligence_tier,classification_state,date_received'
const LINK_COLUMNS = 'id,authority_slug,child_application_id,parent_application_id,parent_reference,parent_key,kind,strength,source,evidence'

type LinkRow = {
  id: string; authority_slug: string; child_application_id: string; parent_application_id: string | null
  parent_reference: string; parent_key: string; kind: LinkKind; strength: LinkStrength; source: LinkSource; evidence: string | null
}
type ApplicationRow = MembershipApplication & { authority_slug: string }

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function paged<T>(run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await run(from, from + 999)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
    if (((data ?? []) as T[]).length < 1000) return rows
  }
}

async function inChunks<T>(ids: string[], read: (batch: string[]) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (const batch of chunks([...new Set(ids)])) {
    const { data, error } = await read(batch)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
  }
  return rows
}

function toStoredLink(row: LinkRow): StoredLink {
  return {
    id: row.id, childId: row.child_application_id, parentId: row.parent_application_id,
    parentReference: row.parent_reference, kind: row.kind, strength: row.strength, source: row.source,
    evidence: row.evidence ?? '',
  }
}

/** Everything the planner needs about the families these links describe, for one council. */
async function inputForLinks(db: PlanningAdminClient, council: string, linkRows: LinkRow[]): Promise<MembershipInput> {
  const applicationIds = [...new Set(linkRows.flatMap(row => [row.child_application_id, row.parent_application_id].filter((id): id is string => Boolean(id))))]
  const applications = (await inChunks<ApplicationRow>(applicationIds, batch =>
    db.from('planning_applications').select(APPLICATION_COLUMNS).in('id', batch)))
    .map(row => ({ ...row, description: row.description ?? '' }))
  const membershipRows = await inChunks<{ planning_application_id: string; development_id: string; role: string }>(applicationIds, batch =>
    db.from('development_applications').select('planning_application_id,development_id,role').in('planning_application_id', batch))
  const developmentIds = [...new Set(membershipRows.map(row => row.development_id))]
  type DevelopmentRow = {
    id: string; review_state: string; research_state: string; principal_application_id?: string | null
    family_state?: string; first_seen_at: string | null
  }
  // Before the step 5 migration the family columns do not exist; a dry run still reads everything
  // else and treats every Development as a single application's.
  const developmentRows = await inChunks<DevelopmentRow>(developmentIds, batch =>
    db.from('developments').select('id,review_state,research_state,principal_application_id,family_state,first_seen_at').in('id', batch))
    .catch(async (error: unknown) => {
      if ((error as { code?: string } | null)?.code !== '42703') throw error
      return inChunks<DevelopmentRow>(developmentIds, batch =>
        db.from('developments').select('id,review_state,research_state,first_seen_at').in('id', batch))
    })
  const decided = new Set((await inChunks<{ development_id: string }>(developmentIds, batch =>
    db.from('development_facts').select('development_id').in('development_id', batch).not('decided_by', 'is', null)))
    .map(row => row.development_id))
  const { data: conflictRows, error: conflictError } = await db.from('planning_family_lookups')
    .select('parent_key').eq('authority_slug', council).eq('review_state', 'pending')
  // Without the step 4 family migration no Plota family has been stored, so none can conflict.
  if (conflictError && (conflictError as { code?: string }).code !== '42703') throw conflictError
  const conflicts = conflictError ? [] : conflictRows

  const memberships: CurrentMembership[] = membershipRows.map(row => ({
    applicationId: row.planning_application_id, developmentId: row.development_id, role: row.role,
  }))
  const developments: DevelopmentGuard[] = developmentRows.map(row => ({
    id: row.id, reviewState: row.review_state, researchState: row.research_state, decidedFacts: decided.has(row.id),
    principalApplicationId: row.principal_application_id ?? null, familyState: row.family_state ?? 'single', firstSeenAt: row.first_seen_at,
  }))
  return {
    applications,
    links: linkRows.map(toStoredLink),
    memberships,
    developments,
    conflictedParentKeys: new Set(((conflicts ?? []) as Array<{ parent_key: string }>).map(row => row.parent_key)),
  }
}

/** Every family in a council with stored links. */
export async function planCouncilMemberships(db: PlanningAdminClient, council: string): Promise<{ input: MembershipInput; plans: FamilyPlan[] }> {
  const linkRows = await paged<LinkRow>((from, to) => db.from('planning_application_links').select(LINK_COLUMNS)
    .eq('authority_slug', council).is('removed_at', null).order('id').range(from, to))
  const input = await inputForLinks(db, council, linkRows)
  return { input, plans: planFamilyMemberships(input) }
}

/**
 * The families these applications belong to: their links, then every link sharing a parent with
 * them, until nothing new is found. Bounded, because a masterplan family can be large and the
 * planner holds those anyway.
 */
export async function planMembershipsFor(
  db: PlanningAdminClient,
  applicationIds: string[],
  councils?: Set<string>
): Promise<Map<string, { input: MembershipInput; plans: FamilyPlan[] }>> {
  const seen = new Map<string, LinkRow>()
  const visitedApplications = new Set<string>()
  const visitedKeys = new Set<string>()
  let frontier = [...new Set(applicationIds)]
  for (let round = 0; round < 4; round++) {
    frontier = frontier.filter(id => !visitedApplications.has(id))
    if (frontier.length === 0) break
    frontier.forEach(id => visitedApplications.add(id))
    const found = [
      ...await inChunks<LinkRow>(frontier, batch => db.from('planning_application_links').select(LINK_COLUMNS).in('child_application_id', batch).is('removed_at', null)),
      ...await inChunks<LinkRow>(frontier, batch => db.from('planning_application_links').select(LINK_COLUMNS).in('parent_application_id', batch).is('removed_at', null)),
    ]
    const keysByCouncil = new Map<string, string[]>()
    for (const row of found) {
      const key = `${row.authority_slug}|${row.parent_key}`
      if (visitedKeys.has(key)) continue
      visitedKeys.add(key)
      keysByCouncil.set(row.authority_slug, [...(keysByCouncil.get(row.authority_slug) ?? []), row.parent_key])
    }
    for (const [council, parentKeys] of keysByCouncil) {
      found.push(...await inChunks<LinkRow>(parentKeys, batch => db.from('planning_application_links').select(LINK_COLUMNS)
        .eq('authority_slug', council).in('parent_key', batch).is('removed_at', null)))
    }
    for (const row of found) seen.set(row.id, row)
    frontier = found.flatMap(row => [row.child_application_id, row.parent_application_id]).filter((id): id is string => Boolean(id))
  }

  const byCouncil = new Map<string, LinkRow[]>()
  for (const row of seen.values()) {
    if (councils && !councils.has(row.authority_slug)) continue
    byCouncil.set(row.authority_slug, [...(byCouncil.get(row.authority_slug) ?? []), row])
  }
  const out = new Map<string, { input: MembershipInput; plans: FamilyPlan[] }>()
  for (const [council, rows] of byCouncil) {
    const input = await inputForLinks(db, council, rows)
    out.set(council, { input, plans: planFamilyMemberships(input) })
  }
  return out
}

export interface ApplyResult {
  applied: number
  unchanged: number
  held: number
  failed: Array<{ familyKey: string; error: string }>
  queuedClassifications: number
  awaitingOriginal: number
}

export async function applyFamilyPlans(
  db: PlanningAdminClient,
  plans: FamilyPlan[],
  options: { actor: string; reason: string }
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, unchanged: 0, held: 0, failed: [], queuedClassifications: 0, awaitingOriginal: 0 }
  for (const plan of plans) {
    if (plan.action === 'unchanged') { result.unchanged++; continue }
    if (plan.action === 'hold') { result.held++; continue }
    const { error } = await db.rpc('planning_apply_family_plan', { p_plan: plan, p_actor: options.actor, p_reason: options.reason })
    if (error) {
      result.failed.push({ familyKey: plan.familyKey, error: (error as { message?: string }).message ?? JSON.stringify(error) })
      continue
    }
    result.applied++
    result.queuedClassifications += plan.queueClassification.length
    if (plan.familyState === 'awaiting_original') result.awaitingOriginal++
  }
  return result
}

/** Linking and membership have run for these applications, so the classifier may take them. */
export async function clearLinkingPending(db: PlanningAdminClient, applicationIds: string[]): Promise<void> {
  for (const batch of chunks([...new Set(applicationIds)])) {
    const { error } = await db.from('planning_applications').update({ linking_state: null })
      .in('id', batch).eq('linking_state', 'pending')
    if (error) throw error
  }
}

/**
 * Ingestion's entry point: plan and apply the families these applications touch, then raise the
 * lookups of any family now waiting for its original. The caller clears the linking gate afterwards,
 * whatever happens here.
 */
export async function assignMembershipsFor(db: PlanningAdminClient, applicationIds: string[], actor: string): Promise<ApplyResult> {
  const total: ApplyResult = { applied: 0, unchanged: 0, held: 0, failed: [], queuedClassifications: 0, awaitingOriginal: 0 }
  if (applicationIds.length === 0) return total
  const allowed = membershipCouncils()
  if (allowed.size === 0) {
    console.warn('[planning-membership] PLANNING_MEMBERSHIP_COUNCILS is empty; no council is grouped')
    return total
  }
  const councilsWaiting: string[] = []
  for (const [council, { plans }] of await planMembershipsFor(db, applicationIds, allowed)) {
    const result = await applyFamilyPlans(db, plans, { actor, reason: 'linked at ingestion' })
    total.applied += result.applied
    total.unchanged += result.unchanged
    total.held += result.held
    total.failed.push(...result.failed)
    total.queuedClassifications += result.queuedClassifications
    total.awaitingOriginal += result.awaitingOriginal
    if (result.awaitingOriginal > 0) councilsWaiting.push(council)
  }
  if (councilsWaiting.length) await prioritiseFamilyLookups(db, councilsWaiting)
  return total
}
