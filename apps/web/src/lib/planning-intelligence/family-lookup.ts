import { createHash } from 'crypto'
import type { PlanningAdminClient } from './db'
import { storageRowFor } from './ingest'
import { assignMembershipsFor, planningMembershipEnabled } from './membership-ingest'
import { canHeadFamily, familyKey, normaliseReference, referenceCore, type LinkableApplication, type LinkKind, sitesAgree } from './linking'
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
/** An original fetched by council and reference, because its family cannot be asked for by archive id. */
export const REFERENCE_ENDPOINT = '/v1/applications?council&reference'
const ARCHIVE_ID = /^h_/
// Failures worth one more try with the current code: an archive id Plota refused, and a "standalone"
// answer read as an invalid family before standalone answers fell back to the original.
const RECOVERABLE_FAILURE = /historical \(archive\) record id|invalid family shape/i
const MAX_RECOVERY_ATTEMPTS = 3
/** Plota links new applications into families some weeks after they arrive. */
const FAMILY_SETTLING_DAYS = 14

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
  /** Set when the disagreement was accepted without review because it is one scheme on one site. */
  resolution?: { rule: 'same_scheme'; at: string }
}

/**
 * Whether a disagreement with Plota is one scheme on one site, and so resolves itself (agreed
 * 14 October 2026). Plota leaves archive members out of its families (111 of the first 145 local
 * follow-ons it lacked were archive records, Springfield Hospital's eleven among them) and misses
 * some live ones, so a strong local citation it lacks is usually right. Every follow-on Plota lacks
 * and every other parent a member cites must be on the family's site, read across all its members;
 * one that plainly is not keeps the family for review. Families are one development per scheme, so a member citing an
 * earlier permission of the same site joins that history rather than conflicting with it.
 */
