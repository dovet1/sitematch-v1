'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { MonitorUp } from 'lucide-react'
import { isGapFinderViewportSupported } from './viewport'
import { PaywallModal } from '@/components/PaywallModal'
import { TrialSignupModal } from '@/components/TrialSignupModal'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess'

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

function GapFinderAccessDenied({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [showModal, setShowModal] = useState(true)

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-violet-50">
      {isLoggedIn ? (
        <PaywallModal
          context="gapfinder"
          redirectTo="/gapfinder"
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      ) : (
        <TrialSignupModal
          context="gapfinder"
          redirectPath="/gapfinder"
          forceOpen={showModal}
          onClose={() => setShowModal(false)}
        >
          <div />
        </TrialSignupModal>
      )}
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          GapFinder
        </h1>
        <p className="text-gray-600 mt-2">
          Premium feature - Subscription required
        </p>
      </div>
    </div>
  )
}

export default function GapFinderPage() {
  const { user, loading: authLoading } = useAuth()
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess()
  const viewportState = useGapFinderViewportState()

  if (authLoading || subscriptionLoading) {
    return <GapFinderLoading />
  }

  if (!user || !hasAccess) {
    return <GapFinderAccessDenied isLoggedIn={Boolean(user)} />
  }

  if (viewportState === 'unknown') {
    return <GapFinderLoading />
  }

  if (viewportState === 'unsupported') {
    return <GapFinderMobileUnavailable />
  }

  return <GapFinderClient />
}
