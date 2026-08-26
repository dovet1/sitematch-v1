/**
 * Parking Layout Lab — solver type definitions.
 *
 * This module is part of an ISOLATED experiment. It is intentionally decoupled
 * from SiteSketcher, the unified workspace, and all map/React/Zustand code.
 *
 * All geometry that crosses the solver boundary is expressed as GeoJSON-style
 * [longitude, latitude] rings so the module can be driven from a map adapter or
 * from plain fixtures in tests. Internally the solver works in a local metre
 * coordinate system (see ./geo).
 *
 * IMPORTANT: The output is a CONCEPTUAL feasibility / yield estimate. It does
 * not test planning compliance, accessibility, vehicle tracking, gradients,
 * drainage or detailed highway design.
 */

/** A single [longitude, latitude] position. */
export type LngLat = [number, number];

/** A closed ring of [lng, lat] positions (first/last may or may not coincide). */
export type Ring = LngLat[];

/**
 * A polygon expressed as an outer ring only. The Lab MVP does not model holes;
 * buildings are supplied separately as exclusion polygons.
 */
export type PolygonInput = {
  ring: Ring;
};

/** Stall footprint dimensions in metres. */
export type StallDimensions = {
  /** Width across the stall opening, metres (e.g. 2.4). */
  width: number;
  /** Depth of the stall from the aisle, metres (e.g. 4.8). */
  length: number;
};

/** Everything the solver needs to produce candidate layouts. */
export type SolverInput = {
  /** The site boundary. Exactly one polygon. */
  boundary: PolygonInput;
  /** Zero or more building / keep-out polygons. */
  exclusions: PolygonInput[];
  /** Where vehicles enter the site. Snapped to the nearest boundary edge. */
  accessPoint: LngLat;
  /** Standard stall footprint. */
  stall: StallDimensions;
  /** Drive-aisle width between/next to rows, metres. */
  aisleWidth: number;
  /** Inset applied to the whole site boundary, metres. */
  boundarySetback: number;
  /** Buffer grown around every exclusion polygon, metres. */
  exclusionClearance: number;
  /**
   * Optional deterministic tuning. Absence of a field means "use the default".
   * Included so the UI can expose the standard vs larger stall toggle without a
   * bespoke input shape.
   */
  options?: SolverOptions;

  // --- M2, all optional / off by default ---
  /** Enables manoeuvring validation (approachability, dead-end turning bays, gate queue) when set. */
  vehicle?: Vehicle;
  /** Enables directed (one-way loop) circulation checking when true. Requires `vehicle`. */
  oneWay?: boolean;
  /** Reserves queuing throat length at the entrance when set. Requires `vehicle`. */
  gateQueue?: GateQueueConfig | null;
  /** Extra keep-out areas near junctions/entrances (sight lines) — blocking, like exclusions, but not rendered as buildings. */
  visibilityKeepouts?: PolygonInput[];
  /** Enables accessible-bay designation when set. */
  accessible?: AccessiblePolicy;

  // --- Draft mode: cheap during-drag preview, never authoritative ---
  /**
   * When true, the solver cuts base layout work for a fast during-drag
   * preview: only ~1-2 orientations are generated (see `draftOrientationDeg`)
   * and `ensureConnectivity`'s connector search is skipped. Collision,
   * exclusion, setback and basic stall placement are unaffected. Callers
   * should also omit the M2 fields above for a draft request — their
   * absence already reproduces M1 behaviour, which is the cheapest path.
   */
  draft?: boolean;
  /**
   * Draft-only hint: prefer generating the orientation nearest this angle
   * (degrees) instead of the full orientation sweep — keeps the preview on
   * the same row orientation the user currently has selected. Ignored when
   * `draft` is not set. Falls back to the first 1-2 orientations when
   * omitted or when no orientation is close enough.
   */
  draftOrientationDeg?: number;
};

export type SolverOptions = {
  /** Width of the reserved straight access corridor, metres. Defaults to aisleWidth. */
  accessCorridorWidth?: number;
  /** Maximum candidates to return (hard-capped internally). */
  maxCandidates?: number;
};

// ---------------------------------------------------------------------------
// M2 — manoeuvring + accessible bays.
// All of the fields below are OPTIONAL and OFF by default: omitting them
// reproduces exactly the M1 geometry (no behaviour change for callers that
// don't opt in).
// ---------------------------------------------------------------------------

