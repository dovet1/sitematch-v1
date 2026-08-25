import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { checkPlusAccess } from '@/lib/gapfinder-access'
import { isFindSitesEnabled } from '@/lib/feature-flags'

// Find Sites is a standalone experimental route OUTSIDE the unified workspace (integrate later).
// Same gate posture as sitematcher-unified: a runtime kill-switch flag, sign-in, then Plus.
export default async function FindSitesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Runtime kill-switch. When off, the route does not exist.
  if (!(await isFindSitesEnabled())) {
    notFound()
  }

  // 2. Must be signed in.
  const user = await getCurrentUser()
  if (!user) {
    redirect('/?login=1&redirect=/find-sites')
  }

  // 3. Plus tier only. Authoritative server-side gate.
  if (!(await checkPlusAccess(user.id))) {
    return <UpgradeState />
  }

  return <>{children}</>
}

function UpgradeState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sm-bg px-6">
      <div className="max-w-md rounded-2xl border border-sm-border bg-sm-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-sm-ink">
          Find Sites is a Plus feature
        </h1>
        <p className="mt-3 text-sm text-sm-ink2">
          Upgrade to the Plus plan to prospect registered land parcels against a
          measurable acquisition brief.
        </p>
        <Link
          href="/subscription"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-sm-violet px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sm-violet-deep"
        >
          Upgrade to Plus
        </Link>
      </div>
    </div>
  )
}
