'use client'

import { useEffect } from 'react'
import { useWorkspaceStore } from '../stores/unified-workspace-store'
import { useBrandMatcherStore } from '../stores/brand-matcher-store'
import { readSiteParams, toQueryUseClass } from '@/lib/brand-matcher-link'

/**
 * Read `?mode=brand-matcher&site=…&pc=…&sqft=…&uc=…` once (the homepage search and the trial
 * flow land here): open Brand Matcher with the site filled in, and run it when the size is known.
 */
export function useBrandMatcherDeepLink(enabled: boolean) {
  const setMode = useWorkspaceStore((s) => s.setMode)
  useEffect(() => {
    if (!enabled) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') !== 'brand-matcher') return
    setMode('brand-matcher')
    const site = readSiteParams(params)
    if (!site) return
    const store = useBrandMatcherStore.getState()
    store.setForm({
      postcode: site.postcode,
      useClass: toQueryUseClass(site.useClass),
      ...(site.sqft ? { sqft: String(site.sqft) } : {}),
    })
    if (site.sqft) void store.run()
  }, [enabled, setMode])
}
