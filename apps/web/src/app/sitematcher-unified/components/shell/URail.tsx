'use client'

import { MapPin, Search, PenTool, HelpCircle } from 'lucide-react'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import type { WorkspaceMode } from '../../types/unified-workspace'

// Requirements mode is deferred in v1 (see plan) — three modes only.
const MODES: { id: WorkspaceMode; label: string; Icon: typeof MapPin }[] = [
  { id: 'assess', label: 'Assess Area', Icon: MapPin },
  { id: 'find', label: 'Find Gaps', Icon: Search },
  { id: 'sketch', label: 'Sketch Site', Icon: PenTool },
]

export function URail() {
  const view = useWorkspaceStore((s) => s.view)
  const setMode = useWorkspaceStore((s) => s.setMode)

  // Leaving a dirty sketch session prompts before discarding the work.
  const handleModeClick = (id: WorkspaceMode) => {
    if (id === view) return
    if (view === 'sketch') {
      const sketch = useSketchStore.getState()
      if (sketch.isDirty) {
        const ok = window.confirm(
          'You have unsaved sketch changes. Leave and discard them?'
        )
        if (!ok) return
      }
      sketch.reset()
    }
    setMode(id)
  }

  return (
    <nav className="flex h-full w-14 flex-col items-center gap-1 border-r border-sm-border bg-sm-surface py-3">
      {MODES.map(({ id, label, Icon }) => {
        const active = view === id
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => handleModeClick(id)}
            className={
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors ' +
              (active
                ? 'bg-sm-ink text-white'
                : 'text-sm-ink2 hover:bg-sm-border-soft')
            }
          >
            <Icon size={18} />
          </button>
        )
      })}

      <div className="mt-auto">
        <button
          type="button"
          title="Help"
          aria-label="Help"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm-ink3 transition-colors hover:bg-sm-border-soft"
        >
          <HelpCircle size={18} />
        </button>
      </div>
    </nav>
  )
}
