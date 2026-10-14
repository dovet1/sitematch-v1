'use client'

import { useCallback } from 'react'
import { useWorkspaceStore } from '../stores/unified-workspace-store'
import { usePlanningMonitorStore } from '../stores/planning-monitor-store'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import type { WorkspaceMode } from '../../types/unified-workspace'

/**
 * The one way to change mode from the rail or the mode chooser, so both apply the same guards:
 * a patch being drawn locks the other modes, and leaving a dirty sketch asks first.
 * `switchMode` returns whether the mode actually changed (or was already active).
 */
export function useSwitchMode() {
  const view = useWorkspaceStore((s) => s.view)
  // Drawing a patch takes over the view: the other modes grey out until it is saved or cancelled.
  const drawingPatch = usePlanningMonitorStore((s) => view === 'planning' && s.drawing != null)

  const switchMode = useCallback(
    (id: WorkspaceMode): boolean => {
      const current = useWorkspaceStore.getState().view
      if (id === current) return true
      if (current === 'planning' && usePlanningMonitorStore.getState().drawing != null) return false
      // Leaving a dirty sketch session prompts before discarding the work.
      if (current === 'sketch') {
        const sketch = useSketchStore.getState()
        if (sketch.isDirty) {
          const ok = window.confirm('You have unsaved sketch changes. Leave and discard them?')
          if (!ok) return false
        }
        sketch.reset()
      }
      // Leaving Planning drops its selection and any open editor; saved patches are untouched.
      if (current === 'planning') usePlanningMonitorStore.getState().reset()
      useWorkspaceStore.getState().setMode(id)
      return true
    },
    []
  )

  return { view, drawingPatch, switchMode }
}
