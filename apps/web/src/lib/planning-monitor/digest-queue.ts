import 'server-only'

import { createPlanningAdminClient, type PlanningAdminClient } from '@/lib/planning-intelligence/db'
import { FRESHNESS_UNAVAILABLE, readPlanningFreshness } from '@/lib/planning-intelligence/freshness'
import { isPlanningMonitorAiEnabled, isPlanningMonitorEmailEnabled } from '@/lib/feature-flags'
import { buildPredicate, parseCriteria, type MonitorCriteria } from './criteria'
import {
  addDays,
  categoriseChanges,
  countChanges,
  periodDates,
  evidencePacket,
  rankChanges,
  toHighlight,
  type CategorisedChange,
  type ChangeEvent,
} from './digest-select'
import {
  DIGEST_PROMPT_VERSION,
  buildUserPrompt,
  deterministicSummary,
  summariseWithModel,
  validateSummary,
} from './digest-summary'
import type { PatchGeometry } from './geometry'
import { loadWatches, mapRow } from './service'
import type { DigestReport, DigestSummary, MonitorPatch, MonitorRow } from './types'

/**
 * Briefing jobs. The scheduler enqueues; workers claim one run at a time under a lease, freeze the
 * evidence, write the report, and (for scheduled runs) create one delivery per recipient. A run is
 * never regenerated once generated: the report a user opened from an email is the report they get.
 */

const SUMMARY_HIGHLIGHTS = 5
const REPORT_HIGHLIGHTS = 25
/** How long a scheduled run waits for a stale source to recover before issuing a labelled partial report. */
export const COVERAGE_RECOVERY_HOURS = 12
const PREVIEW_DEBOUNCE_MS = 90_000
const MATERIAL_EVENT_KINDS = ['observed', 'stage_changed', 'decided', 'description_changed', 'dwellings_changed', 'dwellings_reviewed']

function monthlyBudgetUsd(): number {
  const value = Number(process.env.PLANNING_MONITOR_MONTHLY_BUDGET_USD)
  return Number.isFinite(value) && value >= 0 ? value : 10
}

/** Queue the first briefing after a save, or one replacement preview after an edit. */
export async function enqueueBriefing(patch: MonitorPatch, kind: 'initial' | 'preview', db: PlanningAdminClient = createPlanningAdminClient()) {
  if (!patch.revisionId) throw new Error('Patch has no revision')
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 86_400_000)
  if (kind === 'preview') {
    // Only the latest edit gets a preview; earlier queued previews for this patch are cancelled.
    await db.from('planning_monitor_digest_runs').update({ status: 'cancelled' }).eq('patch_id', patch.id).eq('kind', 'preview').eq('status', 'queued')
  }
  const fmt = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }).format(d)
  const { data, error } = await db
    .from('planning_monitor_digest_runs')
    .insert({
      patch_id: patch.id,
      revision_id: patch.revisionId,
      subscription_id: patch.subscription?.id ?? null,
      kind,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      period_label: `${fmt(start)} – ${fmt(end)} (last 7 days)`,
      not_before: new Date(Date.now() + (kind === 'preview' ? PREVIEW_DEBOUNCE_MS : 0)).toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

interface RunRecord {
  id: string
  patch_id: string
  revision_id: string
  subscription_id: string | null
  kind: 'initial' | 'preview' | 'scheduled'
  period_start: string
  period_end: string
  period_label: string
  attempts: number
  lease_owner: string | null
  created_at: string
}

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, max = 20_000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

/** Matched rows (applications mode) for a predicate, all pages. */
async function matchedRows(db: PlanningAdminClient, predicate: Record<string, unknown>, watched: Awaited<ReturnType<typeof loadWatches>>): Promise<MonitorRow[]> {
  const rows: MonitorRow[] = []
  let afterDate: string | null = null
  let afterKey: string | null = null
  for (let page = 0; page < 50; page++) {
    const { data, error } = await db.rpc('planning_monitor_rows', {
      p: predicate, p_grouping: 'applications', p_after_date: afterDate, p_after_key: afterKey, p_limit: 200,
    })
    if (error) throw error
    const records = (data ?? []) as Parameters<typeof mapRow>[0][]
    rows.push(...records.map((r) => mapRow(r, watched.applications, watched.developments)))
    if (records.length < 200) break
    const last = records[records.length - 1]
    afterDate = last.sort_date ?? '0001-01-01'
    afterKey = last.row_key
  }
  return rows
}

async function loadEvents(db: PlanningAdminClient, start: string, end: string): Promise<ChangeEvent[]> {
  const records = await readAll<{ kind: ChangeEvent['kind']; planning_application_id: string | null; development_id: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; observed_at: string }>(
    (from, to) => db.from('planning_change_events')
      .select('kind, planning_application_id, development_id, before, after, observed_at')
      .gte('observed_at', start).lt('observed_at', end)
      .in('kind', MATERIAL_EVENT_KINDS)
      .order('observed_at', { ascending: true }).order('id', { ascending: true })
      .range(from, to),
    100_000
  )
  return records.map((r) => ({ kind: r.kind, applicationId: r.planning_application_id, developmentId: r.development_id, before: r.before, after: r.after, observedAt: r.observed_at }))
}

async function applicationIdsForDevelopments(db: PlanningAdminClient, developmentIds: string[]): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < developmentIds.length; i += 200) {
    const { data, error } = await db.from('development_applications').select('planning_application_id').in('development_id', developmentIds.slice(i, i + 200))
    if (error) throw error
    ids.push(...(data ?? []).map((r) => r.planning_application_id as string))
  }
  return ids
}