/** A simplified vehicle envelope used for manoeuvring checks. Not a swept-path/AutoTURN model. */
export type Vehicle = {
  /** Turning radius, metres (typically ~5.5–6.5 for a passenger car). */
  turningRadius: number;
  /** Vehicle body width including mirrors, metres. */
  sweptWidth: number;
  /** Vehicle length, metres. */
  length: number;
};

export type GateQueueConfig = {
  /** Vehicles to reserve queuing space for at the entrance. */
  vehicles: number;
};

export type AccessibleBayConfig = {
  width: number;
  length: number;
  /** Shared side/rear access zone width, metres — informs bay placement, not modelled as separate geometry. */
  sharedAccessWidth: number;
};

export type AccessiblePolicy = {
  /** Fraction (0–1) of total stalls that should be accessible. */
  rate: number;
  bay: AccessibleBayConfig;
};

/** Orientation of a parking module, as a bearing in degrees within the local frame. */
export type Orientation = {
  /** Direction a row runs (the axis stalls are laid along), degrees [0,180). */
  rowAngleDeg: number;
  /** Human label, e.g. "aligned to longest edge". */
  label: string;
};

/** A single parking stall, returned in BOTH local metres and lng/lat. */
export type Stall = {
  index: number;
  /** Stall corners in local metre coordinates (closed ring, 5 points). */
  cornersLocal: [number, number][];
  /** Stall corners in [lng, lat] (closed ring, 5 points). */
  corners: LngLat[];
  /** Centroid in [lng, lat]. */
  center: LngLat;
  /** True for a wider/deeper accessible bay. Always false/undefined until M2. */
  accessible?: boolean;
};

/** A contiguous run of stalls sharing an edge and one serving aisle. */
export type ParkingRow = {
  rowId: string;
  /** This row's own angle — perimeter rows differ per edge, so this is NOT the candidate-wide angle. */
  orientation: Orientation;
  /** Whether this row is one side of a double-loaded module or a lone single row. */
  loading: 'double' | 'single';
  /** Whether the row hugs the site perimeter or fills reclaimed interior space. */
  placement: 'perimeter' | 'interior';
  /** The aisle (by id) this row's stalls open onto. */
  aisleId: string;
  stalls: Stall[];
};

/** A reserved circulation lane. Turning areas are aisles too — there is no parallel collection. */
export type DriveAisle = {
  aisleId: string;
  role: 'perimeter' | 'interior' | 'spine' | 'turning';
  ring: Ring;
  /** Populated once M2 introduces directed one-way circulation. */
  travelDir?: 'oneway' | 'twoway';
};

/** How consistent row orientation is across a candidate — an exact, inspectable summary. */
export type OrientationSummary =
  | { kind: 'uniform'; angleDeg: number }
  | { kind: 'mixed'; edgeAnglesDeg: number[] }
  | { kind: 'perimeter-only'; edgeAnglesDeg: number[] };

/** Human-readable reason an area could not be used or a caveat about the result. */
export type SolverWarning = {
  code: string;
  message: string;
};

/** One complete candidate layout. */
export type CandidateLayout = {
  candidateId: string;
  /** Precise summary of row orientation(s) in this candidate. */
  orientationSummary: OrientationSummary;
  rows: ParkingRow[];
  /** Total individual stalls across all rows. */
  stallCount: number;
  /** The reserved straight access corridor, [lng, lat] ring (may be null if none reserved). */
  accessCorridor: PolygonInput | null;
  /** Reserved circulation lanes (perimeter row aisles, interior row aisles, and the entrance spine). */
  driveAisles: DriveAisle[];
  /** Estimated parking footprint (stalls + aisles) in square metres. */
  parkingFootprintSqm: number;
  /** Deterministic score; higher is better. */
  score: number;
  warnings: SolverWarning[];
};

/** Full solver result. */
export type SolverOutput = {
  /** The snapped access point actually used, [lng, lat]. */
  snappedAccessPoint: LngLat;
  /** The inset (usable) boundary, [lng, lat] ring. Null if setback consumed the site. */
  usableBoundary: PolygonInput | null;
  /** The expanded exclusions actually used, [lng, lat] rings. */
  expandedExclusions: PolygonInput[];
  /** Up to N meaningfully different candidates, best first. */
  candidates: CandidateLayout[];
  /** Warnings that apply to the whole run (bad input, nothing fit, etc.). */
  warnings: SolverWarning[];
};
