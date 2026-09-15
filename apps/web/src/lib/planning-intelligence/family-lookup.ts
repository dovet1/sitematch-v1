import { createHash } from 'crypto'
import type { PlanningAdminClient } from './db'
import { storageRowFor } from './ingest'
import { assignMembershipsFor, planningMembershipEnabled } from './membership-ingest'
import { canHeadFamily, familyKey, normaliseReference, referenceCore, type LinkKind } from './linking'
import { maySpendPlotaRequest, PlotaError, type PlotaClient } from './plota'
import type { PlotaApplication, PlotaFamily, PlotaFamilyMember } from './types'

/**
 * Development linking, step 4: recover missing parents through Plota's associated-application family.
 *
 * One request fetches a whole family. Everything it returns is stored: members we lacked become
 * ordinary applications, the relationships become link evidence, and every queued lookup the family
 * answers is closed, so no other follow-on of the same scheme costs another request.
 *
 * Plota links by the same kind of evidence as the local linker and is not treated as the answer:
 * where the two disagree the family is stored and marked for review.
 */

export const FAMILY_ENDPOINT = '/v1/applications/:id/associated'

export interface LookupRow {
  id: string
  authority_slug: string
  parent_key: string
  parent_reference: string
  status: string
  attempts: number
}

export interface StoredFamilyResult {
  familyId: string
  members: number
  newApplications: number
  links: number
  skippedRemovedLinks: number
  lookupsClosed: number
  conflict: FamilyConflict | null
  memberIds: string[]
}

export interface FamilyConflict {
  /** Local follow-ons of this family's references that Plota does not include. */
  localFollowOnsOutsideFamily: string[]
  /** Family members the local linker ties to a parent outside the family. */
  membersLinkedElsewhere: Array<{ reference: string; parentKey: string }>
}

const LINK_KIND_BY_PROCEDURE: Record<string, LinkKind> = {
  discharge: 'condition',
  amendment: 'amendment',
  'reserved-matters': 'reserved_matters',
  'listed-building': 'companion',
  'advert-consent': 'companion',
}

function memberApplication(member: PlotaFamilyMember): PlotaApplication {
  return {
    id: member.id,
    reference: member.reference,
    authority: member.authority,
    address: member.address ?? null,
    description: member.description ?? '',
    planning_route: member.planning_route ?? null,
    procedure: member.procedure ?? null,
    status: member.status ?? null,
    stage: member.stage ?? null,
    date_received: member.date_received ?? null,
    date_decided: member.date_decided ?? null,
    links: member.links ?? null,
    source: member.source ?? null,
    // Kept on the raw record so a member stored from a family can be told apart from a searched one.
    retrieved_via: 'associated',
  } as PlotaApplication
}

function membersOf(family: PlotaFamily): PlotaFamilyMember[] {
  const members = new Map(family.applications.map(member => [member.id, member]))
  if (!members.has(family.principal.id)) members.set(family.principal.id, family.principal)
  return [...members.values()]
}

type StoredMember = { id: string; provider_id: string; reference: string; reference_normalised: string | null; location_provenance: string | null }

/**
 * Members already stored, by provider id, by normalised reference, or by the exact reference: a
 * council not yet seeded has no normalised keys, and the (authority, reference) key must still match.
 */
async function storedMembers(db: PlanningAdminClient, council: string, members: PlotaFamilyMember[]): Promise<StoredMember[]> {
  const columns = 'id,provider_id,reference,reference_normalised,location_provenance'
  const results = await Promise.all([
    db.from('planning_applications').select(columns).eq('provider', 'plota').in('provider_id', members.map(member => member.id)),
    db.from('planning_applications').select(columns).eq('authority_slug', council)
      .in('reference_normalised', members.map(member => normaliseReference(member.reference))),
    db.from('planning_applications').select(columns).eq('authority_slug', council).in('reference', members.map(member => member.reference)),
  ])
  const found = new Map<string, StoredMember>()
  for (const { data, error } of results) {
    if (error) throw error
    for (const row of (data ?? []) as StoredMember[]) found.set(row.id, row)
  }
  return [...found.values()]
}

const sameMember = (row: StoredMember, providerId: string | null, reference: string | null) =>
  (providerId !== null && row.provider_id === providerId)
  || (reference !== null && (row.reference === reference || row.reference_normalised === normaliseReference(reference)
    || normaliseReference(row.reference) === normaliseReference(reference)))

