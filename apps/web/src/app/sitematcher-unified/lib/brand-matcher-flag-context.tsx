'use client'

import { createContext, useContext } from 'react'

// Brand Matcher's kill-switch, resolved on the server in layout.tsx. The API enforces the same
// flag independently, so this only decides whether the mode is offered.
const BrandMatcherFlagContext = createContext(false)

export function BrandMatcherFlagProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  return (
    <BrandMatcherFlagContext.Provider value={enabled}>{children}</BrandMatcherFlagContext.Provider>
  )
}

export function useBrandMatcherEnabled(): boolean {
  return useContext(BrandMatcherFlagContext)
}
