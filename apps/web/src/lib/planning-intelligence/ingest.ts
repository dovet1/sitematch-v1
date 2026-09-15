import {
  buildAliasIndex,
  type AliasIndex,
  type BrandRow,
  type FasciaRow,
} from '@/lib/epc/aliases'
import { classificationInputHash, decideEligibility } from './eligibility'
import {
  LINKING_COLUMNS,
  linkStoredApplications,
  planningLinkingEnabled,
  referenceKeys,
  type LinkIngestResult,
  type StoredApplication,
} from './link-ingest'
import { assignMembershipsFor, clearLinkingPending, planningMembershipEnabled } from './membership-ingest'
import {
  buildSearchSpecs,
  maySpendPlotaRequest,
  REDUCED_SCOPE_ARCHIVE_FLOOR,
  type CensusScope,
  type PlotaClient,
} from './plota'
import type { PlanningAdminClient } from './db'
import type { PlotaApplication } from './types'

export type DiscoveryLane = 'late' | 'deep'

export interface SyncInput {
  db: PlanningAdminClient
  client: PlotaClient
  kind: 'discovery' | 'backfill' | 'refresh' | 'on_demand'
  scope: CensusScope
  dateFrom: string
  dateTo: string
  pageSize: number
  maxPages: number
  nations?: string[]
  councils?: string[]
  brandLimbEnabled?: boolean
  /**
   * Distinguishes one pass over a window from the next. Checkpoints are keyed by the window
   * they walk, and a finished checkpoint is skipped, which is what makes discovery resumable.
   * Refresh re-walks a window it has already completed, so without this it would find its own
   * `complete` checkpoint and do nothing, for ever. Two runs sharing a cycle key resume the
   * same walk; a new key starts a new one.
   */
  cycleKey?: string
  /**
   * A discovery lane re-reading older receipt dates for applications councils published late.
   * Each keeps checkpoints under its own prefix, so no lane resumes another's window, and each
   * stops at the protected reserve like refresh: a record paused by the reserve is still inside
   * the lookback next month. Lanes log their own run kind and never count as main discovery for
   * freshness, so a stopped main discovery cannot be hidden by a healthy lane.
   */
  lane?: DiscoveryLane
}

export interface SyncResult {
  runId: string
  status: 'complete' | 'partial'
  requestsMade: number
  recordsSeen: number
  recordsUpserted: number
  intelligenceRecords: number
  stoppedForReserve: boolean
  /** Present only when PLANNING_LINKING_ENABLED is on. A linking failure is counted, never thrown. */
  linking?: { pages: number; links: number; strongLinks: number; lookupsRequested: number; failures: number }
  /** Present only when PLANNING_MEMBERSHIP_ENABLED is also on. */
  membership?: { applied: number; held: number; failed: number; queuedClassifications: number }
}

function geometry(application: PlotaApplication): string | null {
  const lat = application.location?.lat
  const lng = application.location?.lng
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) return null
  return `POINT(${lng} ${lat})`
}

