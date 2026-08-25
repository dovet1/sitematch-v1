'use client'

import dynamic from 'next/dynamic'

// The workspace shell mounts Mapbox GL (raw WebGL, window-dependent) — load it client-only,
// mirroring how sitematcher-unified defers its map-bearing shell.
const FindSitesWorkspace = dynamic(
  () => import('./components/FindSitesWorkspace').then((m) => m.FindSitesWorkspace),
  { ssr: false }
)

export default function FindSitesPage() {
  return <FindSitesWorkspace />
}
