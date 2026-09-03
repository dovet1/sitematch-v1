'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Loader2, ChevronDown, ChevronUp, AlertTriangle, Sparkles, PenLine, MousePointer2, ImagePlus, X } from 'lucide-react'
import { UCadLibrary } from './UCadLibrary'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { calculatePolygonArea } from '@/lib/sitesketcher-v2/polygon-utils'
import { resolveGuidedExclusions } from '@/lib/sitesketcher-v2/auto-parking/detection'
import { buildAutoParkingLayout, buildSolverInput } from '@/lib/sitesketcher-v2/auto-parking/adapter'
import { reprojectAccessAnchor } from '@/lib/sitesketcher-v2/auto-parking/access-point'
import { resolveEntrance } from '@/lib/sitesketcher-v2/auto-parking/entrance-point'
import type { AutoParkingEntrance, Polygon } from '@/types/sitesketcher-v2'
import type { CandidateLayout, SolverInput } from '@/lib/parking-layout-lab/types'
import { representativeAngle, useAutoParkingWorker } from '../../lib/hooks/useAutoParkingWorker'
import { Kicker, formatArea, WARNING_CARD_CLASS } from './USketchPanel'

/** Direction from the boundary centroid to an edge's midpoint, as an 8-point compass label — e.g. "South edge". */
function edgeCompassLabel(ring: Polygon['points'], edgeIndex: number): string {
  const open =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring
  if (open.length < 2) return 'Edge'
  const centroid = open.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]).map((v) => v / open.length)
  const a = open[edgeIndex]
  const b = open[(edgeIndex + 1) % open.length]
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const dx = mid[0] - centroid[0]
  const dy = mid[1] - centroid[1]
  const angle = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360 // 0 = north, clockwise
  const dirs = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest']
  return dirs[Math.round(angle / 45) % 8]
}

/** Highest-yield candidate — the real "BEST YIELD" tag is derived from actual solver output, never hardcoded. */
function bestYieldCandidateId(candidates: CandidateLayout[]): string | null {
  if (candidates.length < 2) return null
  return candidates.reduce((best, c) => (c.stallCount > best.stallCount ? c : best), candidates[0]).candidateId
}

/** Ignore worker-only scheduling fields when checking whether the visible result matches the current controls. */
function solverInputKey(input: SolverInput): string {
  const { draft: _draft, draftOrientationDeg: _draftOrientationDeg, ...layoutInput } = input
  return JSON.stringify(layoutInput)
}

/**
 * Guided Auto parking flow — the Parking panel's Auto-layout body. Kept in
 * its own module (rather than inline in USketchPanel.tsx) since the guided
 * state machine has real size: draw boundary → place access → ready →
 * generating → compare/live-edit → apply. See
 * docs/design_handoff_auto_parking_guided/README.md for the six reference states.
 */