export async function storeFamily(
  db: PlanningAdminClient,
  input: { lookup: LookupRow; family: PlotaFamily; requestedVia: string; admitToTier?: boolean }
): Promise<StoredFamilyResult> {
  const council = input.lookup.authority_slug
  const members = membersOf(input.family).filter(member => member.authority?.slug === council)

  // Members we lack become ordinary applications. A record we already hold is never overwritten
  // with the sparser family copy.
  const before = await storedMembers(db, council, members)
  const known = (member: PlotaFamilyMember) => before.some(row => sameMember(row, member.id, member.reference))
  const fresh = members.filter(member => !known(member))
  if (fresh.length) {
    const rows = fresh.map(member => storageRowFor(memberApplication(member), { admitToTier: input.admitToTier ?? false }))
    const { error } = await db.from('planning_applications').upsert(rows, { onConflict: 'provider,provider_id', ignoreDuplicates: true })
    if (error) throw error
  }

  const stored = await storedMembers(db, council, members)
  const idFor = (providerId: string | null, reference: string | null): string | null =>
    (providerId ? stored.find(row => row.provider_id === providerId) : undefined)?.id
    ?? stored.find(row => sameMember(row, null, reference))?.id ?? null

  // A fetched member has no coordinates; borrow a located member's point, recorded as borrowed.
  const located = stored.find(row => row.location_provenance && row.location_provenance !== 'missing')
  if (located) {
    for (const member of fresh) {
      const target = idFor(member.id, member.reference)
      if (!target) continue
      const { error } = await db.rpc('planning_copy_family_location', { p_target: target, p_source: located.id })
      if (error) throw error
    }
  }

  const memberIds = members.map(member => idFor(member.id, member.reference)).filter((id): id is string => Boolean(id))
  const { data: removed, error: removedError } = await db.from('planning_application_links')
    .select('child_application_id,parent_key').in('child_application_id', memberIds).not('removed_at', 'is', null)
  if (removedError) throw removedError
  const removedKeys = new Set((removed ?? []).map(row => `${row.child_application_id}|${row.parent_key}`))

  let skippedRemovedLinks = 0
  const linkRows: Array<Record<string, unknown>> = []
  for (const member of members) {
    if (!member.parent_reference) continue
    const child = idFor(member.id, member.reference)
    if (!child) continue
    const parentKey = familyKey(member.parent_reference)
    // A link a person removed stays removed, whichever source offers it again.
    if (removedKeys.has(`${child}|${parentKey}`)) { skippedRemovedLinks++; continue }
    const parent = idFor(member.parent_id, member.parent_reference)
    linkRows.push({
      authority_slug: council,
      child_application_id: child,
      parent_application_id: parent === child ? null : parent,
      parent_reference: normaliseReference(member.parent_reference),
      parent_key: parentKey,
      kind: LINK_KIND_BY_PROCEDURE[member.procedure ?? ''] ?? 'cited',
      strength: 'strong',
      source: 'plota_associated',
      evidence: `Plota associated family of ${input.family.principal.reference}, linked by ${member.linked_by ?? 'unknown'}`,
    })
  }
  if (linkRows.length) {
    const { error } = await db.from('planning_application_links')
      .upsert(linkRows, { onConflict: 'child_application_id,parent_key,source', ignoreDuplicates: true })
    if (error) throw error
  }

  const principalId = idFor(input.family.principal.id, input.family.principal.reference)
  const { data: familyRow, error: familyError } = await db.from('planning_families').upsert({
    authority_slug: council,
    principal_provider_id: input.family.principal.id,
    principal_reference: input.family.principal.reference,
    principal_application_id: principalId,
    member_count: members.length,
    condition_ledger: input.family.conditions ?? [],
    raw: input.family,
    response_hash: createHash('sha256').update(JSON.stringify(input.family)).digest('hex'),
    requested_via_provider_id: input.requestedVia,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'authority_slug,principal_provider_id' }).select('id').single()
  if (familyError) throw familyError
  const familyId = (familyRow as { id: string }).id

  // Local follow-ons already waiting for any member now attach to it.
  const parents = members.map(member => {
    const id = idFor(member.id, member.reference)
    if (!id) return null
    const linkable = { id, reference: member.reference, description: member.description, procedure: member.procedure }
    return {
      id, authority_slug: council, reference_normalised: normaliseReference(member.reference),
      reference_core: canHeadFamily(linkable) ? referenceCore(member.reference)?.core ?? null : null,
    }
  }).filter(Boolean)
  const { error: resolveError } = await db.rpc('planning_resolve_family_parents', { p_rows: parents })
  if (resolveError) throw resolveError

  // Every key this family answers: each member's reference, and the case number of any member that
  // can head a family.
  const familyKeys = new Set<string>([input.lookup.parent_key])
  for (const member of members) {
    familyKeys.add(normaliseReference(member.reference))
    const linkable = { id: member.id, reference: member.reference, description: member.description, procedure: member.procedure }
    const core = referenceCore(member.reference)?.core
    if (core && canHeadFamily(linkable)) familyKeys.add(core)
  }

  const conflict = await findConflict(db, council, familyKeys, new Set(memberIds))

  const now = new Date().toISOString()
  const { error: closeError } = await db.from('planning_family_lookups').update({
    status: 'complete', fetched_at: now, family_id: familyId, conflict,
    review_state: conflict ? 'pending' : 'none', last_error: null, updated_at: now,
  }).eq('id', input.lookup.id)
  if (closeError) throw closeError
  const { data: closed, error: othersError } = await db.from('planning_family_lookups').update({
    status: 'complete', fetched_at: now, family_id: familyId, updated_at: now,
  }).eq('authority_slug', council).in('parent_key', [...familyKeys]).neq('id', input.lookup.id)
    .in('status', ['queued', 'deferred', 'failed']).select('id')
  if (othersError) throw othersError

  return {
    familyId, members: members.length, newApplications: fresh.length, links: linkRows.length,
    skippedRemovedLinks, lookupsClosed: 1 + (closed?.length ?? 0), conflict, memberIds,
  }
}

