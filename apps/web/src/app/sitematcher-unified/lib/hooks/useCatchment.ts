'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { LocationResult } from '@/lib/mapbox'
import type { MeasurementMode } from '@/components/demographics/shared/types/demographics.types'
import { useDemographicsData } from '@/components/demographics/shared/hooks/useDemographicsData'
import { useLsoaSelection } from '@/components/demographics/shared/hooks/useLsoaSelection'
import type { WorkspaceArea, CatchmentDefinition } from '../../types/unified-workspace'

// Map the workspace catchment mode onto the demographics engine's mode enum.
const MODE_MAP: Record<CatchmentDefinition['mode'], MeasurementMode> = {
  distance: 'distance',
  drive: 'drive_time',
  walk: 'walk_time',
}

const MILES_PER_KM = 0.621371

// A GeoJSON circle (km) around [lng, lat] — used to outline a distance catchment.
function circleGeometry(
  lng: number,
  lat: number,
  radiusKm: number,
  steps = 72
): GeoJSON.Polygon {
  const radiusMeters = radiusKm * 1000
  const coords: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI
    const dLat = (radiusMeters / 111320) * Math.cos(angle)
    const dLng =
      (radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle)
    coords.push([lng + dLng, lat + dLat])
  }
  return { type: 'Polygon', coordinates: [coords] }
}

export interface CatchmentData {
  location: LocationResult | null
  measurementMode: MeasurementMode
  measurementValue: number
  loading: boolean
  error: string | null
  rawData: Record<string, any> | null
  nationalAverages: Record<string, number>
  lsoaTooltipData: Record<string, any>
  allLsoaCodes: string[]
  selectedLsoaCodes: Set<string>
  toggleLsoa: (code: string) => void
  // The catchment outline drawn on the map (isochrone for drive/walk, circle for distance).
  boundaryGeometry: GeoJSON.Geometry | null
}

// Orchestrates the reused SiteAnalyser hooks for the unified Catchment tab.
// Fetches demographics for the active focus (a picked area or dropped point)
// whenever the catchment definition changes, and keeps figures live as LSOA
// cells are toggled on the map.
export function useCatchment(
  focus: WorkspaceArea | null,
  catchment: CatchmentDefinition,
  active: boolean
): CatchmentData {
  const {
    rawDemographicsData,
    isochroneGeometry,
    lsoaTooltipData,
    nationalAverages,
    loading,
    error,
    analyze,
    analyzeBua,
    reset: resetData,
    updateData,
  } = useDemographicsData()

  const {
    selectedLsoaCodes,
    allLsoaCodes,
    toggleLsoa,
    initializeSelection,
    reset: resetSelection,
  } = useLsoaSelection()

  const measurementMode = MODE_MAP[catchment.mode]
  const measurementValue = catchment.value

  // A synthetic LocationResult so the demographics engine can key on the focus.
  const location = useMemo<LocationResult | null>(() => {
    if (!focus) return null
    return {
      id: focus.id,
      place_name: focus.name,
      center: focus.center,
      place_type: ['place'],
      text: focus.name,
    }
  }, [focus])

  // (Re)analyse when the focus or catchment definition changes while the tab is
  // open. A signature guards against re-running for unrelated renders.
  const lastRun = useRef<string | null>(null)
  useEffect(() => {
    if (!active || !location) {
      lastRun.current = null
      return
    }
    const signature =
      focus?.kind === 'bua'
        ? `${location.id}|bua`
        : `${location.id}|${measurementMode}|${measurementValue}`
    if (lastRun.current === signature) return
    lastRun.current = signature

    let cancelled = false
    resetSelection()
    if (focus?.kind === 'bua') {
      analyzeBua(focus.id).then((result) => {
        if (cancelled) return
        if (result.success && result.lsoaCodes) {
          initializeSelection(result.lsoaCodes)
        }
      })
      return () => {
        cancelled = true
      }
    }

    // The demographics API takes distance in miles; our catchment value is km.
    // Drive/walk are minutes and pass through unchanged.
    const apiValue =
      catchment.mode === 'distance' ? measurementValue * MILES_PER_KM : measurementValue
    analyze(location, measurementMode, apiValue).then((result) => {
      if (cancelled) return
      if (result.success && result.lsoaCodes) {
        initializeSelection(result.lsoaCodes)
      }
    })
    return () => {
      cancelled = true
    }
    // analyze/analyzeBua/initializeSelection/resetSelection are stable enough;
    // keying on the primitive inputs avoids re-fetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, location, focus?.kind, measurementMode, measurementValue])

  // Clear everything only when catchment data is no longer needed (neither the
  // Catchment tab nor the drive/walk landscape needs it) or the focus is dropped.
  // `active` is the caller's shouldFetch, so switching Summary↔Catchment on a
  // drive/walk pin keeps the isochrone the landscape depends on.
  useEffect(() => {
    if (active && focus) return
    resetData()
    resetSelection()
    lastRun.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, focus])

  // Re-aggregate demographics for the current LSOA subset as cells are toggled.
  useEffect(() => {
    if (!rawDemographicsData || selectedLsoaCodes.size === 0) return
    const codes = Array.from(selectedLsoaCodes)
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      fetch('/api/demographics/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geography_codes: codes }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to refetch demographics')
          return res.json()
        })
        .then((data) => updateData(data.by_lsoa))
        .catch((err) => {
          if (err?.name !== 'AbortError') console.error('Catchment refetch error', err)
        })
    }, 300)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLsoaCodes])

  const boundaryGeometry = useMemo<GeoJSON.Geometry | null>(() => {
    if (!focus) return null
    if (isochroneGeometry) return isochroneGeometry as GeoJSON.Geometry
    if (focus.kind === 'bua') return null
    if (catchment.mode === 'distance') {
      return circleGeometry(focus.center[0], focus.center[1], measurementValue)
    }
    return null
  }, [focus, isochroneGeometry, catchment.mode, measurementValue])

  return {
    location,
    measurementMode,
    measurementValue,
    loading,
    error,
    rawData: rawDemographicsData,
    nationalAverages,
    lsoaTooltipData,
    allLsoaCodes,
    selectedLsoaCodes,
    toggleLsoa,
    boundaryGeometry,
  }
}