export interface FrozenSelection {
  changes: CategorisedChange[]
  events: number
  candidates: number
}

/**
 * The records this report may speak about.
 * - scheduled: every record with a material event in the period, plus every record decided in the
 *   period (covers the ledger's first weeks), evaluated against the patch's non-temporal predicate.
 *   The map's received-date window does not apply.
 * - initial/preview: a snapshot of matching records received or decided in the last seven days.
 * Watched records with changes are included even when they no longer pass the patch's filters.
 */
export async function selectChanges(
  db: PlanningAdminClient,
  input: { userId: string; criteria: MonitorCriteria; geometry: PatchGeometry; run: Pick<RunRecord, 'kind' | 'period_start' | 'period_end'> }
): Promise<FrozenSelection> {
  const watches = await loadWatches(db, input.userId)
  const base = buildPredicate(input.criteria, { boundary: input.geometry, watchedApplicationIds: watches.applicationIds, applyDates: false })
  // The RPC's date range is inclusive, so the last day is the day before the exclusive end.
  const { startDate, endDate: endExclusive } = periodDates(input.run.period_start, input.run.period_end)
  const endDate = addDays(endExclusive, -1)

  const byId = new Map<string, MonitorRow>()
  const add = (rows: MonitorRow[]) => rows.forEach((r) => byId.set(r.applicationId, r))
  let events: ChangeEvent[] = []

  add(await matchedRows(db, { ...base, date_field: 'decided', date_from: startDate, date_to: endDate }, watches))
  if (input.run.kind === 'scheduled') {
    events = await loadEvents(db, input.run.period_start, input.run.period_end)
    const devIds = [...new Set(events.filter((e) => !e.applicationId && e.developmentId).map((e) => e.developmentId as string))]
    const ids = [...new Set([...events.map((e) => e.applicationId).filter((id): id is string => Boolean(id)), ...(await applicationIdsForDevelopments(db, devIds))])]
    for (let i = 0; i < ids.length; i += 1000) add(await matchedRows(db, { ...base, application_ids: ids.slice(i, i + 1000) }, watches))
    // Watched families with events, regardless of the patch's filters (base eligibility still applies).
    // Watching one application watches its whole development, so a changed sibling counts too.
    const watchedFamily = new Set([...watches.applications, ...(await applicationIdsForDevelopments(db, [...watches.developments]))])
    const watchedIds = ids.filter((id) => watchedFamily.has(id))
    if (watchedIds.length) {
      const watchedPredicate = buildPredicate(
        { ...input.criteria, residential: { enabled: true, minDwellings: 15 }, commercial: { enabled: true, work: [] }, stages: [], procedures: [], proximity: null, keywords: { include: [], exclude: [] }, watchedOnly: false, exactLocationsOnly: false },
        { boundary: null, applyDates: false }
      )
      add(await matchedRows(db, { ...watchedPredicate, application_ids: watchedIds }, watches))
    }
  } else {
    add(await matchedRows(db, { ...base, date_field: 'received', date_from: startDate, date_to: endDate }, watches))
  }

  const changes = categoriseChanges({
    rows: [...byId.values()],
    events,
    periodStart: input.run.period_start,
    periodEnd: input.run.period_end,
    kind: input.run.kind,
  })
  return { changes, events: events.length, candidates: byId.size }
}

