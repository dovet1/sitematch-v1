'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MousePointer2,
  Pentagon,
  Car,
  Layers as LayersIcon,
  Ruler,
  ChevronLeft,
  Save,
  Loader2,
  Minus,
  Plus,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { POLYGON_COLORS, PARKING_DIMENSIONS } from '@/lib/sitesketcher-v2/constants'
import { calculatePolygonArea } from '@/lib/sitesketcher-v2/polygon-utils'
import type { Tool } from '@/types/sitesketcher-v2'
import { SaveModal } from '../../../sitesketcher-v2/components/modals/SaveModal'
import { getSketchObjectCount } from '@/lib/sitesketcher-v2/object-count'
import { UCadLibrary } from './UCadLibrary'

const SKETCH_TOOLS: { id: Tool; label: string; key: string; Icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', key: 'V', Icon: MousePointer2 },
  { id: 'polygon', label: 'Polygon', key: 'P', Icon: Pentagon },
  { id: 'parking', label: 'Parking', key: 'K', Icon: Car },
  { id: 'cad', label: 'CAD', key: 'C', Icon: LayersIcon },
  { id: 'measure', label: 'Measure', key: 'M', Icon: Ruler },
]

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
      {children}
    </span>
  )
}

function formatArea(sqm: number) {
  if (sqm < 10000) return `${sqm.toFixed(0)} m²`
  return `${(sqm / 10000).toFixed(2)} ha`
}