async function findConflict(
  db: PlanningAdminClient, council: string, familyKeys: Set<string>, memberIds: Set<string>
): Promise<FamilyConflict | null> {
  const { data: pointing, error: pointingError } = await db.from('planning_application_links')
    .select('child_application_id,parent_key').eq('authority_slug', council).in('parent_key', [...familyKeys])
    .eq('strength', 'strong').neq('source', 'plota_associated').is('removed_at', null)
  if (pointingError) throw pointingError
  const outsideIds = [...new Set((pointing ?? []).map(row => row.child_application_id as string).filter(id => !memberIds.has(id)))]

  const { data: fromMembers, error: membersError } = await db.from('planning_application_links')
    .select('child_application_id,parent_key').in('child_application_id', [...memberIds])
    .eq('strength', 'strong').neq('source', 'plota_associated').is('removed_at', null)
  if (membersError) throw membersError
  const elsewhere = (fromMembers ?? []).filter(row => !familyKeys.has(row.parent_key as string))

  if (outsideIds.length === 0 && elsewhere.length === 0) return null
  const ids = [...new Set([...outsideIds, ...elsewhere.map(row => row.child_application_id as string)])]
  const { data: references, error: referencesError } = await db.from('planning_applications').select('id,reference').in('id', ids)
  if (referencesError) throw referencesError
  const referenceOf = new Map((references ?? []).map(row => [row.id as string, row.reference as string]))
  return {
    localFollowOnsOutsideFamily: outsideIds.map(id => referenceOf.get(id) ?? id).sort(),
    membersLinkedElsewhere: elsewhere.map(row => ({ reference: referenceOf.get(row.child_application_id as string) ?? row.child_application_id as string, parentKey: row.parent_key as string })),
  }
}

export interface FamilyLookupRunOptions {
  /** Hard cap on requests in this run. */
  limit: number
  /** Requests the associated endpoint may use this calendar month, including earlier runs. */
  monthlyAllowance: number
  councils?: string[]
  /** Without commit the run only reports which families it would fetch. */
  commit: boolean
  admitToTier?: boolean
}

export interface FamilyLookupRunResult {
  usedThisMonthBefore: number
  planned: Array<{ lookupId: string; council: string; parentReference: string; via: string | null }>
  requestsMade: number
  stored: StoredFamilyResult[]
  failures: Array<{ lookupId: string; parentReference: string; error: string }>
  stoppedFor: 'allowance' | 'reserve' | 'rate_limit' | null
}

async function childToAsk(db: PlanningAdminClient, lookup: LookupRow): Promise<string | null> {
  const { data: links, error } = await db.from('planning_application_links').select('child_application_id')
    .eq('authority_slug', lookup.authority_slug).eq('parent_key', lookup.parent_key)
    .eq('strength', 'strong').is('removed_at', null)
  if (error) throw error
  const ids = [...new Set((links ?? []).map(row => row.child_application_id as string))]
  if (ids.length === 0) return null
  const { data: children, error: childrenError } = await db.from('planning_applications')
    .select('provider_id,source_kind,date_received').in('id', ids)
  if (childrenError) throw childrenError
  // Plota's family endpoint answers for live ids; prefer the most recent live follow-on.
  const ranked = [...(children ?? [])].sort((a, b) =>
    Number(b.source_kind === 'live') - Number(a.source_kind === 'live')
    || String(b.date_received ?? '').localeCompare(String(a.date_received ?? '')))
  return (ranked[0]?.provider_id as string | undefined) ?? null
}

