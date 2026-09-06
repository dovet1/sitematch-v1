'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchFloorAreaProfiles } from '../services/floor-area-service'
import {
  selectProfiles,
  type FloorAreaProfile,
  type MeasuredEstate,
} from '../size-filter'

export interface FloorAreaProfiles {
  // brandId -> the profiles to read that brand by. Multi-format brands are
  // already reduced to their fascia rows (see selectProfiles); a brand absent
  // from this map has no size on record, which is a different answer from
  // "doesn't fit" and is displayed as such.
  byBrand: Record<string, FloorAreaProfile[]>
  // Brands below the profile sample floor, carrying the individual shops we
  // measured instead of a distribution. Keyed the same way; a brand appears in
  // at most one of the two maps.
  measuredByBrand: Record<string, MeasuredEstate>
  loading: boolean
  // True when the lookup failed outright — the data layer is unavailable rather
  // than empty, so the size filter is hidden instead of offering a control that
  // can only ever return nothing.
  unavailable: boolean
}

const EMPTY: Record<string, FloorAreaProfile[]> = {}
const EMPTY_MEASURED: Record<string, MeasuredEstate> = {}

// Observed floor-area distributions for the brands currently on screen. Keyed on
// the sorted brand-id set so panning/filtering inside the same catchment does
// not refetch.
export function useFloorAreaProfiles(brandIds: string[]): FloorAreaProfiles {
  const [byBrand, setByBrand] = useState<Record<string, FloorAreaProfile[]>>(EMPTY)
  const [measuredByBrand, setMeasuredByBrand] =
    useState<Record<string, MeasuredEstate>>(EMPTY_MEASURED)
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const reqId = useRef(0)

  const key = useMemo(
    () => Array.from(new Set(brandIds)).sort().join(','),
    [brandIds]
  )

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (ids.length === 0) {
      setByBrand(EMPTY)
      setMeasuredByBrand(EMPTY_MEASURED)
      setUnavailable(false)
      return
    }
    const id = ++reqId.current
    const controller = new AbortController()
    setLoading(true)

    fetchFloorAreaProfiles(ids, controller.signal)
      .then(({ profiles, measured }) => {
        if (id !== reqId.current) return
        const reduced: Record<string, FloorAreaProfile[]> = {}
        for (const [brandId, rows] of Object.entries(profiles)) {
          const selected = selectProfiles(rows)
          if (selected.length > 0) reduced[brandId] = selected
        }
        setByBrand(reduced)
        setMeasuredByBrand(measured)
        setUnavailable(false)
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || id !== reqId.current) return
        console.error('Floor-area profiles error', err)
        setByBrand(EMPTY)
        setMeasuredByBrand(EMPTY_MEASURED)
        setUnavailable(true)
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })

    return () => controller.abort()
  }, [key])

  return { byBrand, measuredByBrand, loading, unavailable }
}