async function monthSpendUsd(db: PlanningAdminClient): Promise<number> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { data, error } = await db.from('planning_monitor_digest_runs').select('usage').gte('generated_at', monthStart.toISOString()).not('usage', 'is', null).limit(10_000)
  if (error) throw error
  return (data ?? []).reduce((sum, r) => sum + (Number((r.usage as { costUsd?: number } | null)?.costUsd) || 0), 0)
}

export interface RunOutcome {
  runId: string
  status: 'generated' | 'requeued' | 'failed'
  summaryKind?: DigestReport['summaryKind']
  deliveries?: number
  error?: string
}

/** Generate one claimed run. Safe to call again after a crash: a generated run is left alone. */
export async function generateRun(run: RunRecord, db: PlanningAdminClient = createPlanningAdminClient()): Promise<RunOutcome> {
  const started = Date.now()
  const { data: revision, error: revisionError } = await db
    .from('planning_monitor_patch_revisions')
    .select('id, revision, name, geometry, criteria, planning_monitor_patches!inner(owner_id, archived_at)')
    .eq('id', run.revision_id)
    .single()
  if (revisionError || !revision) throw revisionError ?? new Error('Revision not found')
  const patchRow = (Array.isArray(revision.planning_monitor_patches) ? revision.planning_monitor_patches[0] : revision.planning_monitor_patches) as { owner_id: string; archived_at: string | null }
  const parsed = parseCriteria(revision.criteria)
  if (!parsed.ok) {
    // A capability this revision relies on has gone. Pause rather than broaden.
    await db.from('planning_monitor_patches').update({ needs_attention: parsed.error }).eq('id', run.patch_id)
    await stillClaimed(db.from('planning_monitor_digest_runs').update({ status: 'failed', error: `Criteria need attention: ${parsed.error}`, lease_owner: null, lease_expires_at: null }), run)
    return { runId: run.id, status: 'failed', error: parsed.error }
  }

  const freshness = await readPlanningFreshness(db).catch(() => FRESHNESS_UNAVAILABLE)
  const ageHours = (Date.now() - Date.parse(run.created_at)) / 3_600_000
  if (freshness.stale && run.kind === 'scheduled' && ageHours < COVERAGE_RECOVERY_HOURS) {
    // Never turn failed ingestion into "no changes". Wait for recovery, then issue a labelled partial report.
    await stillClaimed(db.from('planning_monitor_digest_runs').update({
      status: 'queued', lease_owner: null, lease_expires_at: null, attempts: Math.max(0, run.attempts - 1),
      not_before: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      coverage: { stale: true, staleReason: freshness.staleReason, note: 'Waiting for planning data to recover' },
    }), run)
    return { runId: run.id, status: 'requeued' }
  }
  const coverageNote = freshness.stale
    ? `Planning data was not fully up to date when this report was prepared (${freshness.staleReason ?? 'unknown'}); some changes may be missing.`
    : null

  const selection = await selectChanges(db, {
    userId: patchRow.owner_id,
    criteria: parsed.criteria,
    geometry: revision.geometry as PatchGeometry,
    run,
  })
  const ranked = rankChanges(selection.changes)
  const counts = countChanges(selection.changes)
  const packet = evidencePacket(ranked)

  let summary: DigestSummary
  let summaryKind: NonNullable<DigestReport['summaryKind']>
  let model: string | null = null
  let usage: Record<string, unknown> | null = null

  if (selection.changes.length === 0) {
    summary = deterministicSummary({ counts, kind: run.kind, reason: 'no_changes', coverageNote })
    summaryKind = freshness.stale ? 'partial' : 'no_changes'
  } else {
    const aiEnabled = await isPlanningMonitorAiEnabled()
    const configuredModel = process.env.PLANNING_MONITOR_MODEL
    const apiKey = process.env.OPENROUTER_API_KEY
    let reason: Parameters<typeof deterministicSummary>[0]['reason'] | null = null
    if (!aiEnabled || !configuredModel || !apiKey) reason = 'model_disabled'
    else if ((await monthSpendUsd(db)) >= monthlyBudgetUsd()) reason = 'budget'

    if (!reason) {
      try {
        const result = await summariseWithModel({
          apiKey: apiKey as string,
          model: configuredModel as string,
          userPrompt: buildUserPrompt({ patchName: revision.name, periodLabel: run.period_label, kind: run.kind, counts, items: packet.items, omitted: packet.omitted, coverageNote }),
          validate: (value) => validateSummary(value, { items: packet.items, counts, periodLabel: run.period_label, patchName: revision.name }),
        })
        summary = result.summary
        if (coverageNote && !summary.caveats.includes(coverageNote)) summary = { ...summary, caveats: [...summary.caveats, coverageNote] }
        model = result.model
        usage = result.usage
        summaryKind = freshness.stale ? 'partial' : 'ai'
      } catch (error) {
        console.error(`[planning-monitor] summary failed for run ${run.id}`, error)
        usage = (error as { usage?: Record<string, unknown> }).usage ?? null
        reason = 'model_unavailable'
      }
    }
    if (reason) {
      summary = deterministicSummary({ counts, kind: run.kind, reason: reason === 'model_disabled' ? 'model_disabled' : reason, coverageNote })
      summaryKind = freshness.stale ? 'partial' : 'fallback'
    }
  }

  const highlights = ranked.slice(0, REPORT_HIGHLIGHTS).map(toHighlight)
  const report = {
    revision: revision.revision,
    counts,
    summary: summary!,
    highlights,
    summaryHighlightCount: Math.min(SUMMARY_HIGHLIGHTS, highlights.length),
    omittedHighlights: Math.max(0, ranked.length - highlights.length),
  }
  const inputSnapshot = {
    sourceCutoff: new Date().toISOString(),
    events: selection.events,
    candidates: selection.candidates,
    evidence: packet.items,
    evidenceOmitted: packet.omitted,
    changes: selection.changes.map((c) => ({ applicationId: c.row.applicationId, developmentId: c.row.developmentId, categories: c.categories, watched: c.watched, row: c.row })),
  }

  const recipient = run.kind === 'scheduled' ? await deliveryRecipient(db, run, patchRow.owner_id, selection.changes.length === 0) : null

  // The report and its delivery commit together: a crash can leave the run running (and it is
  // reclaimed when the lease expires), never generated without the email it owes.
  const { data: finished, error: finishError } = await db.rpc('planning_monitor_finish_run', {
    p_run_id: run.id,
    p_lease_owner: run.lease_owner,
    p_result: {
      report,
      input_snapshot: inputSnapshot,
      summary_kind: summaryKind!,
      coverage: { stale: freshness.stale, staleReason: freshness.staleReason, note: coverageNote },
      source_cutoff: inputSnapshot.sourceCutoff,
      model,
      prompt_version: model ? DIGEST_PROMPT_VERSION : null,
      usage,
      latency_ms: Date.now() - started,
    },
    p_delivery: recipient,
  })
  if (finishError) throw finishError
  if (finished !== true) return { runId: run.id, status: 'failed', error: 'Lease lost before save' }
  return { runId: run.id, status: 'generated', summaryKind: summaryKind!, deliveries: recipient ? 1 : 0 }
}

