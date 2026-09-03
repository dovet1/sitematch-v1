# Auto Parking — Integration Plan (v2)

Status: awaiting approval to start Phase 0.
Checkpoint (revert point): `cf4bca6` — handoff docs + solver deps. Design-sync tooling split to `251a96d`.

This plan supersedes the conversational plan. It folds in the Codex review corrections
(target unified shell; explicit interaction state machine; mandatory detection; worker
reconciliation; transient-vs-persisted split; full save/API lifecycle) and drops draft mode.

---

## 1. Surface (the one correction that changes everything)

Build **only** in the SiteMatcher unified workspace `apps/web/src/app/sitematcher-unified/`.
`/sitesketcher-v2` redirects to `/sitesketcher` (`next.config.js:47`) and its shell is dead UI —
we do **not** modify `ParkingToolPanel` / `MapCanvas` / `RightInspector`.

The unified workspace **reuses the shared layer** (`@/lib/sitesketcher-v2/*`,
`@/types/sitesketcher-v2`, `api/sitesketcher-v2/sketches`) but has its **own shell**:

| Concern | File |
|---|---|
| Tool panel (inline `ParkingPanel`) | `components/shell/USketchPanel.tsx` |
| Map interactions + GL layers | `components/map/SketchLayer.tsx` |
| Right inspector | `components/shell/USketchInspector.tsx` |
| Keyboard delete / selection | `components/UnifiedWorkspace.tsx` |

Shared components may later be mounted in the standalone shell only if that route is un-redirected.

## 2. Locked decisions

- **Plus-only**, enforced **server-side** (POST/PUT), not just a client modal.
- **Detection is always mandatory** — every intersecting polygon/CAD is a building exclusion.
  Review UI highlights them; there is **no untick**, and **no `included` field**.
- **No draft mode.** Full solves only, triggered by the explicit "Create layouts" action.
- **Worker:** `solve` + `terminate`, plus one **additive** opt-out flag (`mainThreadFallback: false`,
  default stays `true` so the standalone lab is unaffected). Cancel = `terminate()` then lazy-recreate
  on next solve. Progress is **indeterminate** (no fake per-step checklist). **No main-thread
  fallback in the integrated feature** — see §6a.
- "Best yield" chip → **"Recommended"**. Candidate cards surface **real** solver warnings
  (`partial-connectivity`, manoeuvring shortfall) — the handoff's "bays inside building clearance"
  is not a real solver output (clearance is a placement constraint).
- Standalone `/parking-layout-lab` sandbox stays as-is for now (retire later).

## 3. State: transient vs. persisted

### 3a. Persisted

**`parkingMethod`** — persisted per sketch in `SketchData.settings.parkingMethod` (`'manual' | 'auto'`,
default `'manual'`). The handoff says the method is remembered per sketch, so this is a deliberate
persist (not transient). On `reset` it returns to `'manual'`; on `loadSketch` it reads the stored
value (defaulting to `'manual'` when absent).

**`AutoParkingLayout[]`** — `SketchData.autoLayouts?: AutoParkingLayout[]` (optional in the interface).
**Normalisation to `[]` happens LAST, after entitlement + preserve-on-omit** (see §6c) — never during
raw PUT parsing, or the omitted-vs-`[]` distinction is destroyed. Client `loadSketch` normalises to
`[]` on read. Only applied layouts and their regeneration inputs are persisted:

```ts
interface AutoParkingLayout {
  id: string;
  name: string;                         // "Auto layout 1"
  geometrySchemaVersion: 1;             // bump to migrate rendering without re-solving
  // regeneration inputs / provenance
  boundaryId: string;                   // source polygon id
  exclusionRefs: { id: string; kind: 'polygon' | 'cadInstance' | 'cadImage' }[];
  accessPoint: [number, number];        // snapped lng/lat
  settingsSnapshot: {
    stallSize: 'standard' | 'larger';
    aisleWidth: number;
    boundarySetback: number;
    buildingClearance: number;          // solver exclusionClearance
    checkManoeuvring: boolean;
    oneWay: boolean;                    // omitted from SolverInput unless checkManoeuvring
    gateQueueVehicles: number | null;   // UI: integer stepper "Gate queue (vehicles)"; maps to
                                        // solver GateQueueConfig.vehicles. Omitted from SolverInput
                                        // unless checkManoeuvring.
    accessibleBays: { on: boolean; percent: number };
  };
  // chosen result — LAYOUT FEATURES ONLY (see below), lng/lat
  geometry: GeoJSON.FeatureCollection;
  metrics: { totalSpaces: number; standard: number; accessible: number; rows: number; footprintSqm: number };
  warnings: { code: string; message: string }[];
  // integrity — canonical hash of: boundary ring + CURRENT mandatory exclusion set derived from it
  // + snapped accessPoint + settingsSnapshot. accessPoint is included because it is a solver input.
  sourceHash: string;
  createdAt: number;
  updatedAt: number;
}
```

