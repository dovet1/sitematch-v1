'use client'

import { MapPin, Search, PenTool, Layers, HelpCircle, ClipboardList, Store } from 'lucide-react'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import type { WorkspaceMode } from '../../types/unified-workspace'
import { usePlanningMonitorEnabled } from '../../lib/planning-monitor-flag-context'
import { usePlanningMonitorStore } from '../../lib/stores/planning-monitor-store'
import { useBrandMatcherEnabled } from '../../lib/brand-matcher-flag-context'

// Requirements mode is deferred in v1 (see plan). Directory is a full-pane, map-less mode.
const MODES: { id: WorkspaceMode; label: string; Icon: typeof MapPin }[] = [
  { id: 'assess', label: 'Assess Area', Icon: MapPin },
  { id: 'find', label: 'Find Gaps', Icon: Search },
  { id: 'sketch', label: 'Sketch Site', Icon: PenTool },
  { id: 'directory', label: 'Directory', Icon: Layers },
]

// Offered only while the Planning Monitor flag is on.
const PLANNING_MODE = { id: 'planning' as const, label: 'Planning monitor', Icon: ClipboardList }
// Offered only while the Brand Matcher flag is on.
const BRAND_MATCHER_MODE = { id: 'brand-matcher' as const, label: 'Brand Matcher', Icon: Store }

export function URail() {
  const view = useWorkspaceStore((s) => s.view)
  const setMode = useWorkspaceStore((s) => s.setMode)
  const planningEnabled = usePlanningMonitorEnabled()
  const brandMatcherEnabled = useBrandMatcherEnabled()
  const modes = [
    ...MODES.slice(0, 3),
    ...(planningEnabled ? [PLANNING_MODE] : []),
    ...(brandMatcherEnabled ? [BRAND_MATCHER_MODE] : []),
    MODES[3],
  ]
  // Drawing a patch takes over the view: the other modes grey out until it is saved or cancelled.
  const drawingPatch = usePlanningMonitorStore((s) => view === 'planning' && s.drawing != null)

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
    // Leaving Planning drops its selection and any open editor; saved patches are untouched.
    if (view === 'planning') usePlanningMonitorStore.getState().reset()
    setMode(id)
  }

  return (
    <nav className="flex h-full w-14 flex-col items-center gap-1 border-r border-sm-border bg-sm-surface py-3">
      {modes.map(({ id, label, Icon }) => {
        const active = view === id
        const locked = drawingPatch && !active
        return (
          <button
            key={id}
            type="button"
            title={locked ? 'Finish or cancel the patch first' : label}
            aria-label={label}
            aria-pressed={active}
            disabled={locked}
            onClick={() => handleModeClick(id)}
            className={
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors ' +
              (active
                ? 'bg-sm-ink text-white'
                : locked
                  ? 'cursor-not-allowed text-[#D5D0C8]'
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
