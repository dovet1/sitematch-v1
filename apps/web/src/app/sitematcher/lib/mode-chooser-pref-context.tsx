'use client'

import { createContext, useContext } from 'react'

// The account's "Don't show this again" choice for the mode chooser, read from user_metadata on
// the server in layout.tsx so the chooser never flashes up for someone who has opted out.
const ModeChooserPrefContext = createContext(false)

export function ModeChooserPrefProvider({
  dontShow,
  children,
}: {
  dontShow: boolean
  children: React.ReactNode
}) {
  return <ModeChooserPrefContext.Provider value={dontShow}>{children}</ModeChooserPrefContext.Provider>
}

export function useModeChooserDontShow(): boolean {
  return useContext(ModeChooserPrefContext)
}
