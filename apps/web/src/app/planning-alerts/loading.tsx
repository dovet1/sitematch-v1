import { Loader2 } from 'lucide-react'

export default function PlanningAlertsLoading() {
  return (
    <div className="min-h-dvh bg-slate-50" aria-busy="true" aria-label="Loading planning report">
      <div className="h-[73px] border-b border-slate-200 bg-white" />
      <div className="border-b border-slate-200 bg-white px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1480px]">
          <div className="h-3 w-36 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="mt-4 h-10 w-64 max-w-full animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mx-auto grid max-w-[1480px] gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div role="status" aria-live="polite" className="max-w-md">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-700 motion-reduce:animate-none" aria-hidden="true" />
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
              Building your planning report
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              We&apos;re fetching the previous month&apos;s applications from PlanNexus and checking them against every store and your patch.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              The first load can take around a minute when several postcode areas are configured. The finished report is saved, so return visits are much faster.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-7 w-72 max-w-full animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white motion-reduce:animate-none" />
          <div className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}