**No persisted `stale` flag.** Staleness is **derived at runtime** from `sourceHash` (see 3c) so the
two can never disagree.

**Persisted geometry is layout-only.** `candidateToGeoJSON` emits the whole scene (site-boundary,
usable-boundary, exclusion, exclusion-clearance, visibility-keepout, access-point + stalls/aisles/
corridor). Persisting/rendering all of it would duplicate the existing plot and building layers, so a
**filtering step** keeps only layout features (`stall`, `aisle`, `access-corridor`, and the
`access-point` marker). Every retained feature carries an **`autoLayoutId`**, and row/aisle ids are
**namespaced by layout id** so multiple applied layouts cannot collide.

### 3b. Transient

Serializable workflow state lives in a Zustand `AutoParkingDraft` — the working inputs the panel edits
before a layout is applied:

```ts
interface AutoParkingDraft {
  boundaryId: string | null;
  accessPoint: [number, number] | null;
  settings: AutoParkingLayout['settingsSnapshot'];
  step: 'setup' | 'access' | 'generating' | 'candidates';
}
```

"Adjust settings" / "Edit layout settings" mutate the **draft**, never an applied layout — the applied
layout only changes when a regeneration is accepted. Also transient (Zustand): generation status
(`idle|running|failed`), `candidates[]`, `selectedCandidateId`, detected-exclusion review/highlight
state, transient banner-dismissal. Detected exclusions are **derived** from geometry every time —
never persisted.

**The worker is NOT in Zustand.** A controller (custom hook / component owning refs) owns the worker;
Zustand holds only serializable workflow state. See §6a.

### 3c. Derived staleness

`isStale` is computed, never stored: hash the layout's **current** inputs (its boundary polygon + the
mandatory-exclusion set **re-derived now** from that boundary + snapped `accessPoint` + `settingsSnapshot`)
and compare to `sourceHash`. Only **boundary changes** or changes to the **derived intersecting-exclusion set** make a
layout stale (move/rotate/resize/delete of the boundary or an *intersecting* polygon/CAD, or a new
intersection). **Unrelated geometry that stays outside the boundary never marks a layout stale.** Only
regeneration makes a stale layout current again. If the user dismisses the amber banner, that dismissal
is **transient** and does **not** remove the amber list dot or restore full map opacity.

## 4. Detection spec (pure, mandatory)

Real polygon **intersection**, not point-in-polygon. For the selected boundary, an object becomes an
exclusion if it is fully contained, partially crossing, or edge-touching. Covers:
- other `polygons` (excluding the selected boundary itself),
- current `cadInstances` (rotated → compute the CAD quadrilateral corners via `cad-utils`),
- legacy placed `cadImages` (anchored),
- rotated CAD quads and partially-crossing geometry.

Runs on entering Auto and on any geometry change. Output feeds the solver as `exclusions[]`; the
boundary polygon is never in that set.

## 5. Interaction state machine (`SketchLayer`)

Replaces "existing handlers untouched". Map-click priority while Parking tool is active:

```
Manual method            → place a manual ParkingBlock (unchanged path)
Auto + placing-access    → snap access point to nearest boundary edge (no block)
Auto + not placing       → no manual block is created
```

Also specified: access-point **hover** thickens nearest boundary edge; **click** snaps; **drag**
moves along the edge; **Esc** cancels placement; **map pan** unaffected; **polygon drawing** keeps
Auto armed and returns to it on plot close; **candidate previews are non-interactive**; only
**applied layouts** are click-selectable; **map-style reload** re-adds auto GL layers; **Sketch-mode
detach** removes them.

## 6. Save / API lifecycle (all required)

### 6a. Worker controller

A hook/controller (not Zustand) owns the worker via refs and must handle:
- **Cancel** → `terminate()` then lazy-recreate on the next solve.
- **Unmount** → `terminate()`.
- Clearing previews and returning the draft to the correct `step`.
- A subsequent generation after a cancel.
- **No main-thread fallback.** The lab's `workerClient` otherwise runs `solveParkingLayout`
  *synchronously* on the main thread when the Worker is unavailable/errors — which for a ~20s solve
  would freeze pan **and** make Cancel unprocessable, breaking the non-blocking + Cancel guarantees.
  The integrated feature constructs the client with `mainThreadFallback: false`, so worker
  unavailability/error surfaces as a genuine generation **`failed`** (honest, responsive), not a silent
  blocking solve. (The standalone lab keeps the default fallback.)

### 6b. Store + shell

`reset`, `loadSketch`, `getSketchData` include `autoLayouts` (normalised to `[]`); history snapshots +
selection reconciliation handle `autoParking` selections; object-count + sketch summary include applied
layouts; keyboard delete (`UnifiedWorkspace`) handles the new selection type; CSV/PDF exports describe
applied layouts; the saved-sketch launcher count (`USketchLauncher`) includes them.

### 6c. API entitlement matrix