function rowFor(
  application: PlotaApplication,
  decision: ReturnType<typeof decideEligibility>,
  inputHash: string,
  preserveClassified: boolean,
  withReferenceKeys: boolean,
  awaitMembership = false
) {
  return {
    ...(withReferenceKeys ? referenceKeys(application.reference) : {}),
    // The classifier waits until linking has placed this application in its family (step 5).
    ...(awaitMembership ? { linking_state: 'pending' } : {}),
    provider: 'plota',
    provider_id: application.id,
    authority_slug: application.authority.slug,
    authority_name: application.authority.name,
    reference: application.reference,
    address: application.address ?? null,
    postcode: application.postcode ?? null,
    ward: application.ward ?? null,
    parish: application.parish ?? null,
    parish_code: application.parish_code ?? null,
    uprn: application.uprn == null ? null : String(application.uprn),
    description: application.description ?? '',
    category: application.category ?? null,
    categories: application.categories ?? [],
    planning_route: application.planning_route ?? null,
    procedure: application.procedure ?? null,
    stated_dwelling_count: application.dwelling_count ?? null,
    commercial: application.commercial ?? null,
    commercial_work: application.commercial_work ?? null,
    commercial_use_class: application.commercial_use_class ?? null,
    stated_floorspace_sqm: application.floorspace_sqm ?? null,
    status: application.status ?? null,
    stage: application.stage ?? null,
    decision: application.decision ?? null,
    appeal: application.appeal ?? null,
    date_received: application.date_received ?? null,
    date_validated: application.date_validated ?? null,
    date_decided: application.date_decided ?? null,
    key_dates: application.key_dates ?? {},
    location: geometry(application),
    location_precision: application.location?.precision ?? null,
    documents_count: application.documents_count ?? null,
    comments: application.comments ?? null,
    links: application.links ?? {},
    source_kind: application.source ?? null,
    raw: application,
    source_changed_at: application.changed_at ?? null,
    last_seen_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    input_hash: inputHash,
    eligibility_limbs: decision.limbs,
    brand_alias_hits: decision.brandHits,
    intelligence_tier: decision.intelligenceTier,
    classification_state: decision.intelligenceTier
      ? preserveClassified ? 'classified' : 'queued'
      : 'not_eligible',
    updated_at: new Date().toISOString(),
  }
}

/**
 * The stored row for an application that arrives outside a search page, such as a member of a Plota
 * family. Eligibility is recorded, but the row joins the intelligence tier only when asked:
 * membership of a family decides that from step 5 of the linking plan, not each member alone.
 */
export function storageRowFor(application: PlotaApplication, options: { admitToTier: boolean }) {
  const decision = decideEligibility(application)
  const row = rowFor(application, decision, classificationInputHash(application), false, true)
  return options.admitToTier ? row : { ...row, intelligence_tier: false, classification_state: 'not_eligible' }
}

async function allRows(db: PlanningAdminClient, table: string, columns: string) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999)
    if (error) throw error
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]))
    if ((data ?? []).length < 1000) return rows
  }
}

async function loadAliasIndex(db: PlanningAdminClient) {
  const [brands, fascias] = await Promise.all([
    allRows(db, 'brands', 'id,name'),
    allRows(db, 'fascias', 'id,name,brand_id'),
  ])
  return buildAliasIndex(brands as unknown as BrandRow[], fascias as unknown as FasciaRow[])
}