export async function runFamilyLookups(
  db: PlanningAdminClient, client: Pick<PlotaClient, 'associated'>, options: FamilyLookupRunOptions
): Promise<FamilyLookupRunResult> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { count: used, error: usedError } = await db.from('planning_provider_usage').select('id', { count: 'exact', head: true })
    .eq('provider', 'plota').eq('endpoint', FAMILY_ENDPOINT).gte('occurred_at', monthStart.toISOString())
  if (usedError) throw usedError
  const { data: allowance, error: allowanceError } = await db.from('planning_provider_usage')
    .select('monthly_remaining').eq('provider', 'plota').gte('occurred_at', monthStart.toISOString())
    .not('monthly_remaining', 'is', null).order('occurred_at', { ascending: false }).limit(1).maybeSingle()
  if (allowanceError) throw allowanceError

  const result: FamilyLookupRunResult = {
    usedThisMonthBefore: used ?? 0, planned: [], requestsMade: 0, stored: [], failures: [], stoppedFor: null,
  }
  let remaining = typeof allowance?.monthly_remaining === 'number' ? allowance.monthly_remaining : null
  const budget = Math.min(options.limit, options.monthlyAllowance - result.usedThisMonthBefore)
  if (budget <= 0) { result.stoppedFor = 'allowance'; return result }

  let query = db.from('planning_family_lookups').select('id,authority_slug,parent_key,parent_reference,status,attempts')
    .in('status', ['queued', 'deferred']).order('priority', { ascending: false })
    .order('last_requested_at', { ascending: false }).limit(budget)
  if (options.councils?.length) query = query.in('authority_slug', options.councils)
  const { data: lookups, error: lookupsError } = await query
  if (lookupsError) throw lookupsError

  for (const lookup of (lookups ?? []) as LookupRow[]) {
    const via = await childToAsk(db, lookup)
    result.planned.push({ lookupId: lookup.id, council: lookup.authority_slug, parentReference: lookup.parent_reference, via })
    if (!options.commit) continue
    if (!via) {
      await db.from('planning_family_lookups').update({ status: 'failed', last_error: 'No stored follow-on to ask Plota about', updated_at: new Date().toISOString() }).eq('id', lookup.id)
      result.failures.push({ lookupId: lookup.id, parentReference: lookup.parent_reference, error: 'no stored follow-on' })
      continue
    }
    // Family lookups never spend the discovery reserve.
    if (!maySpendPlotaRequest(remaining)) { result.stoppedFor = 'reserve'; break }
    // A family stored by an earlier lookup in this run may already have closed this one.
    const { data: current } = await db.from('planning_family_lookups').select('status').eq('id', lookup.id).maybeSingle()
    if (current && current.status === 'complete') continue

    await db.from('planning_family_lookups').update({ status: 'processing', attempts: lookup.attempts + 1, updated_at: new Date().toISOString() }).eq('id', lookup.id)
    try {
      const { family, usage } = await client.associated(via)
      result.requestsMade++
      remaining = usage.monthlyRemaining ?? remaining
      await db.from('planning_provider_usage').insert({ provider: 'plota', endpoint: FAMILY_ENDPOINT, request_id: usage.requestId,
        monthly_limit: usage.monthlyLimit, monthly_remaining: usage.monthlyRemaining, status_code: 200 })
      const storedFamily = await storeFamily(db, { lookup, family, requestedVia: via, admitToTier: options.admitToTier })
      result.stored.push(storedFamily)
      // The paid part is done and stored; placing the family is repeatable, so its failure is logged
      // and never marks the lookup failed.
      if (planningMembershipEnabled()) {
        await assignMembershipsFor(db, storedFamily.memberIds, 'system:family-lookup')
          .catch(membershipError => console.error('[planning-membership] Failed to place a fetched family', membershipError))
      }
    } catch (error) {
      const status = error instanceof PlotaError ? error.status : null
      if (error instanceof PlotaError) {
        result.requestsMade++
        await db.from('planning_provider_usage').insert({ provider: 'plota', endpoint: FAMILY_ENDPOINT, request_id: error.requestId, status_code: error.status })
      }
      const message = error instanceof Error ? error.message : 'Family lookup failed'
      await db.from('planning_family_lookups').update({ status: status === 429 ? 'deferred' : 'failed', last_error: message, updated_at: new Date().toISOString() }).eq('id', lookup.id)
      result.failures.push({ lookupId: lookup.id, parentReference: lookup.parent_reference, error: message })
      if (status === 429) { result.stoppedFor = 'rate_limit'; break }
    }
  }
  return result
}

