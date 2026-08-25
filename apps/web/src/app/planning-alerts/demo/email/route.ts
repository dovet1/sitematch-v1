import { NextRequest } from 'next/server'
import { createMonthlyPlanningAlertEmail } from '@/lib/planning-alerts/email'
import { createDemoDigest } from '@/lib/planning-alerts/mock-data'

export const dynamic = 'force-dynamic'

/** Browser-viewable rendering of the exact Resend email body used by the cron. */
export async function GET(request: NextRequest) {
  const reportUrl = `${request.nextUrl.origin}/planning-alerts/demo`
  const { html } = createMonthlyPlanningAlertEmail(
    createDemoDigest(),
    request.nextUrl.origin,
    reportUrl
  )
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