**PUT handler sequence (order matters — preserve BEFORE normalise):**
1. Record `hadField = Object.hasOwn(body.data, 'autoLayouts')` on the raw payload.
2. Apply the entitlement + preserve-on-omit rules below (using `hadField`).
3. **Only then** normalise the resulting `data.autoLayouts` to `[]` if still absent.

Doing this in the wrong order (normalise first) makes "field omitted → preserve" and "explicit `[]` →
delete" indistinguishable and can silently delete a user's layouts.

Ambiguity fix: current clients routinely send `autoLayouts: []`, so *presence* can't be the gate —
**non-empty, non-Plus** is. Enforced in `validation.ts` (`validateSketchData`) + the route handlers:

| Request | Behaviour |
|---|---|
| Plus POST | accept valid empty or non-empty |
| Non-Plus POST | accept empty; **reject non-empty** |
| Plus PUT, field omitted | **preserve** existing |
| Plus PUT, `[]` | intentionally **delete all** |
| Non-Plus PUT, omitted or `[]` | **preserve** hidden existing layouts |
| Non-Plus PUT, non-empty / modified | **reject** |

**Downgrade sanitisation on BOTH GET paths.** The single-sketch GET and the **list GET** (currently
returns `.select('*')` unsanitised, `sketches/route.ts`) must strip `autoLayouts` from responses for a
non-Plus viewer — while the stored rows keep them for re-upgrade (preserve, don't destroy).

**Payload limits.** `validateSketchData` rejects persisted `autoLayouts` whose geometry exceeds bounds
(max feature count and max total coordinate count per layout, plus a cap on layouts per sketch) so a
crafted or runaway payload can't bloat the JSONB.

## 7. File scope

Unified UI: `USketchPanel.tsx`, `SketchLayer.tsx`, `USketchInspector.tsx`, `UnifiedWorkspace.tsx`,
`USketchLauncher.tsx` (saved-sketch count).
Shared: `types/sitesketcher-v2.ts`, `lib/sitesketcher-v2/{state-manager,mapbox-integration,object-count,export-utils,validation}.ts`.
New pure adapter `lib/sitesketcher-v2/auto-parking/{detection,adapter,hash,geojson}.ts` (imports the
pure `lib/parking-layout-lab` solver + `workerClient`; no lib→app back-imports). Worker controller hook
alongside the unified shell.
API: `api/sitesketcher-v2/sketches/route.ts` (POST + list GET) + `[id]/route.ts` (single GET + PUT).

## 8. Phases

The Auto UI is behind a feature flag **`autoParkingEnabled` (default: off)** from Phase 2 until the full
vertical flow (through apply + persistence) works, so phases can merge independently without exposing a
half-wired tool. Flipped on in Phase 5.

0. Define `AutoParkingLayout` + `AutoParkingDraft` contracts; transient/persisted split; confirm surface. (no UI)
1. Pure adapters + tests: boundary selection, mandatory intersection detection, CAD-quad conversion,
   `SolverInput` build, canonical hash, layout-feature filter/namespacing. (no UI)
2. Manual/Auto method control in `ParkingPanel` + `SketchLayer` access-placement state machine. (flagged)
3. Worker controller (full solves, indeterminate progress, cancel = terminate/recreate, fallback≠fail)
   + non-interactive candidate preview layers.
4. Apply + full persistence **incl. server-side entitlement matrix**: store/API (matrix + preserve-on-omit
   + list/single GET sanitisation)/history/selection/inspector/layers/delete/object-count/launcher/export.
5. Derived staleness + style-reload restore + edge states + E2E regression; unflag.

## 9. Testing

Solver suite untouched (already green). New:
- adapter / detection / hash / feature-filter unit tests;
- store-slice tests (apply, serialize round-trip, selection reconcile, `parkingMethod` reset/load);
- **API permission matrix** (non-Plus/Plus POST + PUT rows above; **preserve-before-normalise** so an
  omitted field never deletes; list + single GET sanitisation; GeoJSON feature/coordinate-count limits);
- **worker controller** (cancel, retry-after-cancel; worker-unavailable → `failed`, no main-thread block);
- map-style reload + Sketch-mode teardown;
- **multiple applied layouts** + per-feature selection (no id collision);
- **manual parking regression** (unchanged click-to-place path);
- **staleness** from new / moved / deleted *intersecting* exclusion; **no false staleness** from
  unrelated outside geometry;
- **load of an old sketch without `autoLayouts`** (normalises to `[]`, no crash);
- **one full happy-path integration test:** enter Auto → select boundary → place access → generate →
  select candidate → apply → save → reload (layout survives, metrics + geometry intact).

## 10. Housekeeping

`tsconfig.tsbuildinfo` is a build artifact currently tracked in the repo; it rode into `cf4bca6` as
churn. Optional follow-up: `git rm --cached` it and add to `.gitignore` so it stops appearing in
diffs. Left as-is unless requested.
