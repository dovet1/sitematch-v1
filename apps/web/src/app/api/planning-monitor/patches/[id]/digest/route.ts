import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMonitorAccess } from '@/lib/planning-monitor/access'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { enqueueBriefing, toDigestReport } from '@/lib/planning-monitor/digest-queue'
import { getOwnedPatch } from '@/lib/planning-monitor/patches'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * The patch card's briefing: the latest generated report, whether a newer one is being prepared,
 * and the kept report history (newest first, with each week's new-application count for the week picker). A report from an older revision is flagged so the card can say the
 * criteria have changed since.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { id } = await params
  const patch = await getOwnedPatch(access.userId, id).catch(() => null)
  if (!patch) return jsonError('Patch not found', 404)

  const { data, error } = await createPlanningAdminClient()
    .from('planning_monitor_digest_runs')
    .select('id, patch_id, revision_id, kind, period_start, period_end, period_label, status, summary_kind, report, coverage, generated_at, created_at')
    .eq('patch_id', id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) return jsonError('Briefing could not be loaded', 500)
  const runs = data ?? []
  const latest = runs.find((r) => r.status === 'generated') ?? null
  const pending = runs.find((r) => r.status === 'queued' || r.status === 'running') ?? null
  return NextResponse.json(
    {
      latest: latest ? { ...toDigestReport(latest, patch.name), fromOlderRevision: latest.revision_id !== patch.revisionId } : null,
      preparing: pending ? { runId: pending.id, kind: pending.kind } : null,
      lastFailed: !latest && runs[0]?.status === 'failed',
      history: runs
        .filter((r) => r.status === 'generated')
        .map((r) => ({
          runId: r.id,
          kind: r.kind,
          periodLabel: r.period_label,
          periodStart: r.period_start,
          periodEnd: r.period_end,
          generatedAt: r.generated_at,
          summaryKind: r.summary_kind,
          newApplications: (r.report as { counts?: { newApplications?: number } } | null)?.counts?.newApplications ?? null,
        })),
      nextEmailAt: patch.subscription?.emailEnabled ? patch.subscription.nextDueAt : null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}

/** Ask for a fresh preview (for example after a failed first briefing). Debounced server-side. */
export async function POST(_request: NextRequest, { params }: Params) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { id } = await params
  const patch = await getOwnedPatch(access.userId, id).catch(() => null)
  if (!patch) return jsonError('Patch not found', 404)
  try {
    const run = await enqueueBriefing(patch, 'preview')
    return NextResponse.json({ runId: run.id }, { status: 202 })
  } catch (error) {
    console.error('[planning-monitor] preview request failed', error)
    return jsonError('Briefing could not be queued', 500)
  }
}
