/**
 * Auto parking — transient workflow contracts (guided flow).
 *
 * `AutoParkingLayout` (the persisted, applied result) lives in
 * `@/types/sitesketcher-v2` alongside `SketchData`. Everything here is the
 * *working* state the guided panel edits before a layout is applied — never
 * persisted, and normalised out of Zustand rather than the DB. See
 * docs/design_handoff_auto_parking_guided/README.md.
 */

import type { AutoParkingEntrance, AutoParkingLayout } from '@/types/sitesketcher-v2';
import type { LngLat } from '@/lib/parking-layout-lab/types';
import type { AccessAnchor } from './access-point';

/**
 * The guided flow (README §"State Management" `phase`), split further so
 * boundary/entrance/access editing ("Change") are their own phases rather
 * than overloading the initial draw/placement phases.
 */
export type AutoParkingPhase =
  | 'boundary' // drawing the initial site boundary (guided step 1)
  | 'boundary-edit' // "Change" on the completed Site boundary card
  | 'buildings' // draw/select the optional building set (guided step 2)
  | 'entrance' // placing the initial free/building-wall entrance (guided step 3)
  | 'entrance-edit' // "Change" on the completed Building entrance card
  | 'access' // placing the initial vehicle access point (guided step 4)
  | 'access-edit' // "Change" on the completed Vehicle access card
  | 'ready' // both inputs set, layout settings + "Create layouts"
  | 'generating' // solve in flight
  | 'compare' // comparing/live-editing candidates
  | 'editing'; // re-opened an already-applied layout for edit/regenerate

export interface AutoParkingDraft {
  boundaryId: string | null;
  /** Boundary ring snapshot taken when "Change" was clicked — restored on Escape. */
  boundarySnapshot: LngLat[] | null;
  /** Explicit polygon buildings. Intersecting CAD is derived and mandatory. */
  buildingRefs: Array<{ id: string; kind: 'polygon'; source: 'drawn' | 'selected' }>;
  buildingMode: 'draw' | 'select';
  entrance: AutoParkingEntrance | null;
  entranceSnapshot: AutoParkingEntrance | null;
  accessAnchor: AccessAnchor | null;
  /** Access anchor snapshot taken when "Change" was clicked — restored on Escape. */
  accessAnchorSnapshot: AccessAnchor | null;
  /** Phase to return to once boundary-edit/access-edit commits or cancels. */
  phaseBeforeEdit: AutoParkingPhase | null;
  settings: AutoParkingLayout['settingsSnapshot'];
  /** Layout settings drawer expand/collapse — collapsed by default (state 03), expanded in compare (state 04). */
  settingsExpanded: boolean;
  phase: AutoParkingPhase;
  /** Set when this draft is regenerating/editing an already-applied layout — accept replaces this id instead of adding a new layout. */
  editingLayoutId: string | null;
  /** One-shot flag: the panel should immediately kick a generate once boundary+access are present (set by "Edit layout settings" / "Regenerate"). */
  pendingAutoGenerate: boolean;
}

export type AutoParkingGenerationStatus = 'idle' | 'running' | 'failed';

export const DEFAULT_AUTO_PARKING_SETTINGS: AutoParkingLayout['settingsSnapshot'] = {
  stallSize: 'standard',
  aisleWidth: 6,
  boundarySetback: 3,
  buildingClearance: 1,
  checkManoeuvring: false,
  oneWay: false,
  gateQueueVehicles: null,
  accessibleBays: { on: true, percent: 6 },
};

export function createDefaultAutoParkingDraft(): AutoParkingDraft {
  return {
    boundaryId: null,
    boundarySnapshot: null,
    buildingRefs: [],
    buildingMode: 'draw',
    entrance: null,
    entranceSnapshot: null,
    accessAnchor: null,
    accessAnchorSnapshot: null,
    phaseBeforeEdit: null,
    settings: { ...DEFAULT_AUTO_PARKING_SETTINGS, accessibleBays: { ...DEFAULT_AUTO_PARKING_SETTINGS.accessibleBays } },
    settingsExpanded: false,
    phase: 'boundary',
    editingLayoutId: null,
    pendingAutoGenerate: false,
  };
}

/** Phases where the site boundary is being actively drawn/edited on the map. */
export const BOUNDARY_INTERACTIVE_PHASES: ReadonlySet<AutoParkingPhase> = new Set<AutoParkingPhase>([
  'boundary',
  'boundary-edit',
]);
/** Phases where the access point is being actively placed/edited on the map. */
export const ACCESS_INTERACTIVE_PHASES: ReadonlySet<AutoParkingPhase> = new Set<AutoParkingPhase>([
  'access',
  'access-edit',
]);
/** Phases where the building entrance is being placed/edited on the map. */
export const ENTRANCE_INTERACTIVE_PHASES: ReadonlySet<AutoParkingPhase> = new Set<AutoParkingPhase>([
  'entrance',
  'entrance-edit',
]);
/** Phases with a live candidate on screen that direct on-map edits should re-fit rather than invalidate. */
export const LIVE_REFIT_PHASES: ReadonlySet<AutoParkingPhase> = new Set<AutoParkingPhase>(['compare', 'editing']);
