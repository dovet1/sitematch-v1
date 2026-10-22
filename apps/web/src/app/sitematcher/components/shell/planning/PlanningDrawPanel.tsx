'use client'

import { useMemo, useState } from 'react'
import { parseCriteria } from '@/lib/planning-monitor/criteria'
import { usePlanningMonitorStore, type LngLat } from '../../../lib/stores/planning-monitor-store'
import { useDraftAuthority, useDraftCount } from '../../../lib/hooks/usePlanningMonitor'
import { areaLabel, crossingEdges, filterChips, ringAreaSqMi } from '../../../lib/planning-monitor-ui'
import type { DraftLocation } from '../../../lib/services/planning-monitor-service'
import { usePlanningMode } from './PlanningModeContext'
import { Eyebrow, FilterChipView, GroupLabel, OutlineButton, PrimaryButton, Spinner, Step, Toggle } from './PlanningUi'

/** A drawn ring as the API's draft location, or null while it cannot be a valid patch. */
export function drawnLocation(vertices: LngLat[]): DraftLocation | null {
  if (vertices.length < 3 || crossingEdges(vertices, true).length > 0) return null
  return { kind: 'drawn', geometry: { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] } }
}

function useDrawingStats() {
  const drawing = usePlanningMonitorStore((s) => s.drawing)
  const draftCriteria = usePlanningMonitorStore((s) => s.draftCriteria)
  const vertices = drawing?.vertices ?? []
  const key = JSON.stringify(vertices)
  const location = useMemo(() => drawnLocation(vertices), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const validation = useMemo(() => (draftCriteria ? parseCriteria(draftCriteria) : null), [draftCriteria])
  const count = useDraftCount({
    enabled: Boolean(location && validation?.ok),
    criteria: validation?.ok ? validation.criteria : (draftCriteria as never),
    location,
    patchId: null,
  })
  return { drawing, vertices, location, count, area: ringAreaSqMi(vertices) }
}

/** 1d · Trace the area you cover. The map handles the clicks; this panel tracks progress. */
export function PlanningDrawPanel() {
  const { drawing, vertices, count, area } = useDrawingStats()
  const undoVertex = usePlanningMonitorStore((s) => s.undoVertex)
  const clearDrawing = usePlanningMonitorStore((s) => s.clearDrawing)
  const toNameStep = usePlanningMonitorStore((s) => s.toNameStep)
  const endDrawing = usePlanningMonitorStore((s) => s.endDrawing)
  if (!drawing) return null
  const closed = drawing.closed
  const crossing = crossingEdges(vertices, closed).length > 0
  const closeBlocked = !closed && vertices.length >= 3 && crossingEdges(vertices, true).length > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
        <Eyebrow tone="violet">Drawing your patch</Eyebrow>
        <h2 className="mt-2 text-[21px] font-bold leading-tight tracking-[-0.02em] text-sm-ink">Trace the area you cover</h2>
        <p className="mt-2 text-[13.5px] leading-[1.5] text-[#57534E]">
          Click to drop points around your patch, then click the first point again to close it.
        </p>
        <ol className="mt-4 space-y-3">
          <Step n={1} state={closed ? 'done' : 'active'} title="Click to add points" hint={`${vertices.length} point${vertices.length === 1 ? '' : 's'} so far`} />
          <Step n={2} state={closed ? 'done' : vertices.length >= 3 ? 'active' : 'pending'} title="Close the shape" hint={closed ? 'Closed — drag points to adjust' : 'Click the first point, or press Enter'} />
          <Step n={3} state={closed ? 'active' : 'pending'} title="Name it and set filters" />
        </ol>

        <div className="mt-5 border-t border-[#EDEBE7] pt-4">
          <div className="rounded-[12px] border border-[#EDEBE7] bg-sm-bg px-3.5 py-3">
            <GroupLabel>Area so far</GroupLabel>
            <p className="mt-1 text-[19px] font-bold text-sm-ink">{vertices.length >= 3 ? areaLabel(area) : '—'}</p>
            <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#8A857D]">
              {count.loading ? <Spinner /> : count.result?.totals ? `≈ ${count.result.totals.developments.toLocaleString('en-GB')} developments inside` : vertices.length >= 3 ? (crossing || closeBlocked ? 'Shape crosses itself' : ' ') : 'Add three points to see matches'}
            </p>
          </div>
          {(crossing || closeBlocked) && (
            <p role="alert" className="mt-2 rounded-[10px] bg-[#FDEEE3] px-3 py-2 text-[12.5px] text-[#7A3B12]">
              {crossing ? 'Two edges cross. Move or undo a point.' : 'Closing now would cross an edge. Add or undo a point first.'}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <OutlineButton onClick={undoVertex} disabled={vertices.length === 0}>{closed ? 'Reopen shape' : 'Undo point'}</OutlineButton>
            <OutlineButton onClick={clearDrawing} disabled={vertices.length === 0}>Start again</OutlineButton>
          </div>
        </div>
      </div>
      <div className="px-5 pb-5">
        <PrimaryButton className="w-full" disabled={!closed || crossing} onClick={toNameStep}>
          {closed ? 'Continue' : 'Close the shape to continue'}
        </PrimaryButton>
        <button type="button" onClick={endDrawing} className="mt-2 w-full py-2 text-[13px] font-semibold text-[#57534E] hover:text-sm-ink">
          Cancel
        </button>
      </div>
    </div>
  )
}

/** 1e · Name it and set what counts: name, filters and email in one step. */
export function PlanningNamePanel() {
  const { vertices, location, count, area } = useDrawingStats()
  const draftCriteria = usePlanningMonitorStore((s) => s.draftCriteria)
  const backToDraw = usePlanningMonitorStore((s) => s.backToDraw)
  const endDrawing = usePlanningMonitorStore((s) => s.endDrawing)
  const openFilters = usePlanningMonitorStore((s) => s.openFilters)
  const { refData, createPatch, userEmail } = usePlanningMode()
  const suggested = useDraftAuthority(location, draftCriteria)
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chips = useMemo(() => (draftCriteria ? filterChips(draftCriteria, refData.brands) : []), [draftCriteria, refData.brands])
  const value = name ?? suggested ?? ''
  if (!draftCriteria) return null

  const save = async () => {
    const parsed = parseCriteria(draftCriteria)
    if (!parsed.ok) return setError(parsed.error)
    if (!location) return setError('The shape is not valid. Redraw it and try again.')
    setSaving(true)
    setError(null)
    try {
      await createPatch({ name: (value.trim() || 'My patch').slice(0, 80), criteria: parsed.criteria, location, emailEnabled: email })
      endDrawing()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The patch could not be saved')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <form
        className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-6 pt-5"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Eyebrow tone="violet">New patch · Step 3 of 3</Eyebrow>
        <h2 className="mt-2 text-[21px] font-bold leading-tight tracking-[-0.02em] text-sm-ink">Name it and set what counts</h2>

        <label className="mt-4 block">
          <GroupLabel>Patch name</GroupLabel>
          <input
            autoFocus
            value={value}
            maxLength={80}
            placeholder={suggested ?? 'e.g. West Yorkshire'}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-[11px] border-2 border-sm-violet px-[14px] py-3 text-[15px] font-semibold text-sm-ink shadow-[0_0_0_4px_rgba(112,51,255,.12)] outline-none"
          />
          <span className="mt-1.5 block text-[12px] text-[#57534E]">Shown on the map, in the summary and in the email subject.</span>
        </label>

        <div className="mt-4 flex items-center gap-4 rounded-[12px] border border-[#EDEBE7] px-3.5 py-3">
          <div>
            <GroupLabel>Area</GroupLabel>
            <p className="mt-0.5 text-[17px] font-bold text-sm-ink">{areaLabel(area)}</p>
          </div>
          <div className="border-l border-[#EDEBE7] pl-4">
            <GroupLabel>Matches now</GroupLabel>
            <p className="mt-0.5 text-[17px] font-bold text-sm-ink">
              {count.loading ? <Spinner className="text-[#8A857D]" /> : count.result?.totals ? count.result.totals.developments.toLocaleString('en-GB') : '—'}
            </p>
          </div>
          <button type="button" onClick={backToDraw} className="ml-auto text-[13px] font-bold text-sm-violet hover:text-sm-violet-deep">Redraw</button>
        </div>

        <div className="mt-5">
          <GroupLabel action={<button type="button" onClick={() => openFilters('draft')} className="text-[13px] font-bold text-sm-violet hover:text-sm-violet-deep">Edit</button>}>
            Filters for this patch
          </GroupLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((chip) => <FilterChipView key={chip.key} chip={chip} />)}
          </div>
          <p className="mt-2 text-[12px] leading-[1.45] text-[#57534E]">Carried over from the view you were in. These stay with the patch and drive the weekly summary.</p>
        </div>

        <div className="mt-5 rounded-[13px] border-[1.5px] border-[#E3DEFA] bg-[#F7F4FF] p-3.5">
          <div className="flex gap-3">
            <Toggle checked={email} onChange={setEmail} label="Email me the weekly summary" />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-sm-ink">Email me the weekly summary</p>
              <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[#57534E]">Monday mornings, covering the previous 7 days. Opt out any time from the patch menu.</p>
              {userEmail && (
                <p className="mt-2 flex items-baseline gap-2 text-[12.5px]">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">To</span>
                  <span className="truncate font-semibold text-sm-ink">{userEmail}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        {vertices.length > 0 && !location && <p role="alert" className="mt-3 text-[12.5px] text-[#C0453F]">The shape is not valid. Redraw it.</p>}
        {error && <p role="alert" className="mt-3 text-[12.5px] text-[#C0453F]">{error}</p>}
      </form>
      <footer className="flex gap-2.5 border-t border-[#EDEBE7] px-[22px] py-4">
        <OutlineButton className="flex-1" onClick={endDrawing} disabled={saving}>Discard</OutlineButton>
        <PrimaryButton className="flex-[1.6]" onClick={save} disabled={saving || !location}>
          {saving && <Spinner />} Save patch
        </PrimaryButton>
      </footer>
    </div>
  )
}
