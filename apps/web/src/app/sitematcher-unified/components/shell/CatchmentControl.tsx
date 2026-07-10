'use client'

import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type { CatchmentMode } from '../../types/unified-workspace'

const MODE_OPTIONS: { value: CatchmentMode; label: string }[] = [
  { value: 'distance', label: 'Radius' },
  { value: 'drive', label: 'Drive' },
  { value: 'walk', label: 'Walk' },
]

// Sensible per-mode range + default when the surveyor switches definition type.
// Radius is kilometres; drive/walk are minutes.
export const MODE_RANGE: Record<
  CatchmentMode,
  { min: number; max: number; step: number; def: number; unit: string }
> = {
  distance: { min: 1, max: 20, step: 1, def: 5, unit: 'km' },
  drive: { min: 5, max: 30, step: 5, def: 10, unit: 'min' },
  walk: { min: 5, max: 30, step: 5, def: 15, unit: 'min' },
}

// The single catchment definition control (Radius km / Drive / Walk min).
// Shared by the Assess-mode left panel and the BUA-mode Catchment tab.
export function CatchmentControl() {
  const catchment = useWorkspaceStore((s) => s.catchment)
  const setCatchment = useWorkspaceStore((s) => s.setCatchment)
  const range = MODE_RANGE[catchment.mode]

  return (
    <div>
      <p className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
        Catchment
      </p>
      <div className="mt-1.5 flex gap-1 rounded-lg bg-sm-bg p-1">
        {MODE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              setCatchment({ mode: o.value, value: MODE_RANGE[o.value].def })
            }
            className={
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ' +
              (catchment.mode === o.value
                ? 'bg-sm-ink text-white'
                : 'text-sm-ink2 hover:bg-sm-border-soft')
            }
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-sm-ink2">
        <span>
          {catchment.mode === 'distance'
            ? `${catchment.value} km`
            : `${catchment.value} min ${catchment.mode}`}
        </span>
        <span className="text-sm-ink4">
          {range.min}–{range.max} {range.unit}
        </span>
      </div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={catchment.value}
        onChange={(e) =>
          setCatchment({ mode: catchment.mode, value: Number(e.target.value) })
        }
        className="mt-2 w-full accent-sm-violet"
      />
    </div>
  )
}
