'use client'

import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type { CatchmentData } from '../../lib/hooks/useCatchment'
import { DemographicsResults } from '@/components/demographics/DemographicsResults'
import { CatchmentControl } from './CatchmentControl'

export function CatchmentTab({ data }: { data: CatchmentData }) {
  const showLsoa = useWorkspaceStore((s) => s.showLsoa)
  const toggleShowLsoa = useWorkspaceStore((s) => s.toggleShowLsoa)
  const view = useWorkspaceStore((s) => s.view)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)

  // In Assess mode the left panel owns the catchment control, so hide the
  // duplicate here. For a selected BUA there's no left control, so keep it.
  const showControl = !(view === 'assess' && assessPoint)

  const total = data.allLsoaCodes.length
  const selected = data.selectedLsoaCodes.size
  const pct = total > 0 ? Math.max(4, Math.round((selected / total) * 100)) : 0

  return (
    <div>
      {showControl && (
        <div className="border-b border-sm-border-soft px-[18px] py-[18px]">
          <CatchmentControl />
        </div>
      )}

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
          distanceUnit="km"
        />
      </div>
    </div>
  )
}
