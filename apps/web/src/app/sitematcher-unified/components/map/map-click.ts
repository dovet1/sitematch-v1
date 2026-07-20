import type { WorkspaceMode, InspectorTab } from '../../types/unified-workspace'

// Pure decision logic for the map's global click handler. UnifiedMap owns the
// mapbox calls — it runs the queryRenderedFeatures hit tests, passes the results
// here as a plain record, then executes whatever action comes back. Only the
// branch *ordering* lives in this module, which keeps it testable without a
// mapbox-gl instance (the suite has no mock for one).

export interface MapClickState {
  view: WorkspaceMode
  tab: InspectorTab
  compareArm: boolean
  comparePair: unknown | null
  overlays: { roadTraffic: boolean; requirements: boolean }
}

// Already-resolved hit tests. Absent/undefined means "no feature hit" — either
// nothing was under the cursor or the layer wasn't queried because it's hidden
// or missing mid-style-teardown.
export interface MapClickHits {
  lsoa?: string
  planning?: string
  road?: Record<string, unknown>
  bua?: {
    gsscode: string
    name?: string
    population?: number
  }
  requirement?: string
}

export type MapClickAction =
  // Another handler owns this click — do nothing here. Distinct from 'ignore':
  // an LSOA hit is consumed because the per-layer lsoaClick handler performs
  // the toggle, and running a toggle here too would double-fire and net to no
  // visible change.
  | { kind: 'consume' }
  | { kind: 'open-planning-modal'; name: string }
  | { kind: 'open-road-popup'; props: Record<string, unknown> }
  | { kind: 'select-bua'; bua: NonNullable<MapClickHits['bua']> }
  | { kind: 'open-requirement-modal'; requirementId: string }
  | { kind: 'drop-compare-point' }
  | { kind: 'drop-assess-point' }
  // Genuinely nothing to do.
  | { kind: 'ignore' }

export function decideMapClick(
  st: MapClickState,
  hits: MapClickHits
): MapClickAction {
  // The Catchment and Planning tabs get first refusal on a click, but only when
  // it actually lands on one of their own features. A miss falls through to the
  // Assess pin-drop path below so the pin stays repositionable from either tab.
  if (st.tab === 'catchment' && hits.lsoa) return { kind: 'consume' }
  if (st.tab === 'planning' && hits.planning) {
    return { kind: 'open-planning-modal', name: hits.planning }
  }

  // Road-shading popup, consumed before the Find and Assess paths so clicking a
  // road never relocates the dropped pin. Skipped on Catchment and Planning:
  // the road layer is visible on every non-sketch tab, so without this the
  // fallthrough added above would let a road steal the very clicks that are
  // meant to move the pin. Keeping it out preserves today's behaviour there
  // exactly, since the old early-returns made road clicks unreachable anyway.
  if (
    st.view !== 'sketch' &&
    st.tab !== 'catchment' &&
    st.tab !== 'planning' &&
    st.overlays.roadTraffic &&
    hits.road
  ) {
    return { kind: 'open-road-popup', props: hits.road }
  }

  if (st.view === 'find') {
    return hits.bua ? { kind: 'select-bua', bua: hits.bua } : { kind: 'ignore' }
  }

  if (st.view === 'assess') {
    // Compare flow: armed → this click drops pin B; already paired → ignore
    // (block relocating pin A until the comparison is cleared).
    if (st.compareArm) return { kind: 'drop-compare-point' }
    if (st.comparePair) return { kind: 'ignore' }
    // Clicking a requirement pin opens its modal instead of moving the pin.
    if (st.overlays.requirements && hits.requirement) {
      return { kind: 'open-requirement-modal', requirementId: hits.requirement }
    }
    return { kind: 'drop-assess-point' }
  }

  return { kind: 'ignore' }
}
