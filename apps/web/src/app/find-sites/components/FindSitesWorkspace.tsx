'use client'

import { FindSitesMap } from './FindSitesMap'
import { RequirementSetup } from './RequirementSetup'
import { ResultsList } from './ResultsList'
import { ParcelDetail } from './ParcelDetail'
import { Caveats } from './Caveats'
import { useFindSitesStore } from '../lib/store/find-sites-store'

export function FindSitesWorkspace() {
  const hasSelection = useFindSitesStore((s) => !!s.selectedSiteId)

  return (
    <div className="flex h-screen w-full flex-col bg-sm-bg">
      <header className="flex shrink-0 items-center justify-between border-b border-sm-border bg-sm-surface px-5 py-3">
        <div>
          <h1 className="text-sm font-semibold text-sm-ink">Find Sites</h1>
          <p className="text-[11px] text-sm-ink3">
            Experimental · broad-brush parcel prospecting on real Canterbury land data
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Prototype
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[420px] shrink-0 flex-col border-r border-sm-border bg-sm-bg">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {hasSelection ? (
              <ParcelDetail />
            ) : (
              <div className="space-y-5">
                <RequirementSetup />
                <ResultsList />
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-sm-border p-4">
            <Caveats />
          </div>
        </aside>

        <main className="relative min-w-0 flex-1">
          <FindSitesMap />
        </main>
      </div>
    </div>
  )
}
