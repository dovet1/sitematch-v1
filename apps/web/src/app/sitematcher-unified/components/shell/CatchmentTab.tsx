'use client'

import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type { CatchmentMode } from '../../types/unified-workspace'
import type { CatchmentData } from '../../lib/hooks/useCatchment'
import { DemographicsResults } from '@/components/demographics/DemographicsResults'

const MODE_OPTIONS: { value: CatchmentMode; label: string }[] = [
  { value: 'distance', label: 'Radius' },
  { value: 'drive', label: 'Drive' },
  { value: 'walk', label: 'Walk' },
]

// Sensible per-mode range + default when the surveyor switches definition type.
const MODE_RANGE: Record<CatchmentMode, { min: number; max: number; step: number; def: number; unit: string }> = {
  distance: { min: 1, max: 20, step: 1, def: 5, unit: 'mi' },
  drive: { min: 5, max: 30, step: 5, def: 10, unit: 'min' },
  walk: { min: 5, max: 30, step: 5, def: 15, unit: 'min' },
}

export function CatchmentTab({ data }: { data: CatchmentData }) {
  const catchment = useWorkspaceStore((s) => s.catchment)
  const setCatchment = useWorkspaceStore((s) => s.setCatchment)
  const showLsoa = useWorkspaceStore((s) => s.showLsoa)
  const toggleShowLsoa = useWorkspaceStore((s) => s.toggleShowLsoa)

  const range = MODE_RANGE[catchment.mode]
  const total = data.allLsoaCodes.length
  const selected = data.selectedLsoaCodes.size
  const pct = total > 0 ? Math.max(4, Math.round((selected / total) * 100)) : 0

  return (
    <div>
      <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
        {/* Definition type */}
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

        {/* Size slider */}
        <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-sm-ink2">
          <span>
            {catchment.mode === 'distance'
              ? `${catchment.value} mile${catchment.value !== 1 ? 's' : ''}`
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

      {/* LSOA overlay toggle + selection stats */}
      <div className="border-b border-sm-border-soft px-[18px] py-3">
        <button
          type="button"
          onClick={toggleShowLsoa}
          className="flex w-full items-center justify-between"
        >
          <div className="text-left">
            <div className="text-[13px] font-medium text-sm-ink">Show LSOA overlay</div>
            <div className="text-[11.5px] text-sm-ink3">
              Click cells on the map to refine the catchment
            </div>
          </div>
          <span
            className={
              'relative h-[18px] w-8 shrink-0 rounded-full transition-colors ' +
              (showLsoa ? 'bg-sm-violet' : 'bg-[#DDD6CA]')
            }
          >
            <span
              className={
                'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ' +
                (showLsoa ? 'left-4' : 'left-0.5')
              }
            />
          </span>
        </button>

        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold text-sm-ink">{selected}</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
                of {total} areas selected
              </span>
              <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-sm-border-soft">
                <span
                  className="block h-full bg-sm-violet transition-all"
                  style={{ width: `${pct}%` }}
                />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Reused SiteAnalyser demographic report */}
      <div className="px-6 py-[18px]">
        <DemographicsResults
          loading={data.loading}
          error={data.error}
          location={data.location}
          measurementMode={data.measurementMode}
          measurementValue={data.measurementValue}
          totalLsoaCount={total}
          rawData={data.rawData}
          selectedLsoaCodes={data.selectedLsoaCodes}
          nationalAverages={data.nationalAverages}
          isFreeTier={false}
        />
      </div>
    </div>
  )
}
