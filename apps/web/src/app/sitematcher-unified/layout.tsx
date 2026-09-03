import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { checkPlusAccess } from '@/lib/gapfinder-access'
import { isUnifiedWorkspaceEnabled, isAutoParkingEnabled } from '@/lib/feature-flags'
import { AutoParkingFlagProvider } from './lib/auto-parking-flag-context'

export default async function UnifiedWorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Runtime kill-switch. When off, the route does not exist.
  if (!(await isUnifiedWorkspaceEnabled())) {
    notFound()
  }

  // 2. Must be signed in.
  const user = await getCurrentUser()
  if (!user) {
    redirect('/?login=1&redirect=/sitematcher-unified')
  }

  // 3. Plus tier only. Authoritative server-side gate.
  if (!(await checkPlusAccess(user.id))) {
    return <UpgradeState />
  }

  // Sub-feature kill-switch: resolved once per request here (server) and
  // bridged to the client tree via context — the real Plus enforcement for
  // Auto parking still happens server-side on save (see the sketches API).
  const autoParkingEnabled = await isAutoParkingEnabled()

  return <AutoParkingFlagProvider enabled={autoParkingEnabled}>{children}</AutoParkingFlagProvider>
}

function UpgradeState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sm-bg px-6">
      <div className="max-w-md rounded-2xl border border-sm-border bg-sm-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-sm-ink">
          Unified Workspace is a Plus feature
        </h1>
        <p className="mt-3 text-sm text-sm-ink2">
          Upgrade to the Plus plan to work gaps, catchment and site sketches on a
          single map.
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