async function upsertApplications(
  db: PlanningAdminClient,
  applications: PlotaApplication[],
  aliases: AliasIndex,
  brandLimbEnabled: boolean,
  linking = false
): Promise<{ upserted: number; intelligence: number; stored: StoredApplication[] }> {
  if (applications.length === 0) return { upserted: 0, intelligence: 0, stored: [] }
  const identity = (authority: string, reference: string) => JSON.stringify([authority, reference])
  // One council reference can occur as both a live id and an archive id in a page.
  const unique = new Map<string, PlotaApplication>()
  for (const application of applications) {
    const key = identity(application.authority.slug, application.reference)
    const previous = unique.get(key)
    if (!previous || previous.source === 'historical' || application.source !== 'historical') {
      unique.set(key, application)
    }
  }
  applications = [...unique.values()]
  const providerIds = applications.map((application) => application.id)
  const columns = 'provider_id,authority_slug,reference,input_hash,classification_state,source:raw->>source'
  const { data: existing, error: existingError } = await db
    .from('planning_applications')
    .select(columns)
    .eq('provider', 'plota')
    .in('provider_id', providerIds)
  if (existingError) throw existingError
  const byId = new Map(
    (existing ?? []).map((row) => [row.provider_id as string, row as {
      provider_id: string
      authority_slug: string
      reference: string
      source: string | null
      input_hash: string
      classification_state: string
    }])
  )
  const unknown = applications.filter(application => !byId.has(application.id))
  const { data: sameReferences, error: referencesError } = unknown.length
    ? await db.from('planning_applications').select(columns).eq('provider', 'plota')
      .in('authority_slug', [...new Set(unknown.map(application => application.authority.slug))])
      .in('reference', [...new Set(unknown.map(application => application.reference))])
    : { data: [], error: null }
  if (referencesError) throw referencesError
  const byReference = new Map((sameReferences ?? []).map(row =>
    [identity(row.authority_slug, row.reference), row]))

  let intelligence = 0
  const byProviderRows: ReturnType<typeof rowFor>[] = []
  const byReferenceRows: ReturnType<typeof rowFor>[] = []
  for (const application of applications) {
    const providerMatch = byId.get(application.id)
    const referenceMatch = byReference.get(identity(application.authority.slug, application.reference))
    const prior = providerMatch ?? referenceMatch
    // The archive is sparser and can carry an older decision. Keep the existing live
    // record and its classification; receiving its historical twin is not an update.
    if (application.source === 'historical' && prior && prior.source !== 'historical') continue
    const decision = decideEligibility(application, aliases, { brandLimbEnabled })
    if (decision.intelligenceTier) intelligence++
    const hash = classificationInputHash(application)
    const preserveClassified = prior?.input_hash === hash && prior.classification_state === 'classified'
    const row = rowFor(application, decision, hash, preserveClassified, linking, linking && planningMembershipEnabled())
    if (!providerMatch && referenceMatch) byReferenceRows.push(row)
    else byProviderRows.push(row)
  }

  // Updating by the natural key retains the application's UUID and all Development
  // links when a live id replaces its archive id. Ordinary provider-id updates still
  // support corrected council references without inserting a duplicate application.
  const stored: StoredApplication[] = []
  for (const [rows, onConflict] of [
    [byProviderRows, 'provider,provider_id'],
    [byReferenceRows, 'authority_slug,reference'],
  ] as const) {
    if (!rows.length) continue
    if (!linking) {
      const { error } = await db.from('planning_applications').upsert(rows, { onConflict })
      if (error) throw error
      continue
    }
    // Linking needs the stored ids of what was just written.
    const { data, error } = await db.from('planning_applications').upsert(rows, { onConflict }).select(LINKING_COLUMNS)
    if (error) throw error
    stored.push(...((data ?? []) as StoredApplication[]))
  }
  return { upserted: byProviderRows.length + byReferenceRows.length, intelligence, stored }
}

async function recordCoverage(
  db: PlanningAdminClient,
  applications: PlotaApplication[],
  input: Pick<SyncInput, 'kind' | 'lane'>
) {
  const { kind } = input
  const authorities = new Map<string, { name: string; latest: string | null; count: number }>()
  for (const application of applications) {
    const current = authorities.get(application.authority.slug) ?? {
      name: application.authority.name,
      latest: null,
      count: 0,
    }
    current.count++
    if (application.date_received && (!current.latest || application.date_received > current.latest)) {
      current.latest = application.date_received
    }
    authorities.set(application.authority.slug, current)
  }
  const now = new Date().toISOString()
  for (const [slug, value] of authorities) {
    const row: Record<string, unknown> = {
      authority_slug: slug,
      authority_name: value.name,
      provider: 'plota',
      latest_observed_application_date: value.latest,
      freshness_state: 'fresh',
      last_error: null,
      updated_at: now,
    }
    if ((kind === 'discovery' && !input.lane) || kind === 'backfill') row.last_discovery_at = now
    if (kind === 'refresh') row.last_refresh_at = now
    const { error } = await db
      .from('planning_authority_coverage')
      .upsert(row, { onConflict: 'authority_slug' })
    if (error) throw error
  }
}

function checkpointKind(input: Pick<SyncInput, 'kind' | 'lane'>): string {
  return input.lane ? `${input.kind}-${input.lane}` : input.kind
}