/** The one recipient a scheduled run owes an email, or null. The delivery key stops a retry creating a second. */
async function deliveryRecipient(db: PlanningAdminClient, run: RunRecord, ownerId: string, quiet: boolean) {
  if (!run.subscription_id || !(await isPlanningMonitorEmailEnabled())) return null
  const { data: sub, error } = await db.from('planning_monitor_subscriptions').select('id, user_id, email_enabled, skip_quiet_weeks, unsubscribed_at').eq('id', run.subscription_id).maybeSingle()
  if (error) throw error
  if (!sub || !sub.email_enabled || sub.unsubscribed_at || sub.user_id !== ownerId) return null
  if (quiet && sub.skip_quiet_weeks) return null
  const { data: user, error: userError } = await db.from('users').select('email').eq('id', sub.user_id).maybeSingle()
  if (userError) throw userError
  if (!user?.email) return null
  return { subscription_id: sub.id as string, user_id: sub.user_id as string, email: user.email as string, delivery_key: `pm-${run.id}-${sub.user_id}` }
}

/**
 * Narrow a run update to the claim that made it: still running, under this worker's lease, on this
 * attempt. A generated report, or a run another worker has since reclaimed, is left untouched.
 */
function stillClaimed<Q extends { eq: (column: string, value: unknown) => Q }>(query: Q, run: Pick<RunRecord, 'id' | 'lease_owner' | 'attempts'>): Q {
  return query.eq('id', run.id).eq('status', 'running').eq('lease_owner', run.lease_owner).eq('attempts', run.attempts)
}

