// Shared types for the unified workspace. Shapes follow the design handoff
// state contract in /docs/design_handoff_unified_workspace/README.md.

export type WorkspaceMode = 'assess' | 'find' | 'sketch'

export type InspectorTab = 'summary' | 'catchment' | 'sketch'

export type MapScale = 'national' | 'local'

export type CatchmentMode = 'distance' | 'drive' | 'walk'

// A selected opportunity: a built-up area or a dropped point.
export interface WorkspaceArea {
  id: string
  name: string
  region?: string
  center: [number, number]
  population?: number
}

// Map sub-selection (a store dot, etc.). Requirements are deferred in v1.
export interface MapSubSelection {
  type: 'store'
  id: string
}

// Presence/proximity gap rule (mirrors GapFinder's filter rule shape).
export interface GapRule {
  id: string
  kind: 'presence' | 'proximity'
  type: 'category' | 'brand' | 'fascia'
  value: string
  op: string
  km?: number
}

export interface CatchmentDefinition {
  mode: CatchmentMode
  value: number
}

export interface WorkspaceOverlays {
  // Requirements overlay is deferred in v1.
  traffic: boolean
}