/** Finish a saved discovery window before advancing its dates after midnight. */
async function resumeDiscovery(input: Omit<SyncInput, 'kind'>): Promise<SyncResult> {
  const kind = checkpointKind({ kind: 'discovery', lane: input.lane })
  const { data, error } = await input.db.from('planning_ingest_checkpoints')
    .select('scope_key,status').like('scope_key', `${kind}:${input.scope}:%`)
    .order('scope_key', { ascending: false }).limit(1000)
  if (error) throw error
  const rows = (data ?? []) as Array<{ scope_key: string; status: string }>
  const latest = rows[0]?.scope_key.split(':')
  if (latest) {
    const [, , dateFrom, dateTo] = latest
    const prefix = `${kind}:${input.scope}:${dateFrom}:${dateTo}:`
    const specs = buildSearchSpecs({ ...input, dateFrom, dateTo })
    if (!specs.every(spec => rows.some(row => row.scope_key === prefix + spec.key && row.status === 'complete'))) {
      input = { ...input, dateFrom, dateTo }
    }
  }
  return runPlotaSync({ ...input, kind: 'discovery' })
}

export function runPlotaDiscovery(input: Omit<SyncInput, 'kind' | 'lane'>): Promise<SyncResult> {
  return resumeDiscovery(input)
}

/**
 * Re-read older receipt dates for late-published applications. Plota's commercial, residential
 * and brand-evidence filters matched 95.8% of intelligence-tier records in a March-May sample
 * (the misses were amendments and condition discharges) at about a seventh of the full census,
 * so the lanes always run reduced.
 */
export function runPlotaLaneDiscovery(
  lane: DiscoveryLane,
  input: Omit<SyncInput, 'kind' | 'lane' | 'scope' | 'councils'>
): Promise<SyncResult> {
  return resumeDiscovery({ ...input, scope: 'reduced', lane })
}