/** Claim and generate up to `limit` runs. Failures past the attempt limit are marked failed. */
export async function processRuns(workerId: string, limit: number, db: PlanningAdminClient = createPlanningAdminClient()): Promise<RunOutcome[]> {
  const outcomes: RunOutcome[] = []
  for (let i = 0; i < limit; i++) {
    const { data, error } = await db.rpc('planning_monitor_claim_run', { p_worker: workerId })
    if (error) throw error
    const run = ((data ?? []) as RunRecord[])[0]
    if (!run) break
    try {
      outcomes.push(await generateRun(run, db))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[planning-monitor] run ${run.id} failed`, err)
      const exhausted = run.attempts >= 3
      // The error may have come after the report committed (a dropped response from the finish
      // call), so only a run still held by this claim is sent back or failed.
      await stillClaimed(db.from('planning_monitor_digest_runs').update({
        status: exhausted ? 'failed' : 'queued',
        error: message,
        lease_owner: null,
        lease_expires_at: null,
        not_before: new Date(Date.now() + 10 * 60_000 * run.attempts).toISOString(),
      }), run)
      outcomes.push({ runId: run.id, status: 'failed', error: message })
    }
  }
  return outcomes
}

/** A run as the card and report page read it. */
export function toDigestReport(record: Record<string, any>, patchName: string): DigestReport {
  const report = record.report ?? {}
  return {
    runId: record.id,
    patchId: record.patch_id,
    patchName,
    kind: record.kind,
    periodStart: record.period_start,
    periodEnd: record.period_end,
    periodLabel: record.period_label,
    generatedAt: record.generated_at ?? null,
    status: record.status,
    summaryKind: record.summary_kind ?? null,
    revision: report.revision ?? 0,
    counts: report.counts ?? null,
    summary: report.summary ?? null,
    highlights: report.highlights ?? [],
    omittedHighlights: report.omittedHighlights ?? 0,
    coverage: record.coverage ?? null,
    error: record.status === 'failed' ? 'This briefing could not be prepared.' : null,
  }
}
