'use client'

import { createContext, useContext } from 'react'

const RetailCentreFlagContext = createContext(false)

export function RetailCentreFlagProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  return (
    <RetailCentreFlagContext.Provider value={enabled}>
      {children}
    </RetailCentreFlagContext.Provider>
  )
}

export function useRetailCentreGapsEnabled(): boolean {
  return useContext(RetailCentreFlagContext)
}
