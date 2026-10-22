import type { MeasurementMode } from '@/components/demographics/shared/types/demographics.types'
import type { CatchmentDefinition } from '../types/unified-workspace'

// Map the workspace catchment mode onto the demographics engine's mode enum.
export const MODE_MAP: Record<CatchmentDefinition['mode'], MeasurementMode> = {
  distance: 'distance',
  drive: 'drive_time',
  walk: 'walk_time',
}

export const MILES_PER_KM = 0.621371

// Build the request fields the /api/demographics/boundaries route expects.
//
// Contract (do NOT "fix"): the route reuses a single `radius_miles` field for
// both catchment kinds — it carries *miles* for a distance catchment (our value
// is km, converted here) but *minutes* for drive/walk (passed through unchanged).
// This mirrors useDemographicsData.analyze, which the single-point Assess flow uses.
export function toDemographicsRequest(catchment: CatchmentDefinition): {
  measurement_mode: MeasurementMode
  radius_miles: number
} {
  return {
    measurement_mode: MODE_MAP[catchment.mode],
    radius_miles:
      catchment.mode === 'distance'
        ? catchment.value * MILES_PER_KM
        : catchment.value,
  }
}