export async function runPlotaSync(input: SyncInput): Promise<SyncResult> {
  if (input.lane && input.kind !== 'discovery') throw new Error('Only discovery has lanes')
  const useDiscoveryReserve = input.kind === 'discovery' && !input.lane
  const { data: run, error: runError } = await input.db
    .from('planning_ingest_runs')
    .insert({
      provider: 'plota',
      // Checkpoint keys use a hyphen; run kinds follow the table's underscore convention.
      kind: input.lane ? `discovery_${input.lane}` : input.kind,
      census_scope: input.scope,
      date_from: input.dateFrom,
      date_to: input.dateTo,
    })
    .select('id')
    .single()
  if (runError) throw runError

  const stats: Omit<SyncResult, 'runId' | 'status'> = {
    requestsMade: 0,
    recordsSeen: 0,
    recordsUpserted: 0,
    intelligenceRecords: 0,
    stoppedForReserve: false,
  }

  try {
    // Consult the latest allowance before spending, including on repeated invocations
    // after the reserve is reached. Ignore the previous month's reading after reset.
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const { data: allowance, error: allowanceError } = await input.db.from('planning_provider_usage')
      .select('monthly_remaining').eq('provider', 'plota').gte('occurred_at', monthStart.toISOString())
      .order('occurred_at', { ascending: false }).limit(1).maybeSingle()
    if (allowanceError) throw allowanceError
    const available = typeof allowance?.monthly_remaining === 'number' ? allowance.monthly_remaining : null
    stats.stoppedForReserve = !maySpendPlotaRequest(available, useDiscoveryReserve)
    const specs = buildSearchSpecs({
      scope: input.scope,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      pageSize: input.pageSize,
      nations: input.nations,
      councils: input.councils,
    })
    const aliases = await loadAliasIndex(input.db)
    const linking = planningLinkingEnabled()
    if (linking) stats.linking = { pages: 0, links: 0, strongLinks: 0, lookupsRequested: 0, failures: 0 }
    const membership = linking && planningMembershipEnabled()
    if (membership) stats.membership = { applied: 0, held: 0, failed: 0, queuedClassifications: 0 }
    let pagesLeft = input.maxPages
    let completeSpecs = 0

    for (const spec of specs) {
      if (pagesLeft <= 0 || stats.stoppedForReserve) break
      const scopeKey = [
        checkpointKind(input),
        input.scope,
        input.dateFrom,
        input.dateTo,
        ...(input.cycleKey ? [input.cycleKey] : []),
        spec.key,
      ].join(':')
      const { data: checkpoint, error: checkpointError } = await input.db
        .from('planning_ingest_checkpoints')
        .select('next_cursor,status,pages_complete,records_seen,parameters')
        .eq('scope_key', scopeKey)
        .maybeSingle()
      if (checkpointError) throw checkpointError
      if (checkpoint?.status === 'complete') {
        completeSpecs++
        continue
      }
      const savedLimit = Number(checkpoint?.parameters?.limit)
      if (Number.isInteger(savedLimit) && savedLimit > 0 && savedLimit < input.pageSize) {
        spec.params.limit = String(savedLimit)
      }

      let cursor = checkpoint?.next_cursor as string | null | undefined
      let pagesComplete = Number(checkpoint?.pages_complete) || 0
      let checkpointRecords = Number(checkpoint?.records_seen) || 0
      while (pagesLeft > 0) {
        const { error: markError } = await input.db
          .from('planning_ingest_checkpoints')
          .upsert({
            scope_key: scopeKey,
            provider: 'plota',
            parameters: spec.params,
            next_cursor: cursor ?? null,
            status: 'running',
            last_run_id: run.id,
            last_error: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'scope_key' })
        if (markError) throw markError

        const result = await input.client.search(cursor ? { ...spec.params, cursor } : spec.params)
        stats.requestsMade++
        pagesLeft--

        const { error: usageError } = await input.db.from('planning_provider_usage').insert({
          provider: 'plota',
          endpoint: '/v1/applications',
          request_id: result.usage.requestId,
          monthly_limit: result.usage.monthlyLimit,
          monthly_remaining: result.usage.monthlyRemaining,
          status_code: 200,
        })
        if (usageError) throw usageError

        // Live pages can advertise history before the archive is merged on a later page.
        // Only the terminal page can establish that the query omitted its archive. Never
        // mark that truncated census complete, but do follow a supplied continuation cursor.
        if (input.scope === 'full' && result.page.meta.historical_available === true &&
          !result.page.meta.next_cursor && result.page.meta.historical_included !== true) {
          const limit = Number(spec.params.limit)
          if (limit > 1 && result.page.data.length === limit) {
            // Plota can lose the archive continuation when the final live page is
            // exactly full. Re-read this cursor with one fewer row, without accepting
            // or advancing the ambiguous page. Persist the size for a bounded run's
            // next invocation; every attempt still counts against quota and page cap.
            spec.params = { ...spec.params, limit: String(limit - 1) }
            const { error: retryError } = await input.db.from('planning_ingest_checkpoints')
              .upsert({ scope_key: scopeKey, provider: 'plota', parameters: spec.params,
                next_cursor: cursor ?? null, status: 'pending', pages_complete: pagesComplete,
                records_seen: checkpointRecords, last_run_id: run.id,
                last_error: null, updated_at: new Date().toISOString(),
              }, { onConflict: 'scope_key' })
            if (retryError) throw retryError
            if (!maySpendPlotaRequest(result.usage.monthlyRemaining, useDiscoveryReserve)) {
              stats.stoppedForReserve = true
              break
            }
            continue
          }
          throw new Error('Plota withheld historical records at the end of this query. Check archive coverage or key entitlement before continuing.')
        }

        stats.recordsSeen += result.page.data.length
        const written = await upsertApplications(
          input.db,
          result.page.data,
          aliases,
          input.brandLimbEnabled ?? false,
          linking
        )
        stats.recordsUpserted += written.upserted
        stats.intelligenceRecords += written.intelligence
        if (stats.linking) {
          // Linking is evidence gathering; a failure here must not lose the page or stop ingestion.
          try {
            const linked: LinkIngestResult = await linkStoredApplications(input.db, written.stored)
            stats.linking.pages++
            stats.linking.links += linked.links
            stats.linking.strongLinks += linked.strongLinks
            stats.linking.lookupsRequested += linked.lookupsRequested
            if (stats.membership) {
              const assigned = await assignMembershipsFor(input.db, written.stored.map(row => row.id), 'system:ingestion')
              stats.membership.applied += assigned.applied
              stats.membership.held += assigned.held
              stats.membership.failed += assigned.failed.length
              stats.membership.queuedClassifications += assigned.queuedClassifications
              for (const failure of assigned.failed) console.error('[planning-membership] Family not applied', failure)
            }
          } catch (linkError) {
            stats.linking.failures++
            console.error('[planning-linking] Failed to link a page', linkError)
          } finally {
            // Clear the gate whatever happened: a failure should delay classification, never stop it.
            if (stats.membership) {
              await clearLinkingPending(input.db, written.stored.map(row => row.id))
                .catch(error => console.error('[planning-membership] Failed to clear the linking gate', error))
            }
          }
        }
        await recordCoverage(input.db, result.page.data, input)

        const next = result.page.meta.next_cursor ?? null
        const complete = next === null
        pagesComplete++
        checkpointRecords += result.page.data.length
        const { error: saveError } = await input.db
          .from('planning_ingest_checkpoints')
          .upsert({
            scope_key: scopeKey,
            provider: 'plota',
            parameters: spec.params,
            next_cursor: next,
            status: complete ? 'complete' : 'pending',
            pages_complete: pagesComplete,
            records_seen: checkpointRecords,
            last_run_id: run.id,
            last_error: null,
            updated_at: new Date().toISOString(),
            completed_at: complete ? new Date().toISOString() : null,
          }, { onConflict: 'scope_key' })
        if (saveError) throw saveError

        if (!maySpendPlotaRequest(result.usage.monthlyRemaining, useDiscoveryReserve)) {
          stats.stoppedForReserve = true
          break
        }
        if (complete) {
          completeSpecs++
          break
        }
        cursor = next
      }
    }

    const status = stats.stoppedForReserve || completeSpecs < specs.length ? 'partial' : 'complete'
    const { error: finishError } = await input.db
      .from('planning_ingest_runs')
      .update({
        status,
        requests_made: stats.requestsMade,
        records_seen: stats.recordsSeen,
        records_upserted: stats.recordsUpserted,
        intelligence_records: stats.intelligenceRecords,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id)
    if (finishError) throw finishError
    return { runId: run.id, status, ...stats }
  } catch (error) {
    await input.db
      .from('planning_ingest_runs')
      .update({
        status: stats.recordsUpserted > 0 ? 'partial' : 'failed',
        requests_made: stats.requestsMade,
        records_seen: stats.recordsSeen,
        records_upserted: stats.recordsUpserted,
        intelligence_records: stats.intelligenceRecords,
        error: error instanceof Error ? error.message : 'Unknown ingestion failure',
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id)
    throw error
  }
}

export interface RefreshCohort {
  windowStart: string
  windowEnd: string
  liveRecords: number
  oldestCheckedAt: string | null
}

export interface RefreshInput extends Omit<SyncInput, 'kind' | 'dateFrom' | 'dateTo'> {
  /** How many received-date months one run may re-walk. */
  cohortLimit: number
  cycleKey?: string
}

export interface RefreshResult {
  cycleKey: string
  cohorts: Array<RefreshCohort & { cycleKey: string; runId: string; status: SyncResult['status'] }>
  skipped: Array<RefreshCohort & { reason: string }>
  requestsMade: number
  recordsSeen: number
  recordsUpserted: number
  intelligenceRecords: number
  stoppedForReserve: boolean
}

/**
 * The received-date months holding undecided applications, least recently checked first.
 * See `planning_refresh_cohorts` for why cohorts are months rather than authorities.
 */
export async function selectRefreshCohorts(
  db: PlanningAdminClient,
  cohortLimit: number
): Promise<RefreshCohort[]> {
  const { data, error } = await db.rpc('planning_refresh_cohorts', { p_limit: cohortLimit })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    windowStart: String(row.window_start),
    windowEnd: String(row.window_end),
    liveRecords: Number(row.live_records) || 0,
    oldestCheckedAt: (row.oldest_checked_at as string | null) ?? null,
  }))
}

