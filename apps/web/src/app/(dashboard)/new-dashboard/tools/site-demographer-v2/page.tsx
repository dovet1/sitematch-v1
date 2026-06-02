'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { isSiteDemographerViewportSupported } from './viewport'
import UnsupportedViewport from './UnsupportedViewport'
import LoadingState from './LoadingState'

const SiteDemographerDesktop = dynamic(() => import('./SiteDemographerDesktop'), {
  ssr: false,
  loading: () => <LoadingState />,
})

type ViewportState = 'unknown' | 'supported' | 'unsupported'

function useViewportState() {
  const [viewportState, setViewportState] = useState<ViewportState>('unknown')

  useEffect(() => {
    const updateViewportState = () => {
      setViewportState(
        isSiteDemographerViewportSupported(window.innerWidth)
          ? 'supported'
          : 'unsupported'
      )
    }

    updateViewportState()
    window.addEventListener('resize', updateViewportState)
    return () => window.removeEventListener('resize', updateViewportState)
  }, [])

  return viewportState
}

export default function SiteDemographerV2Page() {
  const viewportState = useViewportState()

  if (viewportState === 'unknown') {
    return <LoadingState />
  }

  if (viewportState === 'unsupported') {
    return <UnsupportedViewport />
  }

  return <SiteDemographerDesktop />
}
