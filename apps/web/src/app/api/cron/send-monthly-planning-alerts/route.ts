import { NextRequest, NextResponse } from 'next/server'
import { previousCalendarMonth } from '@/lib/planning-alerts/period'
import {
  getOrCreatePlanningAlertDigest,
  listEnabledPlanningAlertSubscriptionIds,
  markPlanningAlertSent,
  planningAlertWasSent,
} from '@/lib/planning-alerts/service'
import { sendMonthlyPlanningAlert } from '@/lib/planning-alerts/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Runs at 08:00 UTC on the first day of each month. */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
  }

  const period = previousCalendarMonth()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://sitematcher.co.uk'
  const subscriptionIds = await listEnabledPlanningAlertSubscriptionIds()
  const results: { subscriptionId: string; status: 'sent' | 'skipped' | 'failed'; error?: string }[] = []

  for (const subscriptionId of subscriptionIds) {
    try {
      if (await planningAlertWasSent(subscriptionId, period.start)) {
        results.push({ subscriptionId, status: 'skipped' })
        continue
      }
      const digest = await getOrCreatePlanningAlertDigest(subscriptionId, period)
      const result = await sendMonthlyPlanningAlert(digest, siteUrl)
      if (!result.success) throw new Error(result.error ?? 'Email provider rejected the message')
      await markPlanningAlertSent(subscriptionId, period.start)
      results.push({ subscriptionId, status: 'sent' })
    } catch (error) {
      console.error(`[planning-alerts] Failed subscription ${subscriptionId}`, error)
      results.push({
        subscriptionId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    success: results.every((result) => result.status !== 'failed'),
    period,
    sent: results.filter((result) => result.status === 'sent').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  })
}
