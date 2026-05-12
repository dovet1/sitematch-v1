'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { MonitorUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isGapFinderViewportSupported } from './viewport'

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
        <Button asChild className="mt-8 bg-violet-600 hover:bg-violet-700">
          <Link href="/">Back to homepage</Link>
        </Button>
      </section>
    </main>
  )
}

export default function GapFinderPage() {
  const viewportState = useGapFinderViewportState()

  if (viewportState === 'unknown') {
    return <GapFinderLoading />
  }

  if (viewportState === 'unsupported') {
    return <GapFinderMobileUnavailable />
  }

  return <GapFinderClient />
}
