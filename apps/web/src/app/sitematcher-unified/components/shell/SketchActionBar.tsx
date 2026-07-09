'use client'

import { useEffect, useState } from 'react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { getSketchObjectCount } from '@/lib/sitesketcher-v2/object-count'
import { SaveModal } from '../../../sitesketcher-v2/components/modals/SaveModal'
import { NewSketchConfirmModal } from '../../../sitesketcher-v2/components/modals/NewSketchConfirmModal'
import { Save, FilePlus, Undo2, Redo2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Compact sketch controls for the Unified Workspace. Ports TopBar's save / new /
 * auto-save behaviour (the workspace is Plus-gated so the upgrade path is
 * dropped) into a floating bar that sits over the shared map.
 */
export function SketchActionBar() {
  const {
    sketchId,
    sketchName,
    sketchDescription,
    isDirty,
    canUndo,
    canRedo,
    undo,
    redo,
    getSketchData,
    setSketchName,
    setSketchDescription,
    setSketchId,
    setLastSaved,
    markClean,
    reset,
    polygons,
    parkingBlocks,
    cadImages,
    cadInstances,
  } = useSketchStore()

  const [saving, setSaving] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showNewSketchModal, setShowNewSketchModal] = useState(false)

  const objectCount = getSketchObjectCount({ polygons, parkingBlocks, cadImages, cadInstances })
  const totalObjects = objectCount.polygons + objectCount.parkingBlocks + objectCount.cadImages
  const hasCurrentWork = Boolean(sketchId) || isDirty || totalObjects > 0
  const newSketchMode = !sketchId ? 'unsaved' : isDirty ? 'saved-dirty' : 'saved-clean'

  const performSave = async (name: string, description: string): Promise<boolean> => {
    setSaving(true)
    try {
      const data = getSketchData()
      const url = sketchId
        ? `/api/sitesketcher-v2/sketches/${sketchId}`
        : '/api/sitesketcher-v2/sketches'
      const response = await fetch(url, {
        method: sketchId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, data }),
      })

      if (response.status === 403) {
        const error = await response.json()
        toast.error(error.error || 'Pro subscription required to save')
        return false
      }
      if (!response.ok) throw new Error('Failed to save sketch')

      const result = await response.json()
      if (!sketchId) setSketchId(result.sketch.id)
      setSketchName(result.sketch.name)
      setSketchDescription(result.sketch.description || '')
      setLastSaved(new Date(result.sketch.updated_at))
      markClean()
      return true
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save sketch. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleModalSave = async (data: { name: string; description?: string }) => {
    const success = await performSave(data.name, data.description ?? '')
    if (success) setShowSaveModal(false)
  }

  const handleSave = async () => {
    if (!sketchId) {
      setShowSaveModal(true)
      return
    }
    await performSave(sketchName, sketchDescription)
  }

  const startNewSketch = () => {
    const hadSavedSketch = Boolean(sketchId)
    reset()
    setShowNewSketchModal(false)
    toast.success(
      hadSavedSketch
        ? 'Started a new sketch. Your previous sketch is still saved.'
        : 'Started a new sketch.'
    )
  }

  const handleNewSketch = () => {
    if (!hasCurrentWork) return
    setShowNewSketchModal(true)
  }

  const handleSaveAndStartNew = async () => {
    const success = await performSave(sketchName, sketchDescription)
    if (success) startNewSketch()
  }

  // Auto-save existing sketches (1s debounce), matching the standalone TopBar.
  useEffect(() => {
    if (!sketchId || !isDirty || saving || showSaveModal || showNewSketchModal) return

    const timer = setTimeout(async () => {
      try {
        const data = getSketchData()
        const response = await fetch(`/api/sitesketcher-v2/sketches/${sketchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sketchName, description: sketchDescription, data }),
        })
        if (response.ok) {
          const result = await response.json()
          setLastSaved(new Date(result.sketch.updated_at))
          markClean()
        }
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [
    isDirty,
    sketchId,
    sketchName,
    sketchDescription,
    saving,
    showSaveModal,
    showNewSketchModal,
    getSketchData,
    setLastSaved,
    markClean,
  ])

  const iconBtn =
    'flex h-8 w-8 items-center justify-center rounded-lg text-sm-ink2 transition-colors hover:bg-sm-bg disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <>
      <div className="pointer-events-auto absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-sm-border bg-sm-surface/95 px-2 py-1.5 shadow-lg backdrop-blur">
        <span className="max-w-[180px] truncate px-1.5 text-[13px] font-medium text-sm-ink">
          {sketchName}
        </span>
        {isDirty && (
          <span className="h-1.5 w-1.5 rounded-full bg-sm-violet" title="Unsaved changes" />
        )}

        <span className="mx-1 h-5 w-px bg-sm-border-soft" />

        <button
          type="button"
          onClick={() => canUndo() && undo()}
          disabled={!canUndo()}
          title="Undo (⌘Z)"
          className={iconBtn}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => canRedo() && redo()}
          disabled={!canRedo()}
          title="Redo (⌘⇧Z)"
          className={iconBtn}
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-sm-border-soft" />

        <button
          type="button"
          onClick={handleNewSketch}
          disabled={!hasCurrentWork || saving}
          title="New sketch"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-sm-border bg-sm-surface px-2.5 text-[13px] font-medium text-sm-ink2 transition-colors hover:bg-sm-bg disabled:opacity-40"
        >
          <FilePlus className="h-3.5 w-3.5" />
          New
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          title="Save (⌘S)"
          className="flex h-8 items-center gap-1.5 rounded-lg bg-sm-violet px-3 text-[13px] font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:opacity-40 disabled:hover:bg-sm-violet"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {showSaveModal && (
        <SaveModal
          currentName={sketchName}
          currentDescription={sketchDescription}
          objectCount={objectCount}
          onSave={handleModalSave}
          onCancel={() => setShowSaveModal(false)}
          isLoading={saving}
        />
      )}

      {showNewSketchModal && (
        <NewSketchConfirmModal
          mode={newSketchMode}
          sketchName={sketchName}
          objectCount={objectCount}
          onCancel={() => setShowNewSketchModal(false)}
          onStartNew={startNewSketch}
          onSaveAndStart={handleSaveAndStartNew}
          isLoading={saving}
        />
      )}
    </>
  )
}
