'use client'

import { useEffect, useMemo, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { Toaster } from 'sonner'
import { UChrome } from './shell/UChrome'
import { URail } from './shell/URail'
import { ULeftPanel } from './shell/ULeftPanel'
import { UInspector } from './shell/UInspector'
import { UnifiedMap } from './map/UnifiedMap'
import { SketchLayer } from './map/SketchLayer'
import { useWorkspaceStore } from '../lib/stores/unified-workspace-store'
import { useReferenceData } from '../lib/hooks/useReferenceData'
import { useFindGaps } from '../lib/hooks/useFindGaps'
import { useAreaData } from '../lib/hooks/useAreaData'
import { useCatchment } from '../lib/hooks/useCatchment'
import { useRequirements } from '../lib/hooks/useRequirements'
import { computeIsochroneMissing } from '../lib/isochrone-missing'
import { buildBrandLandscape } from '../lib/brand-landscape'
import { URequirementModal, UBrandModal, UBrandInfoModal } from './shell/UDetailModals'
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
  const setReqModal = useWorkspaceStore((s) => s.setReqModal)
  const setBrandModal = useWorkspaceStore((s) => s.setBrandModal)
  const setBrandInfoId = useWorkspaceStore((s) => s.setBrandInfoId)
  const brandFilterCategoryIds = useWorkspaceStore((s) => s.brandFilterCategoryIds)
  const brandFilterBrandIds = useWorkspaceStore((s) => s.brandFilterBrandIds)

  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  // Sketch mode shows a launcher until a session is started/opened.
  const [sketchActive, setSketchActive] = useState(false)

  const { data: refData } = useReferenceData()
  const findGaps = useFindGaps(view === 'find')

  const isSketch = view === 'sketch'

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
        case 'escape':
          store.setActiveTool('select')
          store.cancelMeasurement()
          break
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
          if (store.selectedId) {
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

  // The catchment focus: a selected built-up area, or a synthesized pseudo-area
  // around the Assess dropped pin. Keeps demographics keyed on a stable identity.
  const focusArea = useMemo<WorkspaceArea | null>(() => {
    if (area) return area
    if (view === 'assess' && assessPoint)
      return {
        id: `point:${assessPoint.lat.toFixed(5)},${assessPoint.lng.toFixed(5)}`,
        name: 'Dropped point',
        center: [assessPoint.lng, assessPoint.lat],
        kind: 'point',
      }
    return null
  }, [area, view, assessPoint])

  // Whether the catchment (isochrone/demographics) fetch should run. Distinct
  // from "Catchment tab is open": a drive/walk Assess pin needs its isochrone on
  // the Summary tab too, since the store landscape is scoped to that polygon.
  const shouldFetchCatchment =
    tab === 'catchment' ||
    (view === 'assess' && !!assessPoint && catchment.mode !== 'distance')

  const catchmentData = useCatchment(focusArea, catchment, shouldFetchCatchment)

  // The landscape (nearby stores + missing brands) is read around whichever
  // point is active: a selected BUA's centroid or the Assess dropped pin.
  const center = useMemo(() => {
    if (area) return { lat: area.center[1], lon: area.center[0] }
    if (view === 'assess' && assessPoint)
      return { lat: assessPoint.lat, lon: assessPoint.lng }
    return null
  }, [area, view, assessPoint])

  // Under a drive/walk Assess catchment, scope the store landscape to the actual
  // isochrone polygon; otherwise use a radius circle (Assess km value, or the
  // fixed BUA radius when a built-up area is selected).
  const useIsochrone =
    view === 'assess' && !!assessPoint && catchment.mode !== 'distance'
  const landscapeIsochrone = useIsochrone ? catchmentData.boundaryGeometry : null
  const landscapeRadiusKm = area
    ? BUA_RADIUS_KM
    : catchment.mode === 'distance'
      ? catchment.value
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

  // Brand-level landscape for the Assess tabs, computed once here and fed to both
  // the inspector lists and the map pins so the two stay in sync under filtering.
  const { present, missing } = useMemo(
    () => buildBrandLandscape(landscape.stores, landscape.missing, refData),
    [landscape.stores, landscape.missing, refData]
  )

  // Authoritative brand -> categoryIds from refData; covers requirement-only brands
  // that aren't in the present/missing lists.
  const brandCategoryIds = useMemo(() => {
    const fasciaCats = new Map<string, string[]>()
    for (const m of refData?.fasciaCategoryMappings ?? []) {
      const list = fasciaCats.get(m.fascia_id)
      if (list) list.push(m.category_id)
      else fasciaCats.set(m.fascia_id, [m.category_id])
    }
    const byBrand = new Map<string, string[]>()
    for (const b of refData?.brands ?? []) {
      const set = new Set<string>()
      for (const f of b.fascias)
        for (const c of fasciaCats.get(f.id) ?? []) set.add(c)
      byBrand.set(b.id, Array.from(set))
    }
    return byBrand
  }, [refData])

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

  const showInspector =
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
        {isSketch ? (
          sketchActive ? (
            <USketchPanel onExit={() => setSketchActive(false)} />
          ) : (
            <USketchLauncher onActivate={() => setSketchActive(true)} />
          )
        ) : (
          <ULeftPanel refData={refData} />
        )}

        <main className="relative flex-1">
          <UnifiedMap
            onMap={setMap}
            storeDots={landscape.stores}
            visiblePresentBrandIds={visiblePresentBrandIds}
            requirements={requirements.withinCatchment}
            lsoa={{
              allCodes: catchmentData.allLsoaCodes,
              selectedCodes: catchmentData.selectedLsoaCodes,
              onToggle: catchmentData.toggleLsoa,
              boundaryGeometry: catchmentData.boundaryGeometry,
            }}
          />

          {isSketch && map && (
            <>
              <SketchLayer map={map} />
              <FloatingMapControls offsetForInspector={false} />
            </>
          )}
        </main>

        {isSketch && sketchActive && <USketchInspector />}

        {showInspector && (
          <UInspector
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
          />
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
    </div>
  )
}
