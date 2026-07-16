import { render, screen } from '@testing-library/react'
import { CatchmentTab } from '../CatchmentTab'
import type { CatchmentData } from '../../../lib/hooks/useCatchment'

const mockToggleShowLsoa = jest.fn()

jest.mock('@/components/demographics/DemographicsResults', () => ({
  DemographicsResults: () => <div data-testid="demographics-results" />,
}))

jest.mock('../../../lib/stores/unified-workspace-store', () => ({
  useWorkspaceStore: (selector: (state: any) => unknown) =>
    selector({
      showLsoa: true,
      toggleShowLsoa: mockToggleShowLsoa,
    }),
}))

const baseData: CatchmentData = {
  location: {
    id: 'E34000001',
    place_name: 'Example BUA',
    center: [-1, 52],
    place_type: ['place'],
    text: 'Example BUA',
  },
  measurementMode: 'distance',
  measurementValue: 5,
  loading: false,
  error: null,
  rawData: null,
  nationalAverages: {},
  lsoaTooltipData: {},
  allLsoaCodes: ['E01000001', 'E01000002', 'E01000003'],
  selectedLsoaCodes: new Set(['E01000001', 'E01000002']),
  toggleLsoa: jest.fn(),
  boundaryGeometry: null,
}

describe('CatchmentTab', () => {
  beforeEach(() => {
    mockToggleShowLsoa.mockClear()
  })

  it('removes catchment definition controls while keeping LSOA controls and stats', () => {
    render(<CatchmentTab data={baseData} />)

    expect(screen.queryByText('Catchment')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Radius' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drive' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Walk' })).not.toBeInTheDocument()

    expect(screen.getByText('Show LSOA overlay')).toBeInTheDocument()
    expect(screen.getByText('Click cells on the map to refine the catchment')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('of 3 areas selected')).toBeInTheDocument()
    expect(screen.getByTestId('demographics-results')).toBeInTheDocument()
  })
})
