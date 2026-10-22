'use client'

import { createContext, useContext } from 'react'

// Planning mode's kill-switch, resolved on the server in layout.tsx. The API enforces the same
// flag independently, so this only decides whether the mode is offered.
const PlanningMonitorFlagContext = createContext(false)

export function PlanningMonitorFlagProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  return (
    <PlanningMonitorFlagContext.Provider value={enabled}>
      {children}
    </PlanningMonitorFlagContext.Provider>
  )
}

export function usePlanningMonitorEnabled(): boolean {
  return useContext(PlanningMonitorFlagContext)
}
