import type { Metadata } from 'next'
import { createDemoDigest } from '@/lib/planning-alerts/mock-data'
import { periodFromMonth, previousCalendarMonth } from '@/lib/planning-alerts/period'
import { PlanningAlertReport } from '../components/PlanningAlertReport'

export const metadata: Metadata = { title: 'Planning Alert POC' }

export default async function PlanningAlertDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const latestPeriod = previousCalendarMonth()
  const requestedPeriod = month ? periodFromMonth(month) : null
  const period = requestedPeriod && requestedPeriod.start <= latestPeriod.start
    ? requestedPeriod
    : latestPeriod

  return (
    <PlanningAlertReport
      digest={createDemoDigest(period)}
      navigation={{
        basePath: '/planning-alerts/demo',
        currentMonth: period.start.slice(0, 7),
        latestMonth: latestPeriod.start.slice(0, 7),
      }}
    />
  )
}
