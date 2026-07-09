'use client'

import { UChrome } from './shell/UChrome'
import { URail } from './shell/URail'
import { UnifiedMap } from './map/UnifiedMap'
import { useWorkspaceStore } from '../lib/stores/unified-workspace-store'

const MODE_LABELS: Record<string, string> = {
  assess: 'Assess Area',
  find: 'Find Gaps',
  sketch: 'Sketch Site',
}

export function UnifiedWorkspace() {
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-sm-bg">
      <UChrome />
      <div className="flex flex-1 overflow-hidden">
        <URail />

        {/* Contextual left panel (fleshed out per mode in later phases). */}
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-sm-border bg-sm-surface p-[18px]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-sm-violet-deep">
            {MODE_LABELS[view]}
          </p>
          <p className="mt-2 text-sm text-sm-ink3">
            {view === 'assess' && 'Drop a point on the map to read the landscape.'}
            {view === 'find' && 'Build presence & proximity rules to rank gaps.'}
            {view === 'sketch' && 'Start a new sketch or open a saved one.'}
          </p>
        </aside>

        {/* Shared map fills remaining space. */}
        <main className="relative flex-1">
          <UnifiedMap />
        </main>

        {/* Right inspector — hidden until an area is selected. */}
        {area && (
          <aside className="w-[404px] shrink-0 overflow-y-auto border-l border-sm-border bg-sm-surface p-[18px]">
            <h2 className="text-xl font-semibold text-sm-ink">{area.name}</h2>
            {area.region && (
              <p className="text-sm text-sm-ink3">{area.region}</p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
