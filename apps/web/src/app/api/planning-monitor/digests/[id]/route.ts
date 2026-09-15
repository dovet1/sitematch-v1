import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMonitorAccess } from '@/lib/planning-monitor/access'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { toDigestReport } from '@/lib/planning-monitor/digest-queue'

export const dynamic = 'force-dynamic'

/** One immutable report, for its patch owner only. Opens the frozen snapshot, not the current map. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireMonitorAccess()
  if (!access.ok) return access.response
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError('Report not found', 404)
  const { data, error } = await createPlanningAdminClient()
    .from('planning_monitor_digest_runs')
    .select('id, patch_id, kind, period_start, period_end, period_label, status, summary_kind, report, coverage, generated_at, planning_monitor_patches!inner(owner_id), planning_monitor_patch_revisions!inner(name)')
    .eq('id', id)
    .eq('planning_monitor_patches.owner_id', access.userId)
    .maybeSingle()
  if (error) return jsonError('Report could not be loaded', 500)
  if (!data) return jsonError('Report not found', 404)
  const revision = Array.isArray(data.planning_monitor_patch_revisions) ? data.planning_monitor_patch_revisions[0] : data.planning_monitor_patch_revisions
  return NextResponse.json({ report: toDigestReport(data, (revision as { name: string }).name) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
