'use client'

import { createContext, useContext } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { MonitorCriteria } from '@/lib/planning-monitor/criteria'
import type { MonitorPatch, MonitorRow } from '@/lib/planning-monitor/types'
import type { ReferenceData } from '../../../types/unified-workspace'
import type { PlanningListState, PlanningMapState } from '../../../lib/hooks/usePlanningMonitor'
import type { DraftLocation, PatchDigestResponse } from '../../../lib/services/planning-monitor-service'
import type { NearbyStore } from '../../../lib/services/gaps-service'
import type { StackPick } from '../../../lib/stores/planning-monitor-store'

export interface PlanningDigestState {
  data: PatchDigestResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
  requestPreview: () => void
}

export interface PlanningModeValue {
  map: mapboxgl.Map | null
  list: PlanningListState
  mapState: PlanningMapState
  digest: PlanningDigestState
  stores: NearbyStore[]
  /** The brand filter's radius, drawn around each of `stores`. */
  storeRadiusMeters: number | null
  refData: ReferenceData
  userEmail: string
  /** Select a row (or clear with null); `fly` also moves the map to it. */
  selectRow: (row: MonitorRow | null, options?: { fly?: boolean }) => void
  /**
   * Open the development behind a map pin or a summary row. `relaxed` also looks outside today's
   * time frame and status (an archived week's row); `fly` moves the map to it.
   */
  pickSingle: (pick: { applicationId: string; rowKey: string; developmentId?: string | null; lngLat: [number, number]; fly?: boolean; relaxed?: boolean }) => void
  /** Open the list behind a pin holding several applications (again, to retry). */
  openStack: (pick: StackPick) => void
  toggleWatch: (row: MonitorRow) => Promise<void>
  /** Save changes to the patch; omitted fields keep their saved values. */
  savePatch: (changes: { name?: string; criteria?: MonitorCriteria; location?: DraftLocation }) => Promise<MonitorPatch>
  createPatch: (input: { name: string; criteria: MonitorCriteria; location: DraftLocation; emailEnabled: boolean }) => Promise<MonitorPatch>
  setEmail: (enabled: boolean) => Promise<void>
  deletePatch: () => Promise<void>
}

export const PlanningModeContext = createContext<PlanningModeValue | null>(null)

export function usePlanningMode(): PlanningModeValue {
  const value = useContext(PlanningModeContext)
  if (!value) throw new Error('Planning mode components must be inside PlanningModeProvider')
  return value
}