export function sameSchemeConflict(principal: LinkableApplication | null, members: LinkableApplication[], others: LinkableApplication[]): boolean {
  if (!principal) return false
  return sitesAgree([principal, ...members.filter(member => member.id !== principal.id), ...others])
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

  const familyKeys = familyKeysFor(input.lookup.parent_key, members)
  const conflict = await findConflict(db, council, familyKeys, new Set(memberIds), principalId)

  const now = new Date().toISOString()
  const { error: closeError } = await db.from('planning_family_lookups').update({
    status: 'complete', fetched_at: now, family_id: familyId, conflict,
    review_state: reviewStateFor(conflict), last_error: null, updated_at: now,
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

/** Every key a family answers: each member's reference, and the case number of any member that can head a family. */
function familyKeysFor(lookupKey: string, members: PlotaFamilyMember[]): Set<string> {
  const familyKeys = new Set<string>([lookupKey])
  for (const member of members) {
    familyKeys.add(normaliseReference(member.reference))
    const linkable = { id: member.id, reference: member.reference, description: member.description, procedure: member.procedure }
    const core = referenceCore(member.reference)?.core
    if (core && canHeadFamily(linkable)) familyKeys.add(core)
  }
  return familyKeys
}

function reviewStateFor(conflict: FamilyConflict | null): 'none' | 'pending' | 'resolved' {
  return !conflict ? 'none' : conflict.resolution ? 'resolved' : 'pending'
}

const SITE_COLUMNS = 'id,reference,address,postcode,uprn'

async function findConflict(
  db: PlanningAdminClient, council: string, familyKeys: Set<string>, memberIds: Set<string>, principalId: string | null
): Promise<FamilyConflict | null> {
  const { data: pointing, error: pointingError } = await db.from('planning_application_links')
    .select('child_application_id,parent_key').eq('authority_slug', council).in('parent_key', [...familyKeys])
    .eq('strength', 'strong').neq('source', 'plota_associated').is('removed_at', null)
  if (pointingError) throw pointingError
  const outsideIds = [...new Set((pointing ?? []).map(row => row.child_application_id as string).filter(id => !memberIds.has(id)))]

  const { data: fromMembers, error: membersError } = await db.from('planning_application_links')
    .select('child_application_id,parent_key,parent_application_id').in('child_application_id', [...memberIds])
    .eq('strength', 'strong').neq('source', 'plota_associated').is('removed_at', null)
  if (membersError) throw membersError
  const elsewhere = (fromMembers ?? []).filter(row => !familyKeys.has(row.parent_key as string))

  if (outsideIds.length === 0 && elsewhere.length === 0) return null
  const otherParentIds = elsewhere.map(row => row.parent_application_id as string | null).filter((id): id is string => Boolean(id))
  const ids = [...new Set([...outsideIds, ...memberIds, ...otherParentIds, ...(principalId ? [principalId] : [])])]
  const { data: sites, error: sitesError } = await db.from('planning_applications').select(SITE_COLUMNS).in('id', ids)
  if (sitesError) throw sitesError
  const siteOf = new Map(((sites ?? []) as LinkableApplication[]).map(row => [row.id, row]))
  const referenceOf = (id: string) => siteOf.get(id)?.reference ?? id
  const conflict: FamilyConflict = {
    localFollowOnsOutsideFamily: outsideIds.map(referenceOf).sort(),
    membersLinkedElsewhere: elsewhere.map(row => ({ reference: referenceOf(row.child_application_id as string), parentKey: row.parent_key as string })),
  }
  // An other parent we do not hold has no site to compare; the member citing it is Plota's own.
  const others = [...outsideIds, ...otherParentIds].map(id => siteOf.get(id)).filter((row): row is LinkableApplication => Boolean(row))
  const memberSites = [...memberIds].map(id => siteOf.get(id)).filter((row): row is LinkableApplication => Boolean(row))
  if (sameSchemeConflict(principalId ? siteOf.get(principalId) ?? null : null, memberSites, others)) {
    conflict.resolution = { rule: 'same_scheme', at: new Date().toISOString() }
  }
  return conflict
}

export interface ConflictRecheck {
  lookupId: string
  council: string
  parentReference: string
  before: FamilyConflict | null
  after: FamilyConflict | null
  reviewState: 'none' | 'pending' | 'resolved'
}

/**
 * Re-reads every family awaiting review against the current links and rules. A family whose
 * disagreement is now one scheme on one site, or has gone (a link re-checked as weak), is released;
 * the rest stay pending. Dry run unless `commit`.
 */
export async function recheckPendingConflicts(
  db: PlanningAdminClient, options: { councils: string[]; commit: boolean }
): Promise<ConflictRecheck[]> {
  const { data: rows, error } = await db.from('planning_family_lookups')
    .select('id,authority_slug,parent_key,parent_reference,family_id,conflict')
    .eq('review_state', 'pending').in('authority_slug', options.councils)
  if (error) throw error
  const results: ConflictRecheck[] = []
  for (const row of (rows ?? []) as Array<{ id: string; authority_slug: string; parent_key: string; parent_reference: string; family_id: string | null; conflict: FamilyConflict | null }>) {
    if (!row.family_id) continue
    const { data: family, error: familyError } = await db.from('planning_families')
      .select('principal_application_id,raw').eq('id', row.family_id).single()
    if (familyError) throw familyError
    const { principal_application_id: principalId, raw } = family as { principal_application_id: string | null; raw: PlotaFamily }
    const members = membersOf(raw).filter(member => member.authority?.slug === row.authority_slug)
    const stored = await storedMembers(db, row.authority_slug, members)
    const memberIds = new Set(members.map(member => stored.find(candidate => sameMember(candidate, member.id, member.reference))?.id)
      .filter((id): id is string => Boolean(id)))
    const after = await findConflict(db, row.authority_slug, familyKeysFor(row.parent_key, members), memberIds, principalId)
    const reviewState = reviewStateFor(after)
    results.push({ lookupId: row.id, council: row.authority_slug, parentReference: row.parent_reference, before: row.conflict, after, reviewState })
    if (options.commit && reviewState !== 'pending') {
      const { error: updateError } = await db.from('planning_family_lookups')
        .update({ conflict: after, review_state: reviewState, updated_at: new Date().toISOString() }).eq('id', row.id)
      if (updateError) throw updateError
    }
  }
  return results
}

export interface StoredOriginalResult {
  lookupId: string
  parentReference: string
  applicationId: string
  providerId: string
  followOnsAttached: number
}

/**
 * Stores an original fetched by reference and attaches the follow-ons waiting for it, which closes
 * every lookup it answers. The lookup that fetched it is closed here: it was processing, which the
 * attaching function leaves alone.
 */
export async function storeOriginal(
  db: PlanningAdminClient,
  input: { lookup: LookupRow; application: PlotaApplication; admitToTier?: boolean }
): Promise<StoredOriginalResult> {
  const council = input.lookup.authority_slug
  type Original = { id: string; reference: string; description: string | null; procedure: string | null }
  const columns = 'id,reference,description,procedure'
  // The original may already be stored under another archive id (Wandsworth 2025/2541); a council
  // holds one record per reference, so that record is the original.
  const { data: existing, error: existingError } = await db.from('planning_applications').select(columns)
    .eq('authority_slug', council).eq('reference_normalised', normaliseReference(input.application.reference)).limit(1).maybeSingle()
  if (existingError) throw existingError
  let original = existing as Original | null
  if (!original) {
    const row = storageRowFor({ ...input.application, retrieved_via: 'reference' } as PlotaApplication, { admitToTier: input.admitToTier ?? false })
    const { error } = await db.from('planning_applications').upsert([row], { onConflict: 'provider,provider_id', ignoreDuplicates: true })
    if (error) throw error
    const { data: stored, error: storedError } = await db.from('planning_applications').select(columns)
      .eq('provider', 'plota').eq('provider_id', input.application.id).single()
    if (storedError) throw storedError
    original = stored as Original
  }

  const { error: resolveError } = await db.rpc('planning_resolve_family_parents', { p_rows: [{
    id: original.id, authority_slug: council, reference_normalised: normaliseReference(original.reference),
    reference_core: canHeadFamily(original) ? referenceCore(original.reference)?.core ?? null : null,
  }] })
  if (resolveError) throw resolveError
  // The function returns the lookups it closed, not the links it attached; count those directly.
  const { count: attached, error: attachedError } = await db.from('planning_application_links').select('id', { count: 'exact', head: true })
    .eq('parent_application_id', original.id).is('removed_at', null)
  if (attachedError) throw attachedError

  const now = new Date().toISOString()
  const { error: closeError } = await db.from('planning_family_lookups').update({
    status: 'resolved_locally', fetched_at: now, last_error: null, updated_at: now,
  }).eq('id', input.lookup.id)
  if (closeError) throw closeError
  return {
    lookupId: input.lookup.id, parentReference: input.lookup.parent_reference, applicationId: original.id,
    providerId: input.application.id, followOnsAttached: attached ?? 0,
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
  /** Re-queue lookups that failed on an archive id or a standalone answer, which the run now recovers. */
  retryArchiveFailures?: boolean
  admitToTier?: boolean
}

export interface FamilyLookupRunResult {
  usedThisMonthBefore: number
  planned: Array<{ lookupId: string; council: string; parentReference: string; via: string | null }>
  requestsMade: number
  stored: StoredFamilyResult[]
  /** Originals fetched by reference because their only follow-ons are archive records. */
  originals: StoredOriginalResult[]
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
  // Plota's family endpoint answers for live ids, and links a new application into its family only
  // after a few weeks: a two-week-old discharge at Central Bedfordshire came back standalone while an
  // older one returned all 14 members. Prefer the most recent live follow-on that has settled.
  const settled = new Date(Date.now() - FAMILY_SETTLING_DAYS * 86_400_000).toISOString().slice(0, 10)
  const hasSettled = (row: { date_received?: unknown }) => Number(String(row.date_received ?? '9999') <= settled)
  const ranked = [...(children ?? [])].sort((a, b) =>
    Number(b.source_kind === 'live') - Number(a.source_kind === 'live')
    || hasSettled(b) - hasSettled(a)
    || String(b.date_received ?? '').localeCompare(String(a.date_received ?? '')))
  return (ranked[0]?.provider_id as string | undefined) ?? null
}

export async function runFamilyLookups(
  db: PlanningAdminClient, client: Pick<PlotaClient, 'associated' | 'findByReference'>, options: FamilyLookupRunOptions
): Promise<FamilyLookupRunResult> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { count: used, error: usedError } = await db.from('planning_provider_usage').select('id', { count: 'exact', head: true })
    .eq('provider', 'plota').in('endpoint', [FAMILY_ENDPOINT, REFERENCE_ENDPOINT]).gte('occurred_at', monthStart.toISOString())
  if (usedError) throw usedError
  const { data: allowance, error: allowanceError } = await db.from('planning_provider_usage')
    .select('monthly_remaining').eq('provider', 'plota').gte('occurred_at', monthStart.toISOString())
    .not('monthly_remaining', 'is', null).order('occurred_at', { ascending: false }).limit(1).maybeSingle()
  if (allowanceError) throw allowanceError

  const result: FamilyLookupRunResult = {
    usedThisMonthBefore: used ?? 0, planned: [], requestsMade: 0, stored: [], originals: [], failures: [], stoppedFor: null,
  }
  let remaining = typeof allowance?.monthly_remaining === 'number' ? allowance.monthly_remaining : null
  const budget = Math.min(options.limit, options.monthlyAllowance - result.usedThisMonthBefore)
  if (budget <= 0) { result.stoppedFor = 'allowance'; return result }

  if (options.retryArchiveFailures && options.commit) {
    let failed = db.from('planning_family_lookups').select('id,authority_slug,last_error,attempts').eq('status', 'failed')
    if (options.councils?.length) failed = failed.in('authority_slug', options.councils)
    const { data: failedRows, error: failedError } = await failed
    if (failedError) throw failedError
    // A few tries each: a lookup that keeps failing the same way is not retried batch after batch.
    const retry = ((failedRows ?? []) as Array<{ id: string; last_error: string | null; attempts: number | null }>)
      .filter(row => RECOVERABLE_FAILURE.test(row.last_error ?? '') && (row.attempts ?? 0) < MAX_RECOVERY_ATTEMPTS)
    if (retry.length) {
      const { error: retryError } = await db.from('planning_family_lookups')
        .update({ status: 'queued', updated_at: new Date().toISOString() }).in('id', retry.map(row => row.id))
      if (retryError) throw retryError
    }
  }

  let query = db.from('planning_family_lookups').select('id,authority_slug,parent_key,parent_reference,status,attempts')
    .in('status', ['queued', 'deferred']).gt('priority', 0).order('priority', { ascending: false })
    .order('last_requested_at', { ascending: false }).limit(budget)
  if (options.councils?.length) query = query.in('authority_slug', options.councils)
  const { data: lookups, error: lookupsError } = await query
  if (lookupsError) throw lookupsError

  for (const lookup of (lookups ?? []) as LookupRow[]) {
    const via = await childToAsk(db, lookup)
    result.planned.push({ lookupId: lookup.id, council: lookup.authority_slug, parentReference: lookup.parent_reference, via })
    if (!options.commit) continue
    // A standalone answer costs a second request for the original; the allowance counts requests.
    // Reaching the run's own limit is a normal end; only the monthly allowance is a stop.
    if (result.requestsMade >= budget) {
      if (options.monthlyAllowance - result.usedThisMonthBefore <= options.limit) result.stoppedFor = 'allowance'
      break
    }
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
    let endpoint = FAMILY_ENDPOINT
    try {
      // The original itself, by council and reference: one request, and no family to compare.
      const fetchOriginal = async () => {
        endpoint = REFERENCE_ENDPOINT
        const { application, usage } = await client.findByReference(lookup.authority_slug, lookup.parent_reference)
        result.requestsMade++
        remaining = usage.monthlyRemaining ?? remaining
        await db.from('planning_provider_usage').insert({ provider: 'plota', endpoint: REFERENCE_ENDPOINT, request_id: usage.requestId,
          monthly_limit: usage.monthlyLimit, monthly_remaining: usage.monthlyRemaining, status_code: 200 })
        if (!application) throw new Error('Plota holds no application with this reference')
        const original = await storeOriginal(db, { lookup, application, admitToTier: options.admitToTier })
        result.originals.push(original)
        if (planningMembershipEnabled()) {
          await assignMembershipsFor(db, [original.applicationId], 'system:family-lookup')
            .catch(membershipError => console.error('[planning-membership] Failed to place a fetched original', membershipError))
        }
      }
      // Plota answers families only for live ids; when the only follow-ons are archive records, the
      // original is fetched instead.
      if (ARCHIVE_ID.test(via)) { await fetchOriginal(); continue }
      const { family, usage } = await client.associated(via)
      result.requestsMade++
      remaining = usage.monthlyRemaining ?? remaining
      await db.from('planning_provider_usage').insert({ provider: 'plota', endpoint: FAMILY_ENDPOINT, request_id: usage.requestId,
        monthly_limit: usage.monthlyLimit, monthly_remaining: usage.monthlyRemaining, status_code: 200 })
      // Not yet in a Plota family: the original is still worth having, within the same allowance.
      if (!family) {
        if (result.requestsMade >= budget || !maySpendPlotaRequest(remaining)) throw new Error('Plota has not linked this application to a family yet')
        await fetchOriginal()
        continue
      }
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
        await db.from('planning_provider_usage').insert({ provider: 'plota', endpoint, request_id: error.requestId, status_code: error.status })
      }
      // A database error is a plain object with a message, not an Error.
      const message = error instanceof Error ? error.message
        : typeof (error as { message?: unknown } | null)?.message === 'string' ? (error as { message: string }).message
        : 'Family lookup failed'
      await db.from('planning_family_lookups').update({ status: status === 429 ? 'deferred' : 'failed', last_error: message, updated_at: new Date().toISOString() }).eq('id', lookup.id)
      result.failures.push({ lookupId: lookup.id, parentReference: lookup.parent_reference, error: message })
      if (status === 429) { result.stoppedFor = 'rate_limit'; break }
    }
  }
  return result
}

