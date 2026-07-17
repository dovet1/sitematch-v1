import { useWorkspaceStore } from '../unified-workspace-store'
import type { CatchmentDefinition } from '../../../types/unified-workspace'

const store = useWorkspaceStore

// A fresh single Assess pin with the given global catchment.
function seedAssessPoint(catchment: CatchmentDefinition) {
  store.setState({
    view: 'assess',
    assessPoint: { lat: 51.5, lng: -0.12 },
    catchment,
    comparePair: null,
    compareArm: false,
    activeCompareArm: 'a',
    pointCompareOpen: false,
  })
}

describe('unified-workspace-store — per-arm compare catchment', () => {
  describe('dropComparePoint', () => {
    it('seeds both arms from the global catchment and activates B without opening the modal', () => {
      const global: CatchmentDefinition = { mode: 'distance', value: 5 }
      seedAssessPoint(global)

      store.getState().dropComparePoint({ lat: 52.2, lng: -1.0 })

      const s = store.getState()
      expect(s.comparePair).not.toBeNull()
      expect(s.comparePair!.a).toEqual({ lat: 51.5, lng: -0.12, catchment: global })
      expect(s.comparePair!.b).toEqual({ lat: 52.2, lng: -1.0, catchment: global })
      expect(s.activeCompareArm).toBe('b')
      expect(s.compareArm).toBe(false)
      expect(s.pointCompareOpen).toBe(false)
    })

    it('is a no-op when there is no assess pin', () => {
      store.setState({ assessPoint: null, comparePair: null })
      store.getState().dropComparePoint({ lat: 52.2, lng: -1.0 })
      expect(store.getState().comparePair).toBeNull()
    })
  })

  describe('setComparePointCatchment', () => {
    it('updates only the targeted arm', () => {
      const global: CatchmentDefinition = { mode: 'distance', value: 5 }
      seedAssessPoint(global)
      store.getState().dropComparePoint({ lat: 52.2, lng: -1.0 })

      const bCatchment: CatchmentDefinition = { mode: 'drive', value: 10 }
      store.getState().setComparePointCatchment('b', bCatchment)

      const s = store.getState()
      expect(s.comparePair!.b.catchment).toEqual(bCatchment)
      // A is untouched.
      expect(s.comparePair!.a.catchment).toEqual(global)
    })
  })

  describe('clearPointCompare', () => {
    it('restores the global catchment from pin A, never pin B', () => {
      const aCatchment: CatchmentDefinition = { mode: 'distance', value: 5 }
      seedAssessPoint(aCatchment)
      store.getState().dropComparePoint({ lat: 52.2, lng: -1.0 })
      // Diverge the two arms.
      store.getState().setComparePointCatchment('b', { mode: 'walk', value: 15 })

      store.getState().clearPointCompare()

      const s = store.getState()
      expect(s.comparePair).toBeNull()
      expect(s.activeCompareArm).toBe('a')
      expect(s.compareArm).toBe(false)
      expect(s.pointCompareOpen).toBe(false)
      expect(s.catchment).toEqual(aCatchment)
    })
  })

  describe('setActiveCompareArm', () => {
    it('selects the arm the catchment control edits', () => {
      seedAssessPoint({ mode: 'distance', value: 5 })
      store.getState().dropComparePoint({ lat: 52.2, lng: -1.0 })
      store.getState().setActiveCompareArm('a')
      expect(store.getState().activeCompareArm).toBe('a')
    })
  })
})
