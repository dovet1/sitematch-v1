import {
  buildAliasIndex,
  type AliasIndex,
  type BrandRow,
  type FasciaRow,
} from '@/lib/epc/aliases'
import { classificationInputHash, decideEligibility } from './eligibility'
import {
  buildSearchSpecs,
  maySpendPlotaRequest,
  REDUCED_SCOPE_ARCHIVE_FLOOR,
  type CensusScope,
  type PlotaClient,
} from './plota'
import type { PlanningAdminClient } from './db'
import type { PlotaApplication } from './types'

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
  brandLimbEnabled?: boolean
  /**
   * Distinguishes one pass over a window from the next. Checkpoints are keyed by the window
   * they walk, and a finished checkpoint is skipped, which is what makes discovery resumable.
   * Refresh re-walks a window it has already completed, so without this it would find its own
   * `complete` checkpoint and do nothing, for ever. Two runs sharing a cycle key resume the
   * same walk; a new key starts a new one.
   */
  cycleKey?: string
}

export interface SyncResult {
  runId: string
  status: 'complete' | 'partial'
  requestsMade: number
  recordsSeen: number
  recordsUpserted: number
  intelligenceRecords: number
  stoppedForReserve: boolean
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
  preserveClassified: boolean
) {
  return {
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
  brandLimbEnabled: boolean
): Promise<{ upserted: number; intelligence: number }> {
  if (applications.length === 0) return { upserted: 0, intelligence: 0 }
  const providerIds = applications.map((application) => application.id)
  const { data: existing, error: existingError } = await db
    .from('planning_applications')
    .select('provider_id,input_hash,classification_state')
    .eq('provider', 'plota')
    .in('provider_id', providerIds)
  if (existingError) throw existingError
  const byId = new Map(
    (existing ?? []).map((row) => [row.provider_id as string, row as {
      provider_id: string
      input_hash: string
      classification_state: string
    }])
  )

  let intelligence = 0
  const rows = applications.map((application) => {
    const decision = decideEligibility(application, aliases, { brandLimbEnabled })
    if (decision.intelligenceTier) intelligence++
    const hash = classificationInputHash(application)
    const prior = byId.get(application.id)
    const preserveClassified = prior?.input_hash === hash && prior.classification_state === 'classified'
    return rowFor(application, decision, hash, preserveClassified)
  })

  const { error } = await db
    .from('planning_applications')
    .upsert(rows, { onConflict: 'provider,provider_id' })
  if (error) throw error
  return { upserted: rows.length, intelligence }
}

async function recordCoverage(
  db: PlanningAdminClient,
  applications: PlotaApplication[],
  kind: SyncInput['kind']
) {
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
    if (kind === 'discovery' || kind === 'backfill') row.last_discovery_at = now
    if (kind === 'refresh') row.last_refresh_at = now
    const { error } = await db
      .from('planning_authority_coverage')
      .upsert(row, { onConflict: 'authority_slug' })
    if (error) throw error
  }
}

export async function runPlotaSync(input: SyncInput): Promise<SyncResult> {
  const { data: run, error: runError } = await input.db
    .from('planning_ingest_runs')
    .insert({
      provider: 'plota',
      kind: input.kind,
      census_scope: input.scope,
      date_from: input.dateFrom,
      date_to: input.dateTo,
    })
    .select('id')
    .single()
  if (runError) throw runError

  const stats = {
    requestsMade: 0,
    recordsSeen: 0,
    recordsUpserted: 0,
    intelligenceRecords: 0,
    stoppedForReserve: false,
  }

  try {
    const specs = buildSearchSpecs({
      scope: input.scope,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      pageSize: input.pageSize,
      nations: input.nations,
    })
    const aliases = await loadAliasIndex(input.db)
    let pagesLeft = input.maxPages
    let completeSpecs = 0

    for (const spec of specs) {
      if (pagesLeft <= 0 || stats.stoppedForReserve) break
      const scopeKey = [
        input.kind,
        input.scope,
        input.dateFrom,
        input.dateTo,
        ...(input.cycleKey ? [input.cycleKey] : []),
        spec.key,
      ].join(':')
      const { data: checkpoint, error: checkpointError } = await input.db
        .from('planning_ingest_checkpoints')
        .select('next_cursor,status,pages_complete,records_seen')
        .eq('scope_key', scopeKey)
        .maybeSingle()
      if (checkpointError) throw checkpointError
      if (checkpoint?.status === 'complete') {
        completeSpecs++
        continue
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

        stats.recordsSeen += result.page.data.length
        const written = await upsertApplications(
          input.db,
          result.page.data,
          aliases,
          input.brandLimbEnabled ?? false
        )
        stats.recordsUpserted += written.upserted
        stats.intelligenceRecords += written.intelligence
        await recordCoverage(input.db, result.page.data, input.kind)

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

        if (!maySpendPlotaRequest(result.usage.monthlyRemaining)) {
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
  cohorts: Array<RefreshCohort & { runId: string; status: SyncResult['status'] }>
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
  // The cycle key is the UTC date. Two refreshes on the same day resume one walk; tomorrow's
  // starts a fresh one over whatever is stalest then.
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
    const run = await runPlotaSync({
      db: input.db,
      client: input.client,
      kind: 'refresh',
      scope: input.scope,
      dateFrom: cohort.windowStart,
      dateTo: cohort.windowEnd,
      pageSize: input.pageSize,
      maxPages: pagesLeft,
      nations: input.nations,
      brandLimbEnabled: input.brandLimbEnabled,
      cycleKey,
    })
    result.cohorts.push({ ...cohort, runId: run.runId, status: run.status })
    result.requestsMade += run.requestsMade
    result.recordsSeen += run.recordsSeen
    result.recordsUpserted += run.recordsUpserted
    result.intelligenceRecords += run.intelligenceRecords
    result.stoppedForReserve = run.stoppedForReserve
    pagesLeft -= run.requestsMade
  }

  return result
}
