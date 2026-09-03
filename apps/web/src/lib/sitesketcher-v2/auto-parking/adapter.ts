/**
 * Auto parking — SolverInput / AutoParkingLayout adapters.
 *
 * PURE MODULE. Translates sketch state (a boundary polygon, its detected
 * exclusions, a snapped access point, and the panel's settings snapshot) into
 * the solver's `SolverInput`, and translates a chosen `CandidateLayout` back
 * into a persisted `AutoParkingLayout`. No React, no Zustand, no map
 * instances — imports only the pure `lib/parking-layout-lab` solver types and
 * sibling pure modules (detection/hash/geojson). See
 * INTEGRATION_PLAN.md §3a/§7.
 */

import { PARKING_DIMENSIONS } from '../constants';
import { candidateToGeoJSON } from '@/lib/parking-layout-lab/geojson';
import type {
  AccessibleBayConfig,
  CandidateLayout,
  LngLat,
  SolverInput,
  SolverOutput,
  Vehicle,
} from '@/lib/parking-layout-lab/types';
import type { AutoParkingLayout } from '@/types/sitesketcher-v2';
import type { DetectedExclusion } from './detection';
import { computeSourceHash } from './hash';
import { filterLayoutFeatures } from './geojson';

/** Simplified vehicle envelope used whenever manoeuvring checks are enabled. */
export const DEFAULT_AUTO_PARKING_VEHICLE: Vehicle = {
  turningRadius: 6,
  sweptWidth: 2.0,
  length: 4.8,
};

/** Accessible bay footprint used whenever accessible-bay designation is enabled. */
export const DEFAULT_AUTO_PARKING_ACCESSIBLE_BAY: AccessibleBayConfig = {
  width: 3.6,
  length: 4.8,
  sharedAccessWidth: 1.2,
};

export interface BuildSolverInputParams {
  boundaryRing: LngLat[];
  exclusions: DetectedExclusion[];
  accessPoint: LngLat;
  settings: AutoParkingLayout['settingsSnapshot'];
}

/** Builds the solver's input from the current draft — the "generate" action. */
export function buildSolverInput(params: BuildSolverInputParams): SolverInput {
  const { boundaryRing, exclusions, accessPoint, settings } = params;
  const stall = PARKING_DIMENSIONS[settings.stallSize];

  const input: SolverInput = {
    boundary: { ring: boundaryRing },
    exclusions: exclusions.map((e) => ({ ring: e.ring })),
    accessPoint,
    stall,
    aisleWidth: settings.aisleWidth,
    boundarySetback: settings.boundarySetback,
    exclusionClearance: settings.buildingClearance,
  };

  if (settings.checkManoeuvring) {
    input.vehicle = DEFAULT_AUTO_PARKING_VEHICLE;
    input.oneWay = settings.oneWay;
    input.gateQueue =
      settings.gateQueueVehicles != null && settings.gateQueueVehicles > 0
        ? { vehicles: settings.gateQueueVehicles }
        : null;
  }

  if (settings.accessibleBays.on) {
    input.accessible = {
      rate: settings.accessibleBays.percent / 100,
      bay: DEFAULT_AUTO_PARKING_ACCESSIBLE_BAY,
    };
  }

  return input;
}

/**
 * Sentinel `autoLayoutId` for the transient candidate preview rendered while
 * the user is still choosing a candidate (before apply). It never persists and
 * never matches a real `AutoParkingLayout.id`, so preview features stay
 * non-interactive — the applied-layout click path can't select them.
 */
export const AUTO_PARKING_PREVIEW_ID = '__auto-parking-preview__';

/**
 * Builds the same filtered/namespaced layout geometry `buildAutoParkingLayout`
 * persists, but for the *selected candidate before apply* — so the on-map
 * preview matches the applied result exactly. See INTEGRATION_PLAN.md §8 Phase 3.
 */
export function buildCandidatePreviewGeometry(
  solverInput: SolverInput,
  solverOutput: SolverOutput,
  candidate: CandidateLayout,
): GeoJSON.FeatureCollection {
  return filterLayoutFeatures(
    candidateToGeoJSON(solverInput, solverOutput, candidate),
    AUTO_PARKING_PREVIEW_ID,
  );
}

export interface BuildAutoParkingLayoutParams {
  id: string;
  name: string;
  boundaryId: string;
  exclusions: DetectedExclusion[];
  settingsSnapshot: AutoParkingLayout['settingsSnapshot'];
  solverInput: SolverInput;
  solverOutput: SolverOutput;
  candidate: CandidateLayout;
  now?: number;
}

/** Turns a chosen candidate into the persisted, filtered, hashed `AutoParkingLayout` — the "apply" action. */
export function buildAutoParkingLayout(params: BuildAutoParkingLayoutParams): AutoParkingLayout {
  const {
    id,
    name,
    boundaryId,
    exclusions,
    settingsSnapshot,
    solverInput,
    solverOutput,
    candidate,
    now = Date.now(),
  } = params;

  const geometry = filterLayoutFeatures(
    candidateToGeoJSON(solverInput, solverOutput, candidate),
    id,
  );

  const accessibleCount = candidate.rows
    .flatMap((row) => row.stalls)
    .filter((stall) => stall.accessible).length;

  const sourceHash = computeSourceHash({
    boundaryRing: solverInput.boundary.ring,
    exclusions,
    accessPoint: solverOutput.snappedAccessPoint,
    settingsSnapshot,
  });

  return {
    id,
    name,
    geometrySchemaVersion: 1,
    boundaryId,
    exclusionRefs: exclusions.map((e) => ({ id: e.id, kind: e.kind })),
    accessPoint: solverOutput.snappedAccessPoint,
    boundarySnapshot: solverInput.boundary.ring,
    settingsSnapshot,
    geometry,
    metrics: {
      totalSpaces: candidate.stallCount,
      standard: candidate.stallCount - accessibleCount,
      accessible: accessibleCount,
      rows: candidate.rows.length,
      footprintSqm: candidate.parkingFootprintSqm,
    },
    warnings: candidate.warnings,
    sourceHash,
    createdAt: now,
    updatedAt: now,
  };
}
