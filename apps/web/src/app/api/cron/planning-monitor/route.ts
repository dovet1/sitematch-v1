import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { isPlanningMonitorEmailEnabled, isPlanningMonitorEnabled } from '@/lib/feature-flags'
import { processRuns } from '@/lib/planning-monitor/digest-queue'
import { processDeliveries } from '@/lib/planning-monitor/delivery'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Planning Monitor scheduler, every 15 minutes. Small bounded steps, each safe to run concurrently
 * with another invocation:
 *   1. enqueue due weekly runs (once per subscription and period, enforced by a unique index),
 *   2. generate a few queued briefings under a lease,
 *   3. send a few pending deliveries under a lease with idempotency keys.
 * The email kill-switch stops step 3 only; briefings and saved reports keep working.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await isPlanningMonitorEnabled())) return NextResponse.json({ skipped: 'planning monitor disabled' })

  const db = createPlanningAdminClient()
  const worker = `cron-${randomUUID()}`
  const deadline = Date.now() + 240_000

  const { data: enqueued, error: enqueueError } = await db.rpc('planning_monitor_enqueue_due', { p_limit: 200 })
  if (enqueueError) {
    console.error('[planning-monitor] enqueue failed', enqueueError)
    return NextResponse.json({ error: 'enqueue failed' }, { status: 500 })
  }

  const runs = []
  while (Date.now() < deadline - 60_000) {
    const batch = await processRuns(worker, 1, db)
    if (batch.length === 0) break
    runs.push(...batch)
    if (runs.length >= 20) break
  }

  let deliveries: Awaited<ReturnType<typeof processDeliveries>> = []
  let deliverySkipped: string | null = null
  if (!(await isPlanningMonitorEmailEnabled())) deliverySkipped = 'email disabled'
  else if (!process.env.RESEND_API_KEY) deliverySkipped = 'RESEND_API_KEY missing'
  else if (Date.now() < deadline) deliveries = await processDeliveries(50, db)

  return NextResponse.json({
    enqueued,
    runs,
    deliveries: {
      skipped: deliverySkipped,
      sent: deliveries.filter((d) => d.state === 'sent').length,
      suppressed: deliveries.filter((d) => d.state === 'suppressed').length,
      retrying: deliveries.filter((d) => d.state === 'ambiguous').length,
      failed: deliveries.filter((d) => d.state === 'failed').length,
    },
  })
}
