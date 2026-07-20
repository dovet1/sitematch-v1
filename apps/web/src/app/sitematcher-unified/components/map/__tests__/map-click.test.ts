import {
  decideMapClick,
  type MapClickState,
  type MapClickHits,
} from '../map-click'

function state(over: Partial<MapClickState> = {}): MapClickState {
  return {
    view: 'assess',
    tab: 'missing',
    compareArm: false,
    comparePair: null,
    overlays: { roadTraffic: false, requirements: false },
    ...over,
  }
}

const BUA: NonNullable<MapClickHits['bua']> = {
  gsscode: 'E63001',
  name: 'Harrogate',
  population: 75000,
}

const ROAD = { road_number: 'A61', aadt: 12000 }

describe('decideMapClick', () => {
  describe('catchment tab', () => {
    it('consumes an LSOA cell hit rather than toggling it', () => {
      // The per-layer lsoaClick handler owns the toggle. Returning a toggle
      // action here as well would double-fire and net to no visible change.
      expect(
        decideMapClick(state({ tab: 'catchment' }), { lsoa: 'E01027000' })
      ).toEqual({ kind: 'consume' })
    })

    it('drops the assess point when the click misses every cell', () => {
      expect(decideMapClick(state({ tab: 'catchment' }), {})).toEqual({
        kind: 'drop-assess-point',
      })
    })

    it('drops the assess point when the cells are hidden (showLsoa off)', () => {
      // Hidden layers yield no features, so showLsoa-off reads as a plain miss.
      expect(decideMapClick(state({ tab: 'catchment' }), {})).toEqual({
        kind: 'drop-assess-point',
      })
    })
  })

  describe('planning tab', () => {
    it('opens the modal for a planning pin hit', () => {
      expect(
        decideMapClick(state({ tab: 'planning' }), { planning: 'APP/2026/001' })
      ).toEqual({ kind: 'open-planning-modal', name: 'APP/2026/001' })
    })

    it('drops the assess point when the click misses every pin', () => {
      expect(decideMapClick(state({ tab: 'planning' }), {})).toEqual({
        kind: 'drop-assess-point',
      })
    })
  })

  describe('road traffic overlay', () => {
    const roadOn = { roadTraffic: true, requirements: false }

    it('opens the popup on a Missing/Present tab, outranking the pin drop', () => {
      expect(
        decideMapClick(state({ tab: 'missing', overlays: roadOn }), {
          road: ROAD,
        })
      ).toEqual({ kind: 'open-road-popup', props: ROAD })
    })

    it('outranks BUA selection in find view', () => {
      expect(
        decideMapClick(
          state({ view: 'find', tab: 'missing', overlays: roadOn }),
          { road: ROAD, bua: BUA }
        )
      ).toEqual({ kind: 'open-road-popup', props: ROAD })
    })

    it('does not steal a Catchment-tab click that missed the cells', () => {
      // Roads render on every non-sketch tab, so without the tab exclusion a
      // road under the cursor would defeat the whole fix on this tab.
      expect(
        decideMapClick(state({ tab: 'catchment', overlays: roadOn }), {
          road: ROAD,
        })
      ).toEqual({ kind: 'drop-assess-point' })
    })

    it('does not steal a Planning-tab click that missed the pins', () => {
      expect(
        decideMapClick(state({ tab: 'planning', overlays: roadOn }), {
          road: ROAD,
        })
      ).toEqual({ kind: 'drop-assess-point' })
    })

    it('is inert when the overlay is off', () => {
      expect(decideMapClick(state(), { road: ROAD })).toEqual({
        kind: 'drop-assess-point',
      })
    })
  })

  describe('compare flow', () => {
    it('drops pin B when armed', () => {
      expect(decideMapClick(state({ compareArm: true }), {})).toEqual({
        kind: 'drop-compare-point',
      })
    })

    it('loses to a Catchment LSOA hit', () => {
      expect(
        decideMapClick(state({ tab: 'catchment', compareArm: true }), {
          lsoa: 'E01027000',
        })
      ).toEqual({ kind: 'consume' })
    })

    it('loses to a Planning pin hit', () => {
      expect(
        decideMapClick(state({ tab: 'planning', compareArm: true }), {
          planning: 'APP/2026/001',
        })
      ).toEqual({ kind: 'open-planning-modal', name: 'APP/2026/001' })
    })

    it('wins on a Catchment-tab miss', () => {
      expect(
        decideMapClick(state({ tab: 'catchment', compareArm: true }), {})
      ).toEqual({ kind: 'drop-compare-point' })
    })

    it('wins on a Planning-tab miss', () => {
      expect(
        decideMapClick(state({ tab: 'planning', compareArm: true }), {})
      ).toEqual({ kind: 'drop-compare-point' })
    })

    it('outranks a requirement pin hit', () => {
      expect(
        decideMapClick(
          state({
            compareArm: true,
            overlays: { roadTraffic: false, requirements: true },
          }),
          { requirement: 'req-1' }
        )
      ).toEqual({ kind: 'drop-compare-point' })
    })

    it('ignores clicks once a pair exists', () => {
      expect(decideMapClick(state({ comparePair: {} }), {})).toEqual({
        kind: 'ignore',
      })
    })

    it('still resolves tab feature hits while a pair exists', () => {
      expect(
        decideMapClick(state({ tab: 'catchment', comparePair: {} }), {
          lsoa: 'E01027000',
        })
      ).toEqual({ kind: 'consume' })
      expect(
        decideMapClick(state({ tab: 'planning', comparePair: {} }), {
          planning: 'APP/2026/001',
        })
      ).toEqual({ kind: 'open-planning-modal', name: 'APP/2026/001' })
    })
  })

  describe('requirement pins', () => {
    const reqOn = { roadTraffic: false, requirements: true }

    it('opens the modal for a pin hit', () => {
      expect(
        decideMapClick(state({ overlays: reqOn }), { requirement: 'req-1' })
      ).toEqual({ kind: 'open-requirement-modal', requirementId: 'req-1' })
    })

    it('drops the pin when the overlay is off', () => {
      expect(decideMapClick(state(), { requirement: 'req-1' })).toEqual({
        kind: 'drop-assess-point',
      })
    })
  })

  describe('other views', () => {
    it('selects a BUA in find view', () => {
      expect(decideMapClick(state({ view: 'find' }), { bua: BUA })).toEqual({
        kind: 'select-bua',
        bua: BUA,
      })
    })

    it('ignores a find-view click that hit no BUA', () => {
      expect(decideMapClick(state({ view: 'find' }), {})).toEqual({
        kind: 'ignore',
      })
    })

    it('ignores clicks in sketch view', () => {
      expect(
        decideMapClick(state({ view: 'sketch', tab: 'sketch' }), { bua: BUA })
      ).toEqual({ kind: 'ignore' })
    })
  })

  it('moves an existing assess point on a plain click', () => {
    // The pin is repositionable; nothing guards on an already-dropped point.
    expect(decideMapClick(state(), {})).toEqual({ kind: 'drop-assess-point' })
  })
})
