'use client'

import { useEffect, useMemo, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { Toaster } from 'sonner'
import { UChrome } from './shell/UChrome'
import { URail } from './shell/URail'
import { ULeftPanel } from './shell/ULeftPanel'
import { UInspector } from './shell/UInspector'
import { UnifiedMap } from './map/UnifiedMap'
import { UDirectory } from './shell/directory/UDirectory'
import { SketchLayer } from './map/SketchLayer'
import { useWorkspaceStore } from '../lib/stores/unified-workspace-store'
import { useReferenceData } from '../lib/hooks/useReferenceData'
import { useFindGaps } from '../lib/hooks/useFindGaps'
import { useAreaData } from '../lib/hooks/useAreaData'
import { useCatchment } from '../lib/hooks/useCatchment'
import { usePlanningData } from '../lib/hooks/usePlanningData'
import { useRequirements } from '../lib/hooks/useRequirements'
import { useFindGapsStorePins } from '../lib/hooks/useFindGapsStorePins'
import { computeIsochroneMissing } from '../lib/isochrone-missing'
import { buildBrandLandscape } from '../lib/brand-landscape'
import { selectPresentStoreSource } from '../lib/present-store-source'
import { filterGapStorePins } from '../lib/store-pin-filter'
import {
  URequirementModal,
  UBrandModal,
  UBrandInfoModal,
  UPlanningModal,
} from './shell/UDetailModals'
import { UPointCompare, UPointCompareTray } from './shell/UPointCompare'
import { usePointComparison } from '../lib/hooks/usePointComparison'
import type { WorkspaceArea } from '../types/unified-workspace'
// New SiteMatcher-styled sketch shell (all depend only on the standalone sketch store).
import { USketchPanel } from './shell/USketchPanel'
import { USketchLauncher } from './shell/USketchLauncher'
import { USketchInspector } from './shell/USketchInspector'
import { FloatingMapControls } from '../../sitesketcher-v2/components/shell/FloatingMapControls'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'
import { TIER_FEATURES } from '@/lib/sitesketcher-v2/constants'

// Radius used when reading the landscape around a selected built-up area
// (the Assess dropped-point radius comes from the store instead).
const BUA_RADIUS_KM = 5

export function UnifiedWorkspace() {
  const view = useWorkspaceStore((s) => s.view)
  const area = useWorkspaceStore((s) => s.area)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const tab = useWorkspaceStore((s) => s.tab)
  const catchment = useWorkspaceStore((s) => s.catchment)
  const reqModal = useWorkspaceStore((s) => s.reqModal)
  const brandModal = useWorkspaceStore((s) => s.brandModal)
  const brandInfoId = useWorkspaceStore((s) => s.brandInfoId)
  const planningModal = useWorkspaceStore((s) => s.planningModal)
  const setReqModal = useWorkspaceStore((s) => s.setReqModal)
  const setBrandModal = useWorkspaceStore((s) => s.setBrandModal)
  const setBrandInfoId = useWorkspaceStore((s) => s.setBrandInfoId)
  const setPlanningModal = useWorkspaceStore((s) => s.setPlanningModal)
  const brandFilterCategoryIds = useWorkspaceStore((s) => s.brandFilterCategoryIds)
  const brandFilterBrandIds = useWorkspaceStore((s) => s.brandFilterBrandIds)
  const leftHidden = useWorkspaceStore((s) => s.leftHidden)
  const inspectorHidden = useWorkspaceStore((s) => s.inspectorHidden)
  const toggleLeft = useWorkspaceStore((s) => s.toggleLeft)
  const toggleInspector = useWorkspaceStore((s) => s.toggleInspector)
  const compareArm = useWorkspaceStore((s) => s.compareArm)
  const comparePair = useWorkspaceStore((s) => s.comparePair)
  const activeCompareArm = useWorkspaceStore((s) => s.activeCompareArm)
  const pointCompareOpen = useWorkspaceStore((s) => s.pointCompareOpen)
  const setPointCompareOpen = useWorkspaceStore((s) => s.setPointCompareOpen)
  const clearPointCompare = useWorkspaceStore((s) => s.clearPointCompare)

  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  // Sketch mode shows a launcher until a session is started/opened.
  const [sketchActive, setSketchActive] = useState(false)

  const { data: refData } = useReferenceData()
  const findGaps = useFindGaps(view === 'find')

  const isSketch = view === 'sketch'
  const isDirectory = view === 'directory'

  // Keep the sketch store's tier access in sync so CAD interaction is unlocked.
  const { hasProAccess, hasPlusAccess, loading: tierLoading } = useSubscriptionTier()
  useEffect(() => {
    if (tierLoading) return
    const tierLimits = hasPlusAccess
      ? TIER_FEATURES.plus
      : hasProAccess
        ? TIER_FEATURES.pro
        : TIER_FEATURES.free
    useSketchStore.getState().setEffectiveAccess({ hasProAccess, hasPlusAccess, tierLimits })
  }, [hasProAccess, hasPlusAccess, tierLoading])

  // Load the admin-maintained shared CAD library once Plus access is confirmed.
  useEffect(() => {
    if (!tierLoading && hasPlusAccess) {
      useSketchStore.getState().loadSharedCads()
    }
  }, [tierLoading, hasPlusAccess])

  // Reset to the launcher whenever we leave (and re-enter) Sketch mode.
  // Assess/Find are 2D-only, so also drop the sketch view out of 3D — otherwise
  // the shared map is left pitched with no controls to recover it.
  useEffect(() => {
    if (!isSketch) {
      setSketchActive(false)
      useSketchStore.getState().setView('2d')
    }
  }, [isSketch])

  // Sketch keyboard shortcuts (tool switching, undo/redo) — only while sketching.
  useEffect(() => {
    if (!isSketch) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const store = useSketchStore.getState()
      switch (e.key.toLowerCase()) {
        case 'v':
          e.preventDefault()
          store.setActiveTool('select')
          break
        case 'p':
          e.preventDefault()
          store.setActiveTool('polygon')
          break
        case 'k':
          e.preventDefault()
          store.setActiveTool('parking')
          break
        case 'c':
          e.preventDefault()
          store.setActiveTool('cad')
          break
        case 'm':
          e.preventDefault()
          store.setActiveTool('measure')
          break
        case 'escape': {
          // The guided Auto flow's own map-interaction cancel (boundary draw,
          // boundary-edit, access placement/edit) is handled by SketchLayer —
          // it must not also be blown out of the Parking tool here.
          const autoInteractivePhases = new Set([
            'boundary',
            'boundary-edit',
            'buildings',
            'entrance',
            'entrance-edit',
            'access',
            'access-edit',
          ])
          const inAutoInteraction =
            store.parkingMethod === 'auto' && autoInteractivePhases.has(store.autoParkingDraft.phase)
          if (!inAutoInteraction) store.setActiveTool('select')
          store.cancelMeasurement()
          if (store.selectedAutoLayoutId) store.setSelectedAutoLayoutId(null)
          break
        }
        case 'enter':
          if (store.activeTool === 'measure' && store.measurementInProgress) {
            e.preventDefault()
            store.freezeMeasurement()
          }
          break
        case 'z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) store.redo()
            else store.undo()
          }
          break
        case 'delete':
        case 'backspace':
          if (store.selectedAutoLayoutId) {
            e.preventDefault()
            store.deleteAutoLayout(store.selectedAutoLayoutId)
          } else if (store.selectedId) {
            e.preventDefault()
            if (store.selectedType === 'polygon') store.deletePolygon(store.selectedId)
            else if (store.selectedType === 'parking') store.deleteParkingBlock(store.selectedId)
            else if (store.selectedType === 'cad') store.deleteCadImage(store.selectedId)
          }
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSketch])

  // While comparing, the left panel edits one pin at a time — the inspector,
  // catchment tab and single-pin landscape all follow that active pin so the
  // surveyor sees live feedback as they tune each catchment. Otherwise it's the
  // lone Assess pin and the global catchment.
  const activePoint = comparePair ? comparePair[activeCompareArm] : assessPoint
  const activeCatchment = comparePair
    ? comparePair[activeCompareArm].catchment
    : catchment

  // The catchment focus: a selected built-up area, or a synthesized pseudo-area
  // around the active Assess pin. Keeps demographics keyed on a stable identity.
  const focusArea = useMemo<WorkspaceArea | null>(() => {
    if (area) return area
    if (view === 'assess' && activePoint)
      return {
        id: `point:${activePoint.lat.toFixed(5)},${activePoint.lng.toFixed(5)}`,
        name: 'Dropped point',
        center: [activePoint.lng, activePoint.lat],
        kind: 'point',
      }
    return null
  }, [area, view, activePoint])

  // Whether the catchment (isochrone/demographics) fetch should run. Distinct
  // from "Catchment tab is open": a drive/walk Assess pin needs its isochrone on
  // the Summary tab too, since the store landscape is scoped to that polygon.
  // Fetch whenever there's a focus so the sidebar header's Population + Affluence
  // metrics stay populated on every tab, not just the Catchment tab.
  const shouldFetchCatchment =
    !!focusArea ||
    tab === 'catchment' ||
    (view === 'assess' && !!activePoint && activeCatchment.mode !== 'distance')

  const catchmentData = useCatchment(focusArea, activeCatchment, shouldFetchCatchment)

  // Planning applications inside the active boundary (BUA polygon, radius
  // circle or isochrone) — fetched only while the Planning tab is open.
  const planning = usePlanningData(
    catchmentData.boundaryGeometry,
    tab === 'planning'
  )
  // A failed boundary must show the error state, not an endless boundary-wait
  // spinner — so the error always wins over loading.
  const planningError = planning.error ?? catchmentData.error
  const planningLoading =
    !planningError &&
    (planning.loading ||
      (tab === 'planning' &&
        !catchmentData.boundaryGeometry &&
        catchmentData.loading))

  // Two-location comparison: fetches + diffs the landscape/demographics for both
  // dropped pins (each with its own catchment) whenever a pair exists. Drives the
  // tray, the modal, and the per-pin catchment outlines on the map.
  const comparison = usePointComparison(comparePair, refData ?? null)

  // The landscape (nearby stores + missing brands) is read around whichever
  // point is active: a selected BUA's centroid or the Assess dropped pin.
  const center = useMemo(() => {
    if (area) return { lat: area.center[1], lon: area.center[0] }
    if (view === 'assess' && activePoint)
      return { lat: activePoint.lat, lon: activePoint.lng }
    return null
  }, [area, view, activePoint])

  // Under a drive/walk Assess catchment, scope the store landscape to the actual
  // isochrone polygon; otherwise use a radius circle (Assess km value, or the
  // fixed BUA radius when a built-up area is selected).
  const useIsochrone =
    view === 'assess' && !!activePoint && activeCatchment.mode !== 'distance'
  const landscapeIsochrone = useIsochrone ? catchmentData.boundaryGeometry : null
  const landscapeRadiusKm = area
    ? BUA_RADIUS_KM
    : activeCatchment.mode === 'distance'
      ? activeCatchment.value
      : BUA_RADIUS_KM
  const rawLandscape = useAreaData(
    center,
    landscapeRadiusKm * 1000,
    landscapeIsochrone
  )

  // For drive/walk, replace the server (radius-circle) missing-brands set with an
  // isochrone-accurate recompute that adds brands trading in the ring but outside
  // the blob. refData is already in scope here, so the low-level hook stays lean.
  const landscape = useMemo(() => {
    if (!useIsochrone || !landscapeIsochrone) return rawLandscape
    return {
      ...rawLandscape,
      missing: computeIsochroneMissing(
        rawLandscape.stores,
        rawLandscape.allStores,
        rawLandscape.missing,
        refData
      ),
    }
  }, [useIsochrone, landscapeIsochrone, rawLandscape, refData])

  // Live occupier requirements: all locations (map overlay) + those within the
  // active landscape radius (Summary promoted rows) + a brand-name lookup.
  const requirements = useRequirements(center, landscapeRadiusKm, landscapeIsochrone)

  // Find-gaps store pins: a separate map-pin stream (scenario 1: all stores in a
  // selected BUA polygon; scenario 2: brand/category pins in the viewport). Kept
  // decoupled from the inspector's radius-based landscape.stores above.
  const gapPins = useFindGapsStorePins(map)

  const presentStoreSource = useMemo(
    () => selectPresentStoreSource(area, landscape.stores, gapPins.pins),
    [area, landscape.stores, gapPins.pins]
  )

  // Present cards should count polygon stores for a selected BUA, while missing
  // brands stay on the existing landscape/missing-fascia catchment calculation.
  const { present } = useMemo(
    () => buildBrandLandscape(presentStoreSource, [], refData),
    [presentStoreSource, refData]
  )
  const { missing } = useMemo(
    () => buildBrandLandscape(landscape.stores, landscape.missing, refData),
    [landscape.stores, landscape.missing, refData]
  )

  // fascia -> its category ids, the single source of truth for both the brand-level
  // rollup below and the map-pin filter (which matches on a store's own fascia).
  const fasciaCategoryIds = useMemo(() => {
    const fasciaCats = new Map<string, string[]>()
    for (const m of refData?.fasciaCategoryMappings ?? []) {
      const list = fasciaCats.get(m.fascia_id)
      if (list) list.push(m.category_id)
      else fasciaCats.set(m.fascia_id, [m.category_id])
    }
    return fasciaCats
  }, [refData])

  // Authoritative brand -> categoryIds from refData; covers requirement-only brands
  // that aren't in the present/missing lists.
  const brandCategoryIds = useMemo(() => {
    const byBrand = new Map<string, string[]>()
    for (const b of refData?.brands ?? []) {
      const set = new Set<string>()
      for (const f of b.fascias)
        for (const c of fasciaCategoryIds.get(f.id) ?? []) set.add(c)
      byBrand.set(b.id, Array.from(set))
    }
    return byBrand
  }, [refData, fasciaCategoryIds])

  const reqLocal = requirements.local

  const categoryOptions = useMemo(() => {
    const catName = new Map<string, string>()
    for (const c of refData?.categories ?? []) catName.set(c.id, c.name)
    const ids = new Set<string>()
    for (const b of present) for (const c of b.categoryIds) ids.add(c)
    for (const b of missing) for (const c of b.categoryIds) ids.add(c)
    for (const r of reqLocal)
      if (r.brandId)
        for (const c of brandCategoryIds.get(r.brandId) ?? []) ids.add(c)
    const opts: { id: string; name: string }[] = []
    for (const id of Array.from(ids)) {
      const name = catName.get(id)
      if (name) opts.push({ id, name })
    }
    opts.sort((a, b) => a.name.localeCompare(b.name))
    return opts
  }, [present, missing, reqLocal, brandCategoryIds, refData])

  const brandOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const b of present) if (!byId.has(b.brandId)) byId.set(b.brandId, b.brandName)
    for (const b of missing) if (!byId.has(b.brandId)) byId.set(b.brandId, b.brandName)
    for (const r of reqLocal)
      if (r.brandId && !byId.has(r.brandId)) byId.set(r.brandId, r.companyName)
    const opts = Array.from(byId, ([id, name]) => ({ id, name }))
    opts.sort((a, b) => a.name.localeCompare(b.name))
    return opts
  }, [present, missing, reqLocal])

  const catSet = useMemo(
    () => new Set(brandFilterCategoryIds),
    [brandFilterCategoryIds]
  )
  const brandSet = useMemo(() => new Set(brandFilterBrandIds), [brandFilterBrandIds])

  const filteredPresent = useMemo(
    () =>
      present.filter(
        (b) =>
          (catSet.size === 0 || b.categoryIds.some((c) => catSet.has(c))) &&
          (brandSet.size === 0 || brandSet.has(b.brandId))
      ),
    [present, catSet, brandSet]
  )

  const filteredMissing = useMemo(
    () =>
      missing.filter(
        (b) =>
          (catSet.size === 0 || b.categoryIds.some((c) => catSet.has(c))) &&
          (brandSet.size === 0 || brandSet.has(b.brandId))
      ),
    [missing, catSet, brandSet]
  )

  const filteredRequirements = useMemo(
    () =>
      reqLocal.filter((r) => {
        if (catSet.size === 0 && brandSet.size === 0) return true
        if (!r.brandId) return false
        const cats = brandCategoryIds.get(r.brandId) ?? []
        return (
          (catSet.size === 0 || cats.some((c) => catSet.has(c))) &&
          (brandSet.size === 0 || brandSet.has(r.brandId))
        )
      }),
    [reqLocal, catSet, brandSet, brandCategoryIds]
  )

  // null = no filters active, so the map shows every present-brand pin.
  const visiblePresentBrandIds = useMemo(() => {
    if (catSet.size === 0 && brandSet.size === 0) return null
    return new Set(filteredPresent.map((b) => b.brandId))
  }, [filteredPresent, catSet, brandSet])

  // Apply the sidebar's brand/category filters to the map pins so they track the
  // filtered cards. Category matching is by each store's own fascia to mirror the
  // present-brand rollup in buildBrandLandscape.
  const filteredGapPins = useMemo(
    () => filterGapStorePins(gapPins.pins, catSet, brandSet, fasciaCategoryIds),
    [gapPins.pins, catSet, brandSet, fasciaCategoryIds]
  )

  // The inspector has content to show in these states; `inspectorHidden`
  // then decides whether it's actually rendered or collapsed to an edge tab.
  const inspectorAvailable =
    !isSketch &&
    (Boolean(area) || view === 'find' || (view === 'assess' && Boolean(assessPoint)))

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-sm-bg">
      <Toaster position="top-center" richColors />
      <UChrome
        onSelectLocation={(center) =>
          map?.flyTo({ center, zoom: 13, duration: 900 })
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <URail />
        {/*
          Directory is a full-pane, map-less mode: it replaces the left panel, map and
          inspector entirely rather than sitting alongside them. setMode's existing reset
          already clears area/selection/modals, so nothing leaks in or out.
        */}
        {isDirectory ? (
          <UDirectory />
        ) : (
          <>
        {isSketch ? (
          sketchActive ? (
            <USketchPanel onExit={() => setSketchActive(false)} />
          ) : (
            <USketchLauncher onActivate={() => setSketchActive(true)} />
          )
        ) : (
          <ULeftPanel
            refData={refData}
            hidden={leftHidden}
            onToggle={toggleLeft}
          />
        )}

        <main className="relative flex-1">
          <UnifiedMap
            onMap={setMap}
            storeDots={landscape.stores}
            gapStorePins={filteredGapPins}
            gapPinsStatus={gapPins.status}
            visiblePresentBrandIds={visiblePresentBrandIds}
            requirements={requirements.withinCatchment}
            planningApplications={planning.applications}
            lsoa={{
              allCodes: catchmentData.allLsoaCodes,
              selectedCodes: catchmentData.selectedLsoaCodes,
              onToggle: catchmentData.toggleLsoa,
              boundaryGeometry: catchmentData.boundaryGeometry,
            }}
            compareBoundaries={{
              a: comparison.boundaries.a,
              b: comparison.boundaries.b,
              active: activeCompareArm,
            }}
          />

          {isSketch && map && (
            <>
              <SketchLayer map={map} />
              <FloatingMapControls offsetForInspector={false} />
            </>
          )}

          {/* Compare flow: drop-hint while arming, then the persistent tray. */}
          {compareArm && !comparePair && (
            <div className="pointer-events-none absolute left-1/2 top-3.5 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-sm-orange-tint bg-sm-surface px-4 py-2 shadow-[0_4px_14px_-6px_rgba(20,10,40,0.3)]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sm-orange text-[9px] font-bold text-white">
                B
              </span>
              <span className="text-[12.5px] font-medium text-sm-ink">
                Click a second location to drop pin B and compare
              </span>
            </div>
          )}
          {comparePair && !pointCompareOpen && (
            <UPointCompareTray
              pair={comparePair}
              error={comparison.error}
              onOpen={() => setPointCompareOpen(true)}
              onClear={clearPointCompare}
            />
          )}
        </main>

        {isSketch && sketchActive && <USketchInspector />}

        {inspectorAvailable && (
          <UInspector
            hidden={inspectorHidden}
            onToggle={toggleInspector}
            findResults={findGaps.results}
            findTotal={findGaps.total}
            findLoading={findGaps.loading}
            findError={findGaps.error}
            landscape={landscape}
            presentBrands={filteredPresent}
            missingBrands={filteredMissing}
            requirements={filteredRequirements}
            catchment={catchmentData}
            categoryOptions={categoryOptions}
            brandOptions={brandOptions}
            planningApplications={planning.applications}
            planningLoading={planningLoading}
            planningError={planningError}
            planningTruncated={planning.truncated}
            planningTruncationReason={planning.truncationReason}
            planningProgress={planning.progress}
          />
        )}
          </>
        )}
      </div>

      {reqModal && (
        <URequirementModal
          requirementId={reqModal}
          onClose={() => setReqModal(null)}
        />
      )}
      {brandModal &&
        (() => {
          const liveReq = requirements.findActiveRequirementByBrandId(
            brandModal.brandId
          )
          return liveReq ? (
            <UBrandModal
              missing={brandModal}
              areaName={area?.name ?? 'this location'}
              liveRequirement={liveReq}
              onClose={() => setBrandModal(null)}
            />
          ) : (
            <UBrandInfoModal
              brandId={brandModal.brandId}
              onClose={() => setBrandModal(null)}
              onActiveRequirement={(id) => {
                setBrandModal(null)
                setReqModal(id)
              }}
            />
          )
        })()}
      {brandInfoId && (
        <UBrandInfoModal
          brandId={brandInfoId}
          onClose={() => setBrandInfoId(null)}
          onActiveRequirement={(id) => {
            setBrandInfoId(null)
            setReqModal(id)
          }}
        />
      )}
      {planningModal && (
        <UPlanningModal
          application={planningModal}
          onClose={() => setPlanningModal(null)}
        />
      )}

      {comparePair && pointCompareOpen && (
        <UPointCompare
          pair={comparePair}
          comparison={comparison}
          onClose={() => setPointCompareOpen(false)}
          onClear={clearPointCompare}
        />
      )}
    </div>
  )
}