/**
 * Re-search the windows we already hold live records in, so a decision arriving after
 * discovery has moved on is still seen.
 *
 * Cohorts share one page budget rather than each getting a slice. A month with three
 * pages of results should not leave the next month unread because its allocation was spent
 * on empty pages, and the stalest cohort is first precisely so a short run helps most.
 */
export async function runPlotaRefresh(input: RefreshInput): Promise<RefreshResult> {
  // New walks start with today's key; unfinished walks retain their original key and
  // date range, even after midnight or when the current month has grown another day.
  const cycleKey = input.cycleKey ?? new Date().toISOString().slice(0, 10)
  const cohorts = await selectRefreshCohorts(input.db, input.cohortLimit)

  const result: RefreshResult = {
    cycleKey,
    cohorts: [],
    skipped: [],
    requestsMade: 0,
    recordsSeen: 0,
    recordsUpserted: 0,
    intelligenceRecords: 0,
    stoppedForReserve: false,
  }

  let pagesLeft = input.maxPages
  for (const cohort of cohorts) {
    if (pagesLeft <= 0 || result.stoppedForReserve) break
    // Plota documents commercial_work and dmin as live-only, and a reduced-scope search of a
    // pre-2026 window returns an incomplete answer rather than an error. Re-checking such a
    // window would read fewer records than we already hold and report success, so the
    // backfill path refuses it and refresh refuses it for the same reason. A full census has
    // no derived filter to lose, so it is allowed through.
    if (input.scope === 'reduced' && cohort.windowStart < REDUCED_SCOPE_ARCHIVE_FLOOR) {
      result.skipped.push({
        ...cohort,
        reason: `Reduced census cannot reliably re-search before ${REDUCED_SCOPE_ARCHIVE_FLOOR}`,
      })
      continue
    }
    const councils = input.councils
    const continuation = input.cycleKey ? null : await unfinishedRefresh({ ...input, councils }, cohort)
    const windowEnd = continuation?.windowEnd ?? cohort.windowEnd
    const run = await runPlotaSync({
      db: input.db,
      client: input.client,
      kind: 'refresh',
      scope: input.scope,
      dateFrom: cohort.windowStart,
      dateTo: windowEnd,
      pageSize: input.pageSize,
      maxPages: pagesLeft,
      nations: input.nations,
      councils,
      brandLimbEnabled: input.brandLimbEnabled,
      cycleKey: continuation?.cycleKey ?? cycleKey,
    })
    result.cohorts.push({ ...cohort, windowEnd, cycleKey: continuation?.cycleKey ?? cycleKey,
      runId: run.runId, status: run.status })
    result.requestsMade += run.requestsMade
    result.recordsSeen += run.recordsSeen
    result.recordsUpserted += run.recordsUpserted
    result.intelligenceRecords += run.intelligenceRecords
    result.stoppedForReserve = run.stoppedForReserve
    pagesLeft -= run.requestsMade
  }

  return result
}

