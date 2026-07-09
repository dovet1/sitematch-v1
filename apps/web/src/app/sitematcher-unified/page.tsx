'use client'

import dynamic from 'next/dynamic'

// The workspace is a client-only surface (Mapbox GL, Zustand). The server
// `layout.tsx` enforces the feature flag + Plus gate before this renders.
const UnifiedWorkspace = dynamic(
  () => import('./components/UnifiedWorkspace').then((m) => m.UnifiedWorkspace),
  { ssr: false }
)

export default function SitematcherUnifiedPage() {
  return <UnifiedWorkspace />
}
