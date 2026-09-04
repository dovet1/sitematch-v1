import { ENTRANCE_INTERACTIVE_PHASES, type AutoParkingPhase } from './types'

/**
 * A stationary press on the entrance marker is the user's placement click
 * while the entrance step is active. Only drags (or clicks outside that step)
 * should consume the map click that follows mouseup.
 */
export function shouldSuppressEntranceMarkerClick(
  phase: AutoParkingPhase,
  wasMoved: boolean
): boolean {
  return wasMoved || !ENTRANCE_INTERACTIVE_PHASES.has(phase)
}
