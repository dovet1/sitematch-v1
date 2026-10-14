'use client'

import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../stores/unified-workspace-store'
import { usePlanningMonitorEnabled } from '../planning-monitor-flag-context'
import { useBrandMatcherEnabled } from '../brand-matcher-flag-context'
import { useModeChooserDontShow } from '../mode-chooser-pref-context'
import {
  availableModes,
  initialMode,
  readLastMode,
  readLocalDontShow,
  shouldOpenChooserOnLoad,
  writeLastMode,
} from '../mode-nav'

/**
 * On every visit to the workspace: start in the last-used mode and open the mode chooser unless
 * the user has opted out or arrived on a deep link. Afterwards, keep the last-used mode up to date.
 */
export function useModeNavStartup() {
  const view = useWorkspaceStore((s) => s.view)
  const dontShowOnAccount = useModeChooserDontShow()
  const planning = usePlanningMonitorEnabled()
  const brandMatcher = useBrandMatcherEnabled()
  const booted = useRef(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    // `?mode=` links (Planning alert emails) are handled by usePlanningDeepLink; leave them be.
    const hasDeepLink = new URLSearchParams(window.location.search).has('mode')
    const store = useWorkspaceStore.getState()
    if (!hasDeepLink) {
      const mode = initialMode(readLastMode(), availableModes({ planning, brandMatcher }))
      if (mode !== store.view) store.setMode(mode)
    }
    const open = shouldOpenChooserOnLoad({
      dontShow: dontShowOnAccount || readLocalDontShow(),
      hasDeepLink,
    })
    if (open) store.setChooserOpen(true)
  }, [dontShowOnAccount, planning, brandMatcher])

  useEffect(() => {
    if (booted.current) writeLastMode(view)
  }, [view])
}
