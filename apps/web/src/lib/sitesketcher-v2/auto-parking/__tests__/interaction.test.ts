import { shouldSuppressEntranceMarkerClick } from '../interaction'

describe('shouldSuppressEntranceMarkerClick', () => {
  it.each(['entrance', 'entrance-edit'] as const)(
    'passes a stationary marker click through during %s placement',
    (phase) => {
      expect(shouldSuppressEntranceMarkerClick(phase, false)).toBe(false)
    }
  )

  it('suppresses the click emitted after dragging the marker', () => {
    expect(shouldSuppressEntranceMarkerClick('entrance', true)).toBe(true)
  })

  it('suppresses marker clicks outside entrance placement', () => {
    expect(shouldSuppressEntranceMarkerClick('compare', false)).toBe(true)
  })
})