export function USketchPanel({ onExit }: { onExit: () => void }) {
  const activeTool = useSketchStore((s) => s.activeTool)
  const setActiveTool = useSketchStore((s) => s.setActiveTool)
  const sketchName = useSketchStore((s) => s.sketchName)
  const setSketchName = useSketchStore((s) => s.setSketchName)
  const sketchId = useSketchStore((s) => s.sketchId)
  const sketchDescription = useSketchStore((s) => s.sketchDescription)
  const isDirty = useSketchStore((s) => s.isDirty)
  const lastSaved = useSketchStore((s) => s.lastSaved)
  const getSketchData = useSketchStore((s) => s.getSketchData)
  const setSketchId = useSketchStore((s) => s.setSketchId)
  const setSketchDescription = useSketchStore((s) => s.setSketchDescription)
  const setLastSaved = useSketchStore((s) => s.setLastSaved)
  const markClean = useSketchStore((s) => s.markClean)

  const [saving, setSaving] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)

  const polygons = useSketchStore((s) => s.polygons)
  const parkingBlocks = useSketchStore((s) => s.parkingBlocks)
  const cadImages = useSketchStore((s) => s.cadImages)
  const cadInstances = useSketchStore((s) => s.cadInstances)

  const objectCount = getSketchObjectCount({ polygons, parkingBlocks, cadImages, cadInstances })

  const performSave = async (name: string, description: string): Promise<boolean> => {
    setSaving(true)
    try {
      const data = getSketchData()
      const url = sketchId
        ? `/api/sitesketcher-v2/sketches/${sketchId}`
        : '/api/sitesketcher-v2/sketches'
      const res = await fetch(url, {
        method: sketchId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, data }),
      })
      if (res.status === 403) {
        const err = await res.json()
        toast.error(err.error || 'Plus subscription required to save')
        return false
      }
      if (!res.ok) throw new Error('Failed to save sketch')
      const result = await res.json()
      if (!sketchId) setSketchId(result.sketch.id)
      setSketchName(result.sketch.name)
      setSketchDescription(result.sketch.description || '')
      setLastSaved(new Date(result.sketch.updated_at))
      markClean()
      return true
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Failed to save sketch. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!sketchId) {
      setShowSaveModal(true)
      return
    }
    await performSave(sketchName, sketchDescription)
  }

  // Auto-save existing sketches (1s debounce), matching the standalone flow.
  useEffect(() => {
    if (!sketchId || !isDirty || saving || showSaveModal) return
    const timer = setTimeout(async () => {
      try {
        const data = getSketchData()
        const res = await fetch(`/api/sitesketcher-v2/sketches/${sketchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sketchName, description: sketchDescription, data }),
        })
        if (res.ok) {
          const result = await res.json()
          setLastSaved(new Date(result.sketch.updated_at))
          markClean()
        }
      } catch (err) {
        console.error('Auto-save failed:', err)
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
    getSketchData,
    setLastSaved,
    markClean,
  ])

  const handleExit = () => {
    if (isDirty && !confirm('You have unsaved sketch changes. Leave and discard them?')) return
    onExit()
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r border-sm-border bg-sm-surface">
      {/* Session bar */}
      <div className="border-b border-sm-border-soft px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1 text-[12px] font-medium text-sm-ink3 transition-colors hover:text-sm-ink2"
          >
            <ChevronLeft size={13} /> Sketches
          </button>
          <AutosaveChip saving={saving} isDirty={isDirty} lastSaved={lastSaved} />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={sketchName}
            onChange={(e) => setSketchName(e.target.value)}
            placeholder="Untitled sketch"
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-semibold text-sm-ink hover:border-sm-border focus:border-sm-violet focus:bg-sm-surface focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            title="Save (⌘S)"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-sm-violet px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:opacity-40 disabled:hover:bg-sm-violet"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        </div>
      </div>

      {/* Tool selector */}
      <div className="grid grid-cols-5 gap-1 border-b border-sm-border-soft p-2">
        {SKETCH_TOOLS.map(({ id, label, key, Icon }) => {
          const active = activeTool === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTool(id)}
              title={`${label} (${key})`}
              className={
                'flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors ' +
                (active
                  ? 'bg-sm-violet-tint-soft text-sm-violet-deep'
                  : 'text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink2')
              }
            >
              <Icon size={16} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Per-tool content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTool === 'select' && <LayersPanel />}
        {activeTool === 'polygon' && <PolygonPanel />}
        {activeTool === 'parking' && <ParkingPanel />}
        {activeTool === 'cad' && <UCadLibrary />}
        {activeTool === 'measure' && <MeasurePanel />}
      </div>

      {showSaveModal && (
        <SaveModal
          currentName={sketchName}
          currentDescription={sketchDescription}
          objectCount={objectCount}
          onSave={async (data: { name: string; description?: string }) => {
            const ok = await performSave(data.name, data.description ?? '')
            if (ok) setShowSaveModal(false)
          }}
          onCancel={() => setShowSaveModal(false)}
          isLoading={saving}
        />
      )}
    </aside>
  )
}

function AutosaveChip({
  saving,
  isDirty,
  lastSaved,
}: {
  saving: boolean
  isDirty: boolean
  lastSaved: Date | null
}) {
  const [, force] = useState(0)
  // Refresh the "x ago" label periodically.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  let label = 'Not saved yet'
  if (saving) label = 'Saving…'
  else if (isDirty) label = 'Unsaved changes'
  else if (lastSaved) {
    const mins = Math.floor((Date.now() - lastSaved.getTime()) / 60000)
    label = mins < 1 ? 'Saved · just now' : `Saved · ${mins}m ago`
  }

  return (
    <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wide text-sm-ink3">
      {saving && <Loader2 size={10} className="animate-spin" />}
      {!saving && isDirty && <span className="h-1.5 w-1.5 rounded-full bg-sm-violet" />}
      {label}
    </span>
  )
}

/* ---------- Select → Layers ---------- */

function LayersPanel() {
  const polygons = useSketchStore((s) => s.polygons)
  const parkingBlocks = useSketchStore((s) => s.parkingBlocks)
  const cadInstances = useSketchStore((s) => s.cadInstances)
  const selectedId = useSketchStore((s) => s.selectedId)
  const setSelectedId = useSketchStore((s) => s.setSelectedId)
  const getCadForInstance = useSketchStore((s) => s.getCadForInstance)

  const empty = polygons.length === 0 && parkingBlocks.length === 0 && cadInstances.length === 0

  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm-ink3">
        <MousePointer2 size={20} />
        <p className="text-[12.5px] leading-relaxed">
          Nothing drawn yet. Pick a tool above and click the map to begin.
        </p>
      </div>
    )
  }

  const rowCls = (id: string) =>
    'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ' +
    (selectedId === id
      ? 'border-sm-violet bg-sm-violet-tint-soft'
      : 'border-transparent hover:border-sm-border hover:bg-sm-bg')

  return (
    <div className="flex flex-col gap-3 p-3">
      {polygons.length > 0 && (
        <div>
          <div className="px-1 pb-1.5">
            <Kicker>Plots · {polygons.length}</Kicker>
          </div>
          <div className="flex flex-col gap-1">
            {polygons.map((p) => {
              const color = POLYGON_COLORS[p.colorIndex % POLYGON_COLORS.length]
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id, 'polygon')}
                  className={rowCls(p.id)}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded"
                    style={{ backgroundColor: color.stroke }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-sm-ink">
                    {p.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-sm-ink3">
                    {formatArea(calculatePolygonArea(p.points))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {parkingBlocks.length > 0 && (
        <div>
          <div className="px-1 pb-1.5">
            <Kicker>Parking · {parkingBlocks.length}</Kicker>
          </div>
          <div className="flex flex-col gap-1">
            {parkingBlocks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id, 'parking')}
                className={rowCls(b.id)}
              >
                <Car size={14} className="shrink-0 text-sm-ink2" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-sm-ink">
                  {b.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-sm-ink3">
                  {b.spaces} sp
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {cadInstances.length > 0 && (
        <div>
          <div className="px-1 pb-1.5">
            <Kicker>CAD overlays · {cadInstances.length}</Kicker>
          </div>
          <div className="flex flex-col gap-1">
            {cadInstances.map((inst) => {
              const cad = getCadForInstance(inst.id)
              return (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => setSelectedId(inst.id, 'cad')}
                  className={rowCls(inst.id)}
                >
                  <LayersIcon size={14} className="shrink-0 text-sm-ink2" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-sm-ink">
                    {cad?.name || 'CAD overlay'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Polygon ---------- */

function PolygonPanel() {
  const selectedPolygonColorIndex = useSketchStore((s) => s.selectedPolygonColorIndex)
  const setSelectedPolygonColorIndex = useSketchStore((s) => s.setSelectedPolygonColorIndex)
  const sideLabelsOn = useSketchStore((s) => s.sideLabelsOn)
  const setSideLabelsOn = useSketchStore((s) => s.setSideLabelsOn)

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-[12px] leading-relaxed text-sm-ink3">
        Click the map to drop points. Double-click or press Enter to close the plot.
      </p>

      <div>
        <div className="pb-2">
          <Kicker>Colour</Kicker>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {POLYGON_COLORS.map((c, i) => (
            <button
              key={c.label}
              type="button"
              title={c.label}
              onClick={() => setSelectedPolygonColorIndex(i)}
              className={
                'flex aspect-square items-center justify-center rounded-lg border-2 transition-all ' +
                (selectedPolygonColorIndex === i
                  ? 'border-sm-ink'
                  : 'border-transparent hover:border-sm-border')
              }
              style={{ backgroundColor: c.fill }}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.stroke }} />
            </button>
          ))}
        </div>
      </div>

      <Toggle
        label="Edge distances"
        description="Show side lengths while drawing"
        checked={sideLabelsOn}
        onChange={setSideLabelsOn}
      />

      <ShortcutList
        items={[
          ['Enter', 'Close plot'],
          ['Esc', 'Cancel'],
          ['V', 'Back to select'],
        ]}
      />
    </div>
  )
}

/* ---------- Parking ---------- */

function ParkingPanel() {
  const parkingPlacement = useSketchStore((s) => s.parkingPlacement)
  const setParkingPlacement = useSketchStore((s) => s.setParkingPlacement)
  const { spaces, layout, stallSize } = parkingPlacement

  const stall = PARKING_DIMENSIONS[stallSize]
  const totalLength = stall.width * spaces
  const totalWidth = stall.length * (layout === 'double' ? 2 : 1)

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-[12px] leading-relaxed text-sm-ink3">
        Configure a bay block, then click the map to place it.
      </p>

      <div>
        <div className="pb-2">
          <Kicker>Spaces</Kicker>
        </div>
        <div className="flex items-center gap-2">
          <StepBtn
            onClick={() => setParkingPlacement({ spaces: Math.max(1, spaces - 1) })}
            disabled={spaces <= 1}
          >
            <Minus size={14} />
          </StepBtn>
          <span className="flex-1 text-center text-[16px] font-semibold text-sm-ink">
            {spaces}
          </span>
          <StepBtn onClick={() => setParkingPlacement({ spaces: spaces + 1 })}>
            <Plus size={14} />
          </StepBtn>
        </div>
      </div>

      <Segmented
        label="Layout"
        value={layout}
        options={[
          { value: 'single', label: 'Single' },
          { value: 'double', label: 'Double' },
        ]}
        onChange={(v) => setParkingPlacement({ layout: v as 'single' | 'double' })}
      />

      <Segmented
        label="Stall size"
        value={stallSize}
        options={[
          { value: 'standard', label: 'Standard' },
          { value: 'larger', label: 'Larger' },
        ]}
        onChange={(v) => setParkingPlacement({ stallSize: v as 'standard' | 'larger' })}
      />

      <div className="rounded-xl border border-sm-border bg-sm-bg px-3 py-2.5">
        <Kicker>Block footprint</Kicker>
        <div className="mt-1 font-mono text-[13px] text-sm-ink">
          {totalLength.toFixed(1)} × {totalWidth.toFixed(1)} m
        </div>
      </div>
    </div>
  )
}

/* ---------- Measure ---------- */

function MeasurePanel() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-dashed border-sm-border bg-sm-bg px-3 py-6 text-center text-[12.5px] leading-relaxed text-sm-ink3">
        Click the map to start a measurement chain. Each click adds a point.
      </div>
      <ShortcutList
        items={[
          ['Enter', 'Finish chain'],
          ['Esc', 'Cancel'],
        ]}
      />
    </div>
  )
}

/* ---------- Shared primitives ---------- */

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-lg border border-sm-border bg-sm-surface px-3 py-2.5 text-left transition-colors hover:bg-sm-bg"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-sm-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[11px] text-sm-ink3">{description}</span>
        )}
      </span>
      <span
        className={
          'flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ' +
          (checked ? 'bg-sm-violet' : 'bg-sm-border')
        }
      >
        <span
          className={
            'h-4 w-4 rounded-full bg-white transition-transform ' +
            (checked ? 'translate-x-4' : 'translate-x-0')
          }
        />
      </span>
    </button>
  )
}

function StepBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-sm-border bg-sm-surface text-sm-ink2 transition-colors hover:bg-sm-bg disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="pb-2">
        <Kicker>{label}</Kicker>
      </div>
      <div className="flex rounded-lg border border-sm-border p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              'flex-1 rounded-md py-1.5 text-[12.5px] font-medium transition-colors ' +
              (value === o.value
                ? 'bg-sm-violet text-white'
                : 'text-sm-ink2 hover:bg-sm-bg')
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ShortcutList({ items }: { items: [string, string][] }) {
  return (
    <div className="rounded-xl border border-sm-border bg-sm-bg p-3">
      <div className="pb-2">
        <Kicker>Shortcuts</Kicker>
      </div>
      <dl className="flex flex-col gap-1.5">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-[12px] text-sm-ink3">{v}</dt>
            <dd>
              <kbd className="rounded border border-sm-border bg-sm-surface px-1.5 py-0.5 font-mono text-[10px] text-sm-ink2">
                {k}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
