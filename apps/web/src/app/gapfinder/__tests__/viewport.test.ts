import { GAPFINDER_MIN_WIDTH, isGapFinderViewportSupported } from '../viewport'

describe('GapFinder viewport support', () => {
  it('blocks mobile widths below 768px', () => {
    expect(isGapFinderViewportSupported(375)).toBe(false)
    expect(isGapFinderViewportSupported(GAPFINDER_MIN_WIDTH - 1)).toBe(false)
  })

  it('allows tablet and desktop widths', () => {
    expect(isGapFinderViewportSupported(GAPFINDER_MIN_WIDTH)).toBe(true)
    expect(isGapFinderViewportSupported(1024)).toBe(true)
  })
})
