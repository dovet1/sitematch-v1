'use client'

import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type {
  CatchmentDefinition,
  CatchmentMode,
} from '../../types/unified-workspace'

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

// Presentational catchment definition control (Radius km / Drive / Walk min).
// Fully controlled — the caller owns the value and the change handler, so the
// same UI drives the global store (via CatchmentControl) or a single compare arm.
export function CatchmentPicker({
  value,
  onChange,
}: {
  value: CatchmentDefinition
  onChange: (catchment: CatchmentDefinition) => void
}) {
  const range = MODE_RANGE[value.mode]

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
              onChange({ mode: o.value, value: MODE_RANGE[o.value].def })
            }
            className={
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ' +
              (value.mode === o.value
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
          {value.mode === 'distance'
            ? `${value.value} km`
            : `${value.value} min ${value.mode}`}
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
        value={value.value}
        onChange={(e) =>
          onChange({ mode: value.mode, value: Number(e.target.value) })
        }
        className="mt-2 w-full accent-sm-violet"
      />
    </div>
  )
}

// Store-bound wrapper: the single global catchment control.
// Shared by the Assess-mode left panel (single pin) and the BUA-mode Catchment tab.
export function CatchmentControl() {
  const catchment = useWorkspaceStore((s) => s.catchment)
  const setCatchment = useWorkspaceStore((s) => s.setCatchment)
  return <CatchmentPicker value={catchment} onChange={setCatchment} />
}
