'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MonitorUp } from 'lucide-react'
import { isGapFinderViewportSupported } from './viewport'
import { PaywallModal } from '@/components/PaywallModal'
import { TrialSignupModal } from '@/components/TrialSignupModal'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'

const GapFinderClient = dynamic(() => import('./GapFinderClient'), {
  ssr: false,
  loading: () => <GapFinderLoading />,
})

type ViewportState = 'unknown' | 'supported' | 'unsupported'

function useGapFinderViewportState() {
  const [viewportState, setViewportState] = useState<ViewportState>('unknown')

  useEffect(() => {
    const updateViewportState = () => {
      setViewportState(
        isGapFinderViewportSupported(window.innerWidth) ? 'supported' : 'unsupported'
      )
    }

    updateViewportState()
    window.addEventListener('resize', updateViewportState)

    return () => {
      window.removeEventListener('resize', updateViewportState)
    }
  }, [])

  return viewportState
}

function GapFinderLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
    </div>
  )
}

function GapFinderMobileUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-violet-50 px-6">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <MonitorUp className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-950">
          GapFinder works best on a larger screen
        </h1>
        <p className="mt-3 text-base text-gray-600">
          Please try again on desktop or tablet.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          Back to homepage
        </Link>
      </section>
    </main>
  )
}

export default function GapFinderPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { subscriptionTier, hasProAccess, hasPlusAccess, loading: tierLoading } = useSubscriptionTier()
  const viewportState = useGapFinderViewportState()

  // Loading state (viewport + tier)
  if (tierLoading || viewportState === 'unknown') {
    return <GapFinderLoading />
  }

  // Plus users: check viewport, then grant access
  if (hasPlusAccess) {
    if (viewportState === 'supported') {
      return <GapFinderClient />
    } else if (viewportState === 'unsupported') {
      return <GapFinderMobileUnavailable />
    }
  }

  // Pro users: show upgrade modal (no duplicate gate component)
  if (user && hasProAccess && subscriptionTier === 'pro') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-lg">
          <PaywallModal
            context="gapfinder"
            tier="plus"
            isOpen={true}
            onClose={() => router.push('/new-dashboard')}
            redirectTo="/gapfinder"
          />
        </div>
      </div>
    )
  }

  // Logged-in users without Plus access (Free, canceled, expired, trial_canceled)
  // CRITICAL: This catches canceled/expired Pro/Plus users who have stale tier but no access
  if (user && !hasPlusAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-lg">
          <PaywallModal
            context="gapfinder"
            tier="plus"
            isOpen={true}
            onClose={() => router.push('/new-dashboard')}
            redirectTo="/gapfinder"
          />
        </div>
      </div>
    )
  }

  // Anonymous users: show trial signup (no duplicate gate component)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-lg">
          <TrialSignupModal
            context="gapfinder"
            tier="plus"
            forceOpen={true}
            onClose={() => router.push('/')}
            redirectPath="/gapfinder"
          >
            <div />
          </TrialSignupModal>
        </div>
      </div>
    )
  }

  // Fallback (shouldn't reach here)
  return <GapFinderLoading />
}
