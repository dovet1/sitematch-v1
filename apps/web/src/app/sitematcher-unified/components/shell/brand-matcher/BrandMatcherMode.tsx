'use client'

import { useEffect, useRef } from 'react'
import { useBrandMatcherStore } from '../../../lib/stores/brand-matcher-store'
import { BrandMatcherHero } from './BrandMatcherHero'
import { BrandMatcherScanning } from './BrandMatcherScanning'
import { BrandMatcherResults } from './BrandMatcherResults'

// Brand Matcher: a full-pane, map-less mode like Directory — it replaces the left panel, map
// and inspector. Entry -> matching -> ranked results (docs/design_handoff_contact_brands).
export function BrandMatcherMode() {
  const phase = useBrandMatcherStore((s) => s.phase)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Each screen starts at the top.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [phase])

  return (
    <div ref={scrollRef} className="h-full min-w-0 flex-1 overflow-y-auto bg-sm-bg">
      {phase === 'hero' && <BrandMatcherHero />}
      {phase === 'scanning' && <BrandMatcherScanning />}
      {phase === 'results' && <BrandMatcherResults />}
    </div>
  )
}
