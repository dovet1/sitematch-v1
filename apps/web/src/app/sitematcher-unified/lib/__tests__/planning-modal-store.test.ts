import { useWorkspaceStore } from '../stores/unified-workspace-store'
import type { PlanningApplication } from '../../types/unified-workspace'

const app: PlanningApplication = {
  name: 'Leeds/26/1/FU',
  uid: '26/1/FU',
  address: '1 High St',
  appSize: 'Large',
  appState: 'Permitted',
  appType: 'Full',
  description: '',
  url: '',
  lat: 53.8,
  lng: -1.55,
  decidedDate: null,
  dateValidated: null,
  nDwellings: null,
  applicantAddress: null,
  agentAddress: null,
}

// Zustand store is a module-level singleton; restore a clean slate per test.
const initial = useWorkspaceStore.getState()
beforeEach(() => {
  useWorkspaceStore.setState(initial, true)
})

describe('planningModal store state', () => {
  it('is set by setPlanningModal', () => {
    useWorkspaceStore.getState().setPlanningModal(app)
    expect(useWorkspaceStore.getState().planningModal).toBe(app)
    useWorkspaceStore.getState().setPlanningModal(null)
    expect(useWorkspaceStore.getState().planningModal).toBeNull()
  })

  it('is cleared by setMode', () => {
    useWorkspaceStore.getState().setPlanningModal(app)
    useWorkspaceStore.getState().setMode('find')
    expect(useWorkspaceStore.getState().planningModal).toBeNull()
  })

  it('is cleared by selectArea', () => {
    useWorkspaceStore.getState().setPlanningModal(app)
    useWorkspaceStore.getState().selectArea({
      id: 'E63000001',
      name: 'Testtown',
      center: [-1.55, 53.8],
      kind: 'bua',
    })
    expect(useWorkspaceStore.getState().planningModal).toBeNull()
  })

  it('is cleared by setAssessPoint', () => {
    useWorkspaceStore.getState().setPlanningModal(app)
    useWorkspaceStore.getState().setAssessPoint({ lat: 53.8, lng: -1.55 })
    expect(useWorkspaceStore.getState().planningModal).toBeNull()
  })
})
