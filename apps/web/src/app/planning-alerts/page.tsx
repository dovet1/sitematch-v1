import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { getServerUserProfile } from '@/lib/auth'
import {
  getPlanningAlertReportState,
  listAccessiblePlanningAlertSubscriptions,
} from '@/lib/planning-alerts/service'
import { periodFromMonth, previousCalendarMonth } from '@/lib/planning-alerts/period'
import { PlanningAlertReport } from './components/PlanningAlertReport'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const metadata: Metadata = { title: 'Planning Alerts' }

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-5 py-16 text-slate-900">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          <MapPin className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
          Planning intelligence
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">No planning alert is configured</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          {isAdmin
            ? 'Create and enable a planning alert subscription for a user and brand, then return here to preview it.'
            : 'Your SiteMatcher planning report has not been configured yet. Contact the SiteMatcher team to get access.'}
        </p>
        <Link
          href={isAdmin ? '/admin' : '/'}
          className="mt-6 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
        >
          {isAdmin ? 'Back to admin' : 'Back to SiteMatcher'}
        </Link>
      </div>
    </div>
  )
}

export default async function PlanningAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ subscription?: string; month?: string }>
}) {
  const params = await searchParams
  const profile = await getServerUserProfile()
  if (!profile) {
    const returnQuery = new URLSearchParams()
    if (params.subscription) returnQuery.set('subscription', params.subscription)
    if (params.month) returnQuery.set('month', params.month)
    const returnUrl = `/planning-alerts${returnQuery.size ? `?${returnQuery.toString()}` : ''}`
    redirect(`/auth?mode=signin&returnUrl=${encodeURIComponent(returnUrl)}`)
  }

  const isAdmin = profile.role === 'admin'
  const subscriptions = await listAccessiblePlanningAlertSubscriptions({
    userId: profile.id,
    isAdmin,
  })
  if (subscriptions.length === 0) return <EmptyState isAdmin={isAdmin} />

  const selected = subscriptions.find((item) => item.id === params.subscription) ?? subscriptions[0]
  const latestPeriod = previousCalendarMonth()
  const requestedPeriod = params.month ? periodFromMonth(params.month) : null
  const period = requestedPeriod && requestedPeriod.start <= latestPeriod.start
    ? requestedPeriod
    : latestPeriod
  const report = await getPlanningAlertReportState(selected.id, period)

  return (
    <PlanningAlertReport
      digest={report.digest}
      generation={report.generation}
      navigation={{
        basePath: '/planning-alerts',
        currentMonth: period.start.slice(0, 7),
        latestMonth: latestPeriod.start.slice(0, 7),
        activeSubscriptionId: selected.id,
        subscriptions,
        backHref: isAdmin ? '/admin' : '/new-dashboard',
      }}
    />
  )
}
