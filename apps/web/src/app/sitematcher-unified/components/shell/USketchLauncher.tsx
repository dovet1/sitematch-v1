'use client'

import { useEffect, useState } from 'react'
import { Plus, Loader2, Trash2, PenTool } from 'lucide-react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'

interface SavedSketch {
  id: string
  name: string
  updated_at: string
  data: { polygons?: unknown[]; parkingBlocks?: unknown[] }
}

function relativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateString).toLocaleDateString()
}

// The start screen for Sketch mode: begin a fresh session or reopen a saved
// sketch. Mirrors the standalone SavedSketchesPanel's data flow.
export function USketchLauncher({ onActivate }: { onActivate: () => void }) {
  const loadSketch = useSketchStore((s) => s.loadSketch)
  const reset = useSketchStore((s) => s.reset)
  const [sketches, setSketches] = useState<SavedSketch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSketches = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/sitesketcher-v2/sketches')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load sketches')
      }
      const data = await res.json()
      setSketches(data.sketches || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sketches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSketches()
  }, [])

  const handleStartNew = () => {
    reset()
    onActivate()
  }

  const handleOpen = async (sketch: SavedSketch) => {
    try {
      const res = await fetch(`/api/sitesketcher-v2/sketches/${sketch.id}`)
      if (!res.ok) throw new Error('Failed to load sketch')
      const data = await res.json()
      loadSketch(data.sketch)
      onActivate()
    } catch {
      setError('Failed to open sketch')
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return
    try {
      const res = await fetch(`/api/sitesketcher-v2/sketches/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      fetchSketches()
    } catch {
      setError('Failed to delete sketch')
    }
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r border-sm-border bg-sm-surface">
      <div className="border-b border-sm-border-soft px-4 py-4">
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
          Sketch site
        </span>
        <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.3px] text-sm-ink">
          Start a sketch
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sm-ink3">
          Draw plots, parking and overlay CAD plans on the parcel.
        </p>
        <button
          type="button"
          onClick={handleStartNew}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-sm-violet px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-sm-violet-deep"
        >
          <Plus size={15} /> New sketch
        </button>
      </div>

      <div className="border-y border-sm-border-soft bg-sm-bg px-4 py-2.5">
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
          Saved sketches
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-sm-violet" />
          </div>
        )}
        {error && !loading && (
          <div className="px-2 py-6 text-center text-[12.5px] text-[#B23A2C]">{error}</div>
        )}
        {!loading && !error && sketches.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-2 py-10 text-center text-sm-ink3">
            <PenTool size={20} />
            <p className="text-[12.5px]">No saved sketches yet.</p>
          </div>
        )}
        {!loading &&
          !error &&
          sketches.map((sketch) => {
            const polygonCount = sketch.data?.polygons?.length || 0
            const parkingCount = sketch.data?.parkingBlocks?.length || 0
            return (
              <button
                key={sketch.id}
                type="button"
                onClick={() => handleOpen(sketch)}
                className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-sm-border hover:bg-sm-bg"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-sm-ink">
                    {sketch.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
                    <span>{relativeTime(sketch.updated_at)}</span>
                    <span>·</span>
                    <span>
                      {polygonCount} plot{polygonCount !== 1 ? 's' : ''}
                    </span>
                    {parkingCount > 0 && <span>· {parkingCount} parking</span>}
                  </div>
                </div>
                <span
                  onClick={(e) => handleDelete(e, sketch.id, sketch.name)}
                  className="rounded p-1.5 text-sm-ink3 opacity-0 transition-opacity hover:bg-[#FBEEEC] hover:text-[#B23A2C] group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </span>
              </button>
            )
          })}
      </div>
    </aside>
  )
}
