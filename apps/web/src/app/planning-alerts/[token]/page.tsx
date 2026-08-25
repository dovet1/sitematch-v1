import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPlanningAlertReportState } from '@/lib/planning-alerts/service'
import { periodFromMonth, previousCalendarMonth } from '@/lib/planning-alerts/period'
import { verifyPlanningAlertToken } from '@/lib/planning-alerts/signing'
import { PlanningAlertReport } from '../components/PlanningAlertReport'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Monthly Planning Alert' }

export default async function PlanningAlertPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { token } = await params
  const { month } = await searchParams
  const subscriptionId = verifyPlanningAlertToken(token)
  const latestPeriod = previousCalendarMonth()
  const period = month ? periodFromMonth(month) : latestPeriod
  if (!subscriptionId || !period || period.start > latestPeriod.start) notFound()

  const report = await getPlanningAlertReportState(subscriptionId, period)
  return (
    <PlanningAlertReport
      digest={report.digest}
      generation={report.generation}
      navigation={{
        basePath: `/planning-alerts/${token}`,
        currentMonth: period.start.slice(0, 7),
        latestMonth: latestPeriod.start.slice(0, 7),
      }}
    />
  )
}