export function USketchAutoParkingPanel() {
  const polygons = useSketchStore((s) => s.polygons)
  const cadInstances = useSketchStore((s) => s.cadInstances)
  const cadImages = useSketchStore((s) => s.cadImages)
  const savedCads = useSketchStore((s) => s.savedCads)
  const draft = useSketchStore((s) => s.autoParkingDraft)
  const autoLayouts = useSketchStore((s) => s.autoLayouts)
  const generationStatus = useSketchStore((s) => s.autoParkingGenerationStatus)
  const generationError = useSketchStore((s) => s.autoParkingGenerationError)
  const candidates = useSketchStore((s) => s.autoParkingCandidates)
  const selectedCandidateId = useSketchStore((s) => s.autoParkingSelectedCandidateId)
  const solverRun = useSketchStore((s) => s.autoParkingSolverRun)

  const updateAutoParkingSettings = useSketchStore((s) => s.updateAutoParkingSettings)
  const setAutoParkingSettingsExpanded = useSketchStore((s) => s.setAutoParkingSettingsExpanded)
  const setAutoParkingSelectedCandidateId = useSketchStore((s) => s.setAutoParkingSelectedCandidateId)
  const startAutoParkingBoundaryEdit = useSketchStore((s) => s.startAutoParkingBoundaryEdit)
  const commitAutoParkingBoundaryEdit = useSketchStore((s) => s.commitAutoParkingBoundaryEdit)
  const setAutoParkingBuildingMode = useSketchStore((s) => s.setAutoParkingBuildingMode)
  const toggleAutoParkingBuilding = useSketchStore((s) => s.toggleAutoParkingBuilding)
  const continueAutoParkingBuildings = useSketchStore((s) => s.continueAutoParkingBuildings)
  const startAutoParkingBuildingsEdit = useSketchStore((s) => s.startAutoParkingBuildingsEdit)
  const startAutoParkingEntranceEdit = useSketchStore((s) => s.startAutoParkingEntranceEdit)
  const startAutoParkingAccessEdit = useSketchStore((s) => s.startAutoParkingAccessEdit)
  const consumeAutoParkingPendingGenerate = useSketchStore((s) => s.consumeAutoParkingPendingGenerate)
  const applyAutoParkingLayout = useSketchStore((s) => s.applyAutoParkingLayout)
  const setParkingMethod = useSketchStore((s) => s.setParkingMethod)

  const { generate, generateDraft, regenerateLive, cancel } = useAutoParkingWorker()

  const boundaryPolygon = polygons.find((p) => p.id === draft.boundaryId) ?? null

  const resolvedExclusions = useMemo(() => {
    if (!boundaryPolygon) return { exclusions: [], missingRefs: [] }
    return resolveGuidedExclusions({
      boundaryId: boundaryPolygon.id,
      boundaryRing: boundaryPolygon.points,
      buildingRefs: draft.buildingRefs,
      polygons,
      cadInstances,
      cadImages,
      savedCads,
    })
  }, [boundaryPolygon, draft.buildingRefs, polygons, cadInstances, cadImages, savedCads])
  const exclusions = resolvedExclusions.exclusions

  const accessPoint = useMemo(() => {
    if (!boundaryPolygon || !draft.accessAnchor) return null
    return reprojectAccessAnchor(draft.accessAnchor, boundaryPolygon.points)
  }, [boundaryPolygon, draft.accessAnchor])

  const entrancePoint = useMemo(() => resolveEntrance(draft.entrance, polygons), [draft.entrance, polygons])

  const currentSolverInput = useMemo(() => {
    if (!boundaryPolygon || !accessPoint || !entrancePoint || resolvedExclusions.missingRefs.length > 0) return null
    return buildSolverInput({
      boundaryRing: boundaryPolygon.points,
      exclusions,
      accessPoint,
      entrancePoint,
      settings: draft.settings,
    })
  }, [boundaryPolygon, exclusions, accessPoint, entrancePoint, resolvedExclusions.missingRefs.length, draft.settings])

  const handleGenerate = () => {
    if (!currentSolverInput) return
    generate(currentSolverInput)
  }

  const currentSolverInputKey = currentSolverInput ? solverInputKey(currentSolverInput) : null
  const resultMatchesCurrentInput =
    !!currentSolverInputKey && !!solverRun && solverInputKey(solverRun.input) === currentSolverInputKey

  // In compare/edit mode the controls are live: render a cheap preview
  // immediately, then commit candidate cards/metrics with a debounced full
  // solve after the slider pauses. The worker's latest-only queue coalesces
  // rapid changes so intermediate values cannot overwrite the final result.
  const settingsKey = JSON.stringify(draft.settings)
  const previousSettingsKeyRef = useRef(settingsKey)
  useEffect(() => {
    const settingsChanged = previousSettingsKeyRef.current !== settingsKey
    previousSettingsKeyRef.current = settingsKey
    if (!settingsChanged || !currentSolverInput) return
    if (draft.phase !== 'compare' && draft.phase !== 'editing') return

    const selectedCandidate =
      candidates.find((candidate) => candidate.candidateId === selectedCandidateId) ?? null
    generateDraft(
      currentSolverInput,
      selectedCandidate ? representativeAngle(selectedCandidate.orientationSummary) : undefined
    )

    const timer = setTimeout(() => regenerateLive(currentSolverInput), 300)
    return () => clearTimeout(timer)
  }, [
    settingsKey,
    currentSolverInput,
    draft.phase,
    candidates,
    selectedCandidateId,
    generateDraft,
    regenerateLive,
  ])

  const buildingRefsKey = JSON.stringify(draft.buildingRefs)
  const previousBuildingRefsKeyRef = useRef(buildingRefsKey)
  useEffect(() => {
    const buildingsChanged = previousBuildingRefsKeyRef.current !== buildingRefsKey
    previousBuildingRefsKeyRef.current = buildingRefsKey
    if (!buildingsChanged || !currentSolverInput) return
    if (draft.phaseBeforeEdit !== 'compare' && draft.phaseBeforeEdit !== 'editing') return
    const selectedCandidate = candidates.find((candidate) => candidate.candidateId === selectedCandidateId) ?? null
    generateDraft(
      currentSolverInput,
      selectedCandidate ? representativeAngle(selectedCandidate.orientationSummary) : undefined,
    )
    const timer = setTimeout(() => regenerateLive(currentSolverInput), 300)
    return () => clearTimeout(timer)
  }, [
    buildingRefsKey,
    currentSolverInput,
    draft.phaseBeforeEdit,
    candidates,
    selectedCandidateId,
    generateDraft,
    regenerateLive,
  ])

  // "Edit layout settings" / "Regenerate" from the applied-layout inspector
  // reopen the comparison flow with a working copy and auto-generate once.
  const handleGenerateRef = useRef(handleGenerate)
  handleGenerateRef.current = handleGenerate
  useEffect(() => {
    if (draft.phase !== 'ready' || !boundaryPolygon || !accessPoint || !entrancePoint) return
    if (consumeAutoParkingPendingGenerate()) handleGenerateRef.current()
  }, [draft.phase, boundaryPolygon, accessPoint, entrancePoint, consumeAutoParkingPendingGenerate])

  // The settings drawer opens expanded by default once comparison starts
  // (state 04) even though it starts collapsed pre-generation (state 03).
  const prevPhaseRef = useRef(draft.phase)
  useEffect(() => {
    if (prevPhaseRef.current !== 'compare' && draft.phase === 'compare') {
      setAutoParkingSettingsExpanded(true)
    }
    prevPhaseRef.current = draft.phase
  }, [draft.phase, setAutoParkingSettingsExpanded])

  const handleUseLayout = () => {
    if (!boundaryPolygon || !entrancePoint || !draft.entrance || !solverRun || !selectedCandidateId || !resultMatchesCurrentInput) return
    const candidate = candidates.find((c) => c.candidateId === selectedCandidateId)
    if (!candidate) return
    const editingLayout = draft.editingLayoutId ? autoLayouts.find((l) => l.id === draft.editingLayoutId) : undefined
    const layout = buildAutoParkingLayout({
      id: editingLayout?.id ?? `auto-layout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: editingLayout?.name ?? `Auto layout ${autoLayouts.length + 1}`,
      boundaryId: boundaryPolygon.id,
      exclusions,
      entrance: draft.entrance,
      entrancePoint,
      settingsSnapshot: draft.settings,
      solverInput: solverRun.input,
      solverOutput: solverRun.output,
      candidate,
    })
    applyAutoParkingLayout(layout)
  }

  const bestYieldId = bestYieldCandidateId(candidates)

  // --- Generating -----------------------------------------------------------
  if (draft.phase === 'generating' || generationStatus === 'running') {
    return (
      <>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-sm-border bg-sm-bg px-4 py-8 text-center">
          <Loader2 size={20} className="animate-spin text-sm-violet" />
          <p className="text-[12.5px] text-sm-ink3">
            Creating layouts… usually under 10 seconds. You can keep panning the map.
          </p>
        </div>
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg border border-sm-border bg-sm-surface px-3 py-2 text-[12.5px] font-medium text-sm-ink transition-colors hover:bg-sm-bg"
        >
          Cancel
        </button>
      </>
    )
  }

  // --- Compare / editing ------------------------------------------------------
  if (draft.phase === 'compare' || draft.phase === 'editing') {
    return (
      <>
        <GuidedStepCard
          variant="done"
          title="Site boundary"
          meta={boundaryPolygon ? `${boundaryPolygon.name} · ${formatArea(calculatePolygonArea(boundaryPolygon.points))}` : undefined}
          onChange={startAutoParkingBoundaryEdit}
          compact
        />
        <GuidedStepCard
          variant="done"
          title="Buildings"
          meta={`${draft.buildingRefs.length} selected${exclusions.filter((e) => e.source === 'mandatory').length ? ` · ${exclusions.filter((e) => e.source === 'mandatory').length} CAD automatic` : ''}`}
          onChange={startAutoParkingBuildingsEdit}
          compact
        />
        <GuidedStepCard
          variant="done"
          title="Building entrance"
          meta={entranceMeta(draft.entrance, polygons)}
          onChange={startAutoParkingEntranceEdit}
          compact
        />
        <GuidedStepCard
          variant="done"
          title="Vehicle access"
          meta={
            draft.accessAnchor && boundaryPolygon
              ? `${edgeCompassLabel(boundaryPolygon.points, draft.accessAnchor.edgeIndex)} edge · ${Math.round(draft.accessAnchor.distanceAlongEdgeM)} m`
              : undefined
          }
          onChange={startAutoParkingAccessEdit}
          compact
        />

        {generationStatus === 'failed' && generationError && <div className={WARNING_CARD_CLASS}>{generationError}</div>}

        <div className="flex items-center justify-between pt-1">
          <Kicker>Layouts · {candidates.length}</Kicker>
          <button
            type="button"
            onClick={handleGenerate}
            className="text-[12.5px] font-semibold text-sm-violet hover:text-sm-violet-deep"
          >
            Regenerate
          </button>
        </div>

        {candidates.length === 0 ? (
          <div className={WARNING_CARD_CLASS}>
            No layout fits these settings. Try a smaller setback/clearance or a wider aisle.
            {solverRun?.output.warnings.map((w) => (
              <div key={w.code} className="mt-1">{w.message}</div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.slice(0, 3).map((c, i) => {
              const accessible = c.rows.flatMap((r) => r.stalls).filter((s) => s.accessible).length
              const selected = c.candidateId === selectedCandidateId
              return (
                <button
                  key={c.candidateId}
                  type="button"
                  onClick={() => setAutoParkingSelectedCandidateId(c.candidateId)}
                  className={
                    'flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ' +
                    (selected ? 'border-sm-violet bg-sm-violet-tint-soft' : 'border-sm-border hover:bg-sm-bg')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-sm-ink">
                      Option {i + 1}
                      {c.candidateId === bestYieldId && (
                        <span className="rounded-full bg-sm-violet-tint px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-sm-violet-deep">
                          Best yield
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[13px] font-semibold text-sm-ink">
                      {c.stallCount} <span className="text-[10.5px] font-normal text-sm-ink3">sp</span>
                    </span>
                  </div>
                  <div className="font-mono text-[10.5px] text-sm-ink3">
                    {c.rows.length} rows · {Math.round(c.parkingFootprintSqm)} m²{accessible > 0 ? ` · ${accessible} accessible` : ''}
                  </div>
                  {c.warnings.length > 0 && (
                    <div className={WARNING_CARD_CLASS + ' mt-1 flex items-start gap-1.5'}>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>{c.warnings.map((w) => w.message).join(' ')}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <LayoutSettingsDrawer expanded={draft.settingsExpanded} onToggle={() => setAutoParkingSettingsExpanded(!draft.settingsExpanded)}>
          <SettingsControls settings={draft.settings} onChange={updateAutoParkingSettings} />
        </LayoutSettingsDrawer>

        <div className="flex items-center gap-1.5 rounded-lg bg-sm-bg px-2.5 py-2 text-[11.5px] text-sm-ink3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3FB27A]" />
          Drag boundary, access, a building or the entrance — bays re-fit live
        </div>

        <button
          type="button"
          onClick={handleUseLayout}
          disabled={!selectedCandidateId || !resultMatchesCurrentInput}
          className="rounded-lg bg-sm-violet px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:opacity-40 disabled:hover:bg-sm-violet"
        >
          {resultMatchesCurrentInput ? 'Use this layout' : 'Updating layout…'}
        </button>
        <p className="text-center text-[11px] leading-relaxed text-sm-ink3">
          Concept layout only. Review compliance, tracking, gradients and drainage separately.
        </p>
      </>
    )
  }

  // --- Boundary editing ("Change") -------------------------------------------
  if (draft.phase === 'boundary-edit') {
    return (
      <GuidedStepCard
        variant="editing"
        title="Editing boundary"
        description="Drag the vertices on the map to reshape it."
        onDone={commitAutoParkingBoundaryEdit}
      />
    )
  }

  if (draft.phase === 'entrance-edit') {
    return (
      <GuidedStepCard
        variant="editing"
        title="Editing building entrance"
        description={draft.buildingRefs.length > 0 ? 'Click another wall, or drag the marker along its building.' : 'Click or drag the visitor target point inside the site.'}
      />
    )
  }

  // --- Access editing ("Change") ----------------------------------------------
  if (draft.phase === 'access-edit') {
    return (
      <GuidedStepCard
        variant="editing"
        title="Editing vehicle access"
        description="Click a different edge, or drag the marker along the boundary."
      />
    )
  }

  // --- Drawing the boundary (guided step 1) -----------------------------------
  if (draft.phase === 'boundary') {
    return (
      <>
        <StepList activePhase="boundary" boundaryPolygon={null} accessAnchor={null} />
        <Footer disabled helper="Draw a site boundary to continue" />
      </>
    )
  }

  // --- Optional building capture (guided step 2) -----------------------------
  if (draft.phase === 'buildings') {
    const mandatoryCad = exclusions.filter((exclusion) => exclusion.source === 'mandatory')
    return (
      <>
        <div className="flex flex-col gap-2">
          <GuidedStepCard
            variant="done"
            title="Site boundary"
            meta={boundaryPolygon ? `${boundaryPolygon.name} · ${formatArea(calculatePolygonArea(boundaryPolygon.points))}` : undefined}
            onChange={startAutoParkingBoundaryEdit}
          />
          <div className="rounded-xl border border-[#DFD1FB] bg-[#F8F5FF]">
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sm-violet text-[11px] font-bold text-white">2</span>
                <span className="text-[13.5px] font-semibold text-sm-ink">Buildings</span>
                <span className="rounded bg-sm-border-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-sm-ink3">Optional</span>
                <span className="ml-auto font-mono text-[11px] font-semibold text-sm-violet">{draft.buildingRefs.length + mandatoryCad.length}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-sm-ink2">Layouts route around anything here. Skip if the plot is clear.</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setAutoParkingBuildingMode('draw')} className={buildingModeButton(draft.buildingMode === 'draw')}>
                  <PenLine size={13} /> Draw
                </button>
                <button type="button" onClick={() => setAutoParkingBuildingMode('select')} className={buildingModeButton(draft.buildingMode === 'select')}>
                  <MousePointer2 size={13} /> Select
                </button>
                <button type="button" onClick={() => setAutoParkingBuildingMode('cad')} className={buildingModeButton(draft.buildingMode === 'cad')}>
                  <ImagePlus size={13} /> Add CAD
                </button>
              </div>
              {draft.buildingMode === 'cad' && (
                <div className="mt-2 overflow-hidden rounded-lg border border-[#DFD1FB] bg-white">
                  <UCadLibrary />
                </div>
              )}
            </div>
            {(draft.buildingRefs.length > 0 || mandatoryCad.length > 0 || resolvedExclusions.missingRefs.length > 0) && (
              <div className="flex flex-col gap-1.5 border-t border-[#DFD1FB] px-3 py-2.5">
                {draft.buildingRefs.map((ref) => {
                  const polygon = polygons.find((candidate) => candidate.id === ref.id)
                  return (
                    <div key={ref.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5">
                      <span className="h-3.5 w-3.5 rounded-[3px] bg-[#3B3742]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium text-sm-ink">{polygon?.name ?? 'Missing building'}</div>
                        <div className={'text-[10.5px] ' + (polygon ? 'text-sm-ink3' : 'text-[#8A6318]')}>
                          {polygon ? `${ref.source} · ${formatArea(calculatePolygonArea(polygon.points))}` : 'No longer exists · remove or replace to continue'}
                        </div>
                      </div>
                      <button type="button" aria-label={`Unmark ${polygon?.name ?? 'missing building'}`} onClick={() => toggleAutoParkingBuilding(ref.id, ref.source)} className="text-sm-ink3 hover:text-sm-ink">
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
                {mandatoryCad.map((exclusion) => (
                  <div key={`${exclusion.kind}:${exclusion.id}`} className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5">
                    <span className="h-3.5 w-3.5 rounded-[3px] border border-dashed border-sm-ink3 bg-[#3B3742]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-sm-ink">CAD building</div>
                      <div className="text-[10.5px] text-sm-ink3">automatically avoided</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <GuidedStepCard variant="dimmed" number={3} title="Set the building entrance" />
          <GuidedStepCard variant="dimmed" number={4} title="Set a vehicle access point" />
          <GuidedStepCard variant="dimmed" number={5} title="Create layouts" />
        </div>
        <button
          type="button"
          onClick={continueAutoParkingBuildings}
          disabled={resolvedExclusions.missingRefs.length > 0}
          className="mt-auto rounded-lg bg-sm-violet px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-sm-violet-deep disabled:opacity-40"
        >
          Continue
        </button>
        <p className="text-center text-[11px] text-sm-ink3">
          {resolvedExclusions.missingRefs.length > 0 ? 'Remove or replace missing buildings to continue' : `${draft.buildingRefs.length + mandatoryCad.length} buildings added · next, set the building entrance`}
        </p>
      </>
    )
  }

  // --- Building entrance (guided step 3) --------------------------------------
  if (draft.phase === 'entrance') {
    return (
      <>
        <StepList
          activePhase="entrance"
          boundaryPolygon={boundaryPolygon}
          buildingCount={draft.buildingRefs.length + exclusions.filter((e) => e.source === 'mandatory').length}
          entrance={null}
          accessAnchor={draft.accessAnchor}
          polygons={polygons}
          onChangeBoundary={startAutoParkingBoundaryEdit}
          onChangeBuildings={startAutoParkingBuildingsEdit}
        />
        {draft.editingLayoutId && !draft.entrance && (
          <div className={WARNING_CARD_CLASS}>Set a building entrance to regenerate this existing layout.</div>
        )}
        <Footer disabled helper="Set the entrance to continue" />
      </>
    )
  }

  // --- Placing the access point (guided step 2) --------------------------------
  if (draft.phase === 'access') {
    return (
      <>
        <StepList
          activePhase="access"
          boundaryPolygon={boundaryPolygon}
          buildingCount={draft.buildingRefs.length + exclusions.filter((e) => e.source === 'mandatory').length}
          entrance={draft.entrance}
          accessAnchor={null}
          polygons={polygons}
          onChangeBoundary={startAutoParkingBoundaryEdit}
          onChangeBuildings={startAutoParkingBuildingsEdit}
          onChangeEntrance={startAutoParkingEntranceEdit}
        />
        <Footer disabled helper="Set an access point to continue" />
      </>
    )
  }

  // --- Ready to generate (guided step 3, state 03) ------------------------------
  return (
    <>
      <StepList
        activePhase="ready"
        boundaryPolygon={boundaryPolygon}
        buildingCount={draft.buildingRefs.length + exclusions.filter((e) => e.source === 'mandatory').length}
        entrance={draft.entrance}
        accessAnchor={draft.accessAnchor}
        polygons={polygons}
        onChangeBoundary={startAutoParkingBoundaryEdit}
        onChangeBuildings={startAutoParkingBuildingsEdit}
        onChangeEntrance={startAutoParkingEntranceEdit}
        onChangeAccess={startAutoParkingAccessEdit}
      />

      <LayoutSettingsDrawer expanded={draft.settingsExpanded} onToggle={() => setAutoParkingSettingsExpanded(!draft.settingsExpanded)}>
        <SettingsControls settings={draft.settings} onChange={updateAutoParkingSettings} />
      </LayoutSettingsDrawer>
      {!draft.settingsExpanded && (
        <p className="text-[11.5px] leading-relaxed text-sm-ink3">
          Defaults: {draft.settings.stallSize === 'standard' ? '2.4' : '2.7'} × {draft.settings.stallSize === 'standard' ? '4.8' : '5.0'} m
          bays, {draft.settings.aisleWidth.toFixed(1)} m aisles, {draft.settings.boundarySetback.toFixed(1)} m setback. Open to change
          before or after generating.
        </p>
      )}

      {generationStatus === 'failed' && generationError && <div className={WARNING_CARD_CLASS}>{generationError}</div>}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!accessPoint || !entrancePoint || resolvedExclusions.missingRefs.length > 0}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-sm-violet px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(112,51,255,0.24)] transition-colors hover:bg-sm-violet-deep disabled:opacity-40 disabled:shadow-none disabled:hover:bg-sm-violet"
      >
        <Sparkles size={14} /> Create layouts
      </button>
      <p className="text-center text-[11px] text-sm-ink3">Generates up to 3 concept options · usually under 10 s</p>
    </>
  )
}

/* ---------- Guided step list (states 01–03) ---------- */

function StepList({
  activePhase,
  boundaryPolygon,
  buildingCount = 0,
  entrance = null,
  accessAnchor,
  polygons = [],
  onChangeBoundary,
  onChangeBuildings,
  onChangeEntrance,
  onChangeAccess,
}: {
  activePhase: 'boundary' | 'entrance' | 'access' | 'ready'
  boundaryPolygon: Polygon | null
  buildingCount?: number
  entrance?: AutoParkingEntrance | null
  accessAnchor: { edgeIndex: number; distanceAlongEdgeM: number } | null
  polygons?: Polygon[]
  onChangeBoundary?: () => void
  onChangeBuildings?: () => void
  onChangeEntrance?: () => void
  onChangeAccess?: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {activePhase === 'boundary' ? (
        <GuidedStepCard
          variant="active"
          number={1}
          title="Draw the site boundary"
          description="Click points on the map to trace the plot; double-click to close it."
        />
      ) : (
        <GuidedStepCard
          variant="done"
          title="Site boundary"
          meta={boundaryPolygon ? `${boundaryPolygon.name} · ${formatArea(calculatePolygonArea(boundaryPolygon.points))}` : undefined}
          onChange={onChangeBoundary}
        />
      )}

      {activePhase === 'boundary' ? (
        <GuidedStepCard variant="dimmed" number={2} title="Buildings" />
      ) : (
        <GuidedStepCard variant="done" title="Buildings" meta={`${buildingCount} added`} onChange={onChangeBuildings} />
      )}

      {activePhase === 'entrance' ? (
        <GuidedStepCard
          variant="active"
          number={3}
          title="Set the building entrance"
          description={buildingCount > 0
            ? 'Click a building wall to drop the primary entrance. Accessible bays are placed nearest to it — drag to slide it along the wall.'
            : 'No buildings? Drop a target point where visitors arrive instead.'}
        />
      ) : activePhase === 'access' || activePhase === 'ready' ? (
        <GuidedStepCard variant="done" title="Building entrance" meta={entranceMeta(entrance, polygons)} onChange={onChangeEntrance} />
      ) : (
        <GuidedStepCard variant="dimmed" number={3} title="Set the building entrance" />
      )}

      {activePhase === 'access' ? (
        <GuidedStepCard
          variant="active"
          number={4}
          title="Set a vehicle access point"
          description="Hover the boundary — the nearest edge thickens. Click to drop the entry; drag to slide it along the edge."
        />
      ) : activePhase === 'ready' ? (
        <GuidedStepCard
          variant="done"
          title="Vehicle access"
          meta={
            accessAnchor && boundaryPolygon
              ? `${edgeCompassLabel(boundaryPolygon.points, accessAnchor.edgeIndex)} edge · ${Math.round(accessAnchor.distanceAlongEdgeM)} m`
              : undefined
          }
          onChange={onChangeAccess}
        />
      ) : (
        <GuidedStepCard variant="dimmed" number={4} title="Set a vehicle access point" />
      )}

      {activePhase !== 'ready' && <GuidedStepCard variant="dimmed" number={5} title="Create layouts" />}
    </div>
  )
}

function entranceMeta(entrance: AutoParkingEntrance | null | undefined, polygons: Polygon[]): string | undefined {
  if (!entrance) return undefined
  if (entrance.kind === 'target') return 'Visitor target point'
  const building = polygons.find((polygon) => polygon.id === entrance.buildingId)
  return building ? `${building.name} wall` : 'Missing building'
}

function buildingModeButton(active: boolean): string {
  return 'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11.5px] font-semibold transition-colors ' +
    (active
      ? 'border-sm-violet bg-sm-violet text-white'
      : 'border-[#DFD1FB] bg-white text-sm-violet hover:bg-sm-violet-tint-soft')
}

function GuidedStepCard({
  variant,
  number,
  title,
  description,
  meta,
  onChange,
  onDone,
  compact,
}: {
  variant: 'active' | 'done' | 'dimmed' | 'editing'
  number?: number
  title: string
  description?: string
  meta?: string
  onChange?: () => void
  onDone?: () => void
  compact?: boolean
}) {
  if (variant === 'done') {
    return (
      <div className={'flex items-center gap-2.5 rounded-xl border border-sm-border bg-sm-bg px-3 ' + (compact ? 'py-2' : 'py-2.5')}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sm-violet-tint text-sm-violet-deep">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5L4.75 8.75L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-sm-ink">{title}</div>
          {meta && <div className="text-[11.5px] text-sm-ink3">{meta}</div>}
        </div>
        {onChange && (
          <button type="button" onClick={onChange} className="shrink-0 text-[12.5px] font-semibold text-sm-violet hover:text-sm-violet-deep">
            Change
          </button>
        )}
      </div>
    )
  }

  if (variant === 'editing') {
    return (
      <div className="rounded-xl border border-sm-violet bg-sm-violet-tint-soft px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13.5px] font-semibold text-sm-ink">{title}</span>
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="shrink-0 rounded-md bg-sm-violet px-2.5 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-sm-violet-deep"
            >
              Done
            </button>
          )}
        </div>
        {description && <div className="mt-1 text-[12px] leading-relaxed text-sm-ink2">{description}</div>}
      </div>
    )
  }

  const active = variant === 'active'
  return (
    <div
      className={
        'rounded-xl border px-3 py-2.5 transition-colors ' +
        (active ? 'border-[#DFD1FB] bg-[#F8F5FF]' : 'border-sm-border bg-sm-surface opacity-55')
      }
    >
      <div className="flex items-start gap-2.5">
        <span
          className={
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' +
            (active ? 'bg-sm-violet text-white' : 'bg-sm-border text-sm-ink3')
          }
        >
          {number}
        </span>
        <div className="min-w-0">
          <div className={'text-[13.5px] font-semibold ' + (active ? 'text-sm-ink' : 'text-sm-ink3')}>{title}</div>
          {active && description && <div className="mt-0.5 text-[12px] leading-relaxed text-sm-ink2">{description}</div>}
        </div>
      </div>
    </div>
  )
}

function Footer({ disabled, helper }: { disabled?: boolean; helper: string }) {
  return (
    <div className="mt-auto flex flex-col gap-1.5 pt-2">
      <button
        type="button"
        disabled={disabled}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-[#E7E2DA] px-3 py-2.5 text-[13px] font-semibold text-[#A8A29A]"
      >
        <Sparkles size={14} /> Create layouts
      </button>
      <p className="text-center text-[11px] text-sm-ink3">{helper}</p>
    </div>
  )
}

/* ---------- Layout settings drawer ---------- */

function LayoutSettingsDrawer({
  expanded,
  onToggle,
  children,
}: {
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-sm-border bg-sm-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-[13px] font-medium text-sm-ink"
      >
        Layout settings
        {expanded ? <ChevronUp size={15} className="text-sm-ink3" /> : <ChevronDown size={15} className="text-sm-ink3" />}
      </button>
      {expanded && <div className="flex flex-col gap-3 border-t border-sm-border-soft px-3 pb-3 pt-3">{children}</div>}
    </div>
  )
}

function SettingsControls({
  settings,
  onChange,
}: {
  settings: ReturnType<typeof useSketchStore.getState>['autoParkingDraft']['settings']
  onChange: (updates: Partial<typeof settings>) => void
}) {
  return (
    <>
      <Slider
        label="Bay width"
        value={settings.stallSize === 'standard' ? 2.4 : 2.7}
        min={2.4}
        max={2.7}
        step={0.3}
        unit="m"
        onChange={(v) => onChange({ stallSize: v >= 2.55 ? 'larger' : 'standard' })}
      />
      <Slider
        label="Aisle"
        value={settings.aisleWidth}
        min={4}
        max={9}
        step={0.5}
        unit="m"
        onChange={(v) => onChange({ aisleWidth: v })}
      />
      <Slider
        label="Setback"
        value={settings.boundarySetback}
        min={0}
        max={8}
        step={0.5}
        unit="m"
        onChange={(v) => onChange({ boundarySetback: v })}
      />
      <Slider
        label="Reserve accessible bays"
        value={settings.accessibleBays.percent}
        min={0}
        max={20}
        step={1}
        unit="%"
        onChange={(v) => onChange({ accessibleBays: { on: v > 0, percent: v } })}
      />
    </>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-sm-ink2">{label}</span>
        <span className="font-mono text-[12.5px] font-semibold text-sm-ink">
          {Number.isInteger(step) ? value : value.toFixed(1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-sm-border accent-sm-violet"
      />
    </div>
  )
}
