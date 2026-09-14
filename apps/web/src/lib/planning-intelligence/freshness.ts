import type { PlanningAdminClient } from './db'

/**
 * Discovery is scheduled daily. Thirty-six hours is a full missed run plus enough slack that
 * a late or retried one does not read as an outage.
 */
export const DISCOVERY_STALE_AFTER_HOURS = 36

/**
 * Refresh re-checks the three stalest received-date months once a week, so every month
 * holding undecided records comes round inside five weeks while there are fewer than fifteen
 * of them. Past that the cycle is genuinely too slow for the cadence, which is what this
 * threshold is meant to surface. Recalculate it if either number changes.
 */
export const LIVE_CHECK_STALE_AFTER_DAYS = 35

export type PlanningStaleReason =
  | 'never_ingested'
  | 'discovery_overdue'
  | 'refresh_overdue'
  /** The status read itself failed, so currency could not be established either way. */
  | 'freshness_unavailable'

export interface PlanningFreshness {
  /** When ingestion last looked for applications that are new to us. */
  lastDiscoveryAt: string | null
  /** When it last re-checked applications it already had. */
  lastRefreshAt: string | null
  /** The oldest verification of a record that can still change. */
  oldestLiveCheckedAt: string | null
  latestApplicationDate: string | null
  stale: boolean
  staleReason: PlanningStaleReason | null
}

interface PipelineStatusDocument {
  coverage?: { last_discovery_at?: string | null; last_refresh_at?: string | null } | null
  freshness?: {
    oldest_live_checked_at?: string | null
    latest_application_date?: string | null
  } | null
  [key: string]: unknown
}

function hoursSince(iso: string | null, now: number): number | null {
  if (!iso) return null
  const at = Date.parse(iso)
  return Number.isFinite(at) ? (now - at) / 3_600_000 : null
}

/**
 * Turn the raw status document into the one judgement a caller needs: whether what it is
 * about to show can be trusted as current.
 *
 * The two failures are separate and a single "last updated" timestamp hides one of them.
 * Discovery stopping means new applications are missing entirely. Refresh falling behind
 * means the applications on screen are present but their decisions are out of date, which
 * looks like healthy data right up until someone acts on it.
 */
export function deriveFreshness(
  status: PipelineStatusDocument,
  now: number = Date.now()
): PlanningFreshness {
  const lastDiscoveryAt = status.coverage?.last_discovery_at ?? null
  const lastRefreshAt = status.coverage?.last_refresh_at ?? null
  const oldestLiveCheckedAt = status.freshness?.oldest_live_checked_at ?? null

  const discoveryAge = hoursSince(lastDiscoveryAt, now)
  const liveCheckAge = hoursSince(oldestLiveCheckedAt, now)

  let staleReason: PlanningStaleReason | null = null
  if (discoveryAge === null) staleReason = 'never_ingested'
  else if (discoveryAge > DISCOVERY_STALE_AFTER_HOURS) staleReason = 'discovery_overdue'
  else if (liveCheckAge !== null && liveCheckAge > LIVE_CHECK_STALE_AFTER_DAYS * 24) {
    staleReason = 'refresh_overdue'
  }

  return {
    lastDiscoveryAt,
    lastRefreshAt,
    oldestLiveCheckedAt,
    latestApplicationDate: status.freshness?.latest_application_date ?? null,
    stale: staleReason !== null,
    staleReason,
  }
}

export async function readPipelineStatus(
  db: PlanningAdminClient
): Promise<PipelineStatusDocument> {
  const { data, error } = await db.rpc('planning_pipeline_status')
  if (error) throw error
  return (data ?? {}) as PipelineStatusDocument
}

/**
 * What a caller shows when it could not find out. Stale, because "we did not check" and
 * "it is current" must never render the same way, and only one of them is safe to assume.
 */
export const FRESHNESS_UNAVAILABLE: PlanningFreshness = {
  lastDiscoveryAt: null,
  lastRefreshAt: null,
  oldestLiveCheckedAt: null,
  latestApplicationDate: null,
  stale: true,
  staleReason: 'freshness_unavailable',
}

/**
 * Freshness is measured across the whole store rather than the boundary being read. A
 * per-boundary figure would be more precise and costs a second spatial aggregate on every
 * lookup; ingestion is national and runs on one schedule, so the national answer is the same
 * answer nearly always. Revisit this if coverage ever becomes regional.
 *
 * It reads the four values it needs directly instead of calling `planning_pipeline_status`.
 * That report also counts every stored application exactly, and once the national backfill
 * landed (~630,000 rows) it hit the statement timeout on every call, so every lookup showed
 * "freshness unavailable". Measured on 14 Sep 2026: the report timed out at 8.1 s; these four
 * index-backed reads took 87-310 ms each.
 */
export async function readPlanningFreshness(
  db: PlanningAdminClient
): Promise<PlanningFreshness> {
  const newest = (column: 'last_discovery_at' | 'last_refresh_at') => db
    .from('planning_authority_coverage').select(column)
    .not(column, 'is', null).order(column, { ascending: false }).limit(1)
  const [discovery, refresh, liveChecked, latest] = await Promise.all([
    newest('last_discovery_at'),
    newest('last_refresh_at'),
    // Matches planning_applications_live_checked_status_idx, so the minimum is an index endpoint.
    db.from('planning_applications').select('last_checked_at')
      .or('stage.is.null,stage.in.(pending,other)')
      .order('last_checked_at', { ascending: true }).limit(1),
    db.from('planning_applications').select('date_received')
      .not('date_received', 'is', null)
      .order('date_received', { ascending: false }).limit(1),
  ])
  for (const result of [discovery, refresh, liveChecked, latest]) if (result.error) throw result.error
  const first = <T>(data: unknown) => ((data as T[] | null) ?? [])[0]
  return deriveFreshness({
    coverage: {
      last_discovery_at: first<{ last_discovery_at: string | null }>(discovery.data)?.last_discovery_at ?? null,
      last_refresh_at: first<{ last_refresh_at: string | null }>(refresh.data)?.last_refresh_at ?? null,
    },
    freshness: {
      oldest_live_checked_at: first<{ last_checked_at: string | null }>(liveChecked.data)?.last_checked_at ?? null,
      latest_application_date: first<{ date_received: string | null }>(latest.data)?.date_received ?? null,
    },
  })
}