/** Check the latest walk, including specs not started when its page budget ran out. */
async function unfinishedRefresh(input: RefreshInput, cohort: RefreshCohort) {
  const { data, error } = await input.db.from('planning_ingest_checkpoints')
    .select('scope_key,status')
    .like('scope_key', `refresh:${input.scope}:${cohort.windowStart}:%`)
    .order('scope_key', { ascending: false })
    .limit(1000)
  if (error) throw error
  const rows = (data ?? []) as Array<{ scope_key: string; status: string }>
  const walks = rows.map(row => {
    const parts = row.scope_key.split(':')
    return { windowEnd: parts[3], cycleKey: parts[4] }
  }).filter(walk => /^\d{4}-\d{2}-\d{2}$/.test(walk.cycleKey ?? ''))
  walks.sort((a, b) => b.cycleKey.localeCompare(a.cycleKey) || b.windowEnd.localeCompare(a.windowEnd))
  const latest = walks[0]
  if (!latest) return null
  const prefix = `refresh:${input.scope}:${cohort.windowStart}:${latest.windowEnd}:${latest.cycleKey}:`
  const expected = buildSearchSpecs({ scope: input.scope, dateFrom: cohort.windowStart,
    dateTo: latest.windowEnd, pageSize: input.pageSize, nations: input.nations, councils: input.councils })
  const complete = expected.every(spec => rows.some(row =>
    row.scope_key === prefix + spec.key && row.status === 'complete'))
  return complete ? null : latest
}
