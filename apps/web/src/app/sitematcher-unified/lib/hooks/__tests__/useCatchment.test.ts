import { renderHook, waitFor } from '@testing-library/react'
import { useCatchment } from '../useCatchment'
import { useDemographicsData } from '@/components/demographics/shared/hooks/useDemographicsData'
import { useLsoaSelection } from '@/components/demographics/shared/hooks/useLsoaSelection'

jest.mock('@/components/demographics/shared/hooks/useDemographicsData')
jest.mock('@/components/demographics/shared/hooks/useLsoaSelection')

const mockUseDemographicsData = useDemographicsData as jest.Mock
const mockUseLsoaSelection = useLsoaSelection as jest.Mock

describe('useCatchment', () => {
  const analyze = jest.fn()
  const analyzeBua = jest.fn()
  const initializeSelection = jest.fn()
  const resetSelection = jest.fn()
  const resetData = jest.fn()
  const updateData = jest.fn()
  const toggleLsoa = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    analyze.mockResolvedValue({
      success: true,
      lsoaCodes: ['E01000003'],
    })
    analyzeBua.mockResolvedValue({
      success: true,
      lsoaCodes: ['E01000001', 'E01000002'],
    })

    mockUseDemographicsData.mockReturnValue({
      rawDemographicsData: null,
      isochroneGeometry: null,
      lsoaTooltipData: {},
      nationalAverages: {},
      loading: false,
      error: null,
      analyze,
      analyzeBua,
      reset: resetData,
      updateData,
    })

    mockUseLsoaSelection.mockReturnValue({
      selectedLsoaCodes: new Set<string>(),
      allLsoaCodes: [],
      toggleLsoa,
      initializeSelection,
      reset: resetSelection,
    })
  })

  it('uses the BUA analyzer and seeds LSOA selection for BUA focus', async () => {
    renderHook(() =>
      useCatchment(
        {
          id: 'E34000001',
          name: 'Example BUA',
          center: [-1, 52],
          kind: 'bua',
        },
        { mode: 'distance', value: 5 },
        true
      )
    )

    await waitFor(() => {
      expect(analyzeBua).toHaveBeenCalledWith('E34000001')
    })

    expect(analyze).not.toHaveBeenCalled()
    expect(resetSelection).toHaveBeenCalled()
    expect(initializeSelection).toHaveBeenCalledWith(['E01000001', 'E01000002'])
  })

  it('keeps point focus on the existing distance analyzer path', async () => {
    renderHook(() =>
      useCatchment(
        {
          id: 'point:52.00000,-1.00000',
          name: 'Dropped point',
          center: [-1, 52],
          kind: 'point',
        },
        { mode: 'distance', value: 5 },
        true
      )
    )

    await waitFor(() => {
      expect(analyze).toHaveBeenCalled()
    })

    expect(analyzeBua).not.toHaveBeenCalled()
    expect(initializeSelection).toHaveBeenCalledWith(['E01000003'])
  })
})
