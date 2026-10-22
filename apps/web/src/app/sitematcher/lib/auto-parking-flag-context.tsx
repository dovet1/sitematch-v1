'use client'

import { createContext, useContext } from 'react'

const AutoParkingFlagContext = createContext(false)

/**
 * Bridges the server-resolved `auto_parking_enabled` kill-switch
 * (@/lib/feature-flags) into the client component tree. Resolved once per
 * request in layout.tsx and read via `useAutoParkingEnabled()` — no client
 * fetch, no loading flicker, fails closed like the flag itself.
 */
export function AutoParkingFlagProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  return <AutoParkingFlagContext.Provider value={enabled}>{children}</AutoParkingFlagContext.Provider>
}

export function useAutoParkingEnabled(): boolean {
  return useContext(AutoParkingFlagContext)
}
