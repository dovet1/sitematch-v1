jest.mock('mapbox-gl', () => ({
  __esModule: true,
  default: {
    accessToken: '',
    Map: jest.fn(),
    NavigationControl: jest.fn(),
    Marker: jest.fn(),
    Popup: jest.fn()
  }
}))

import { formatRequirementLocationDisplay } from '../BUAMap'

describe('formatRequirementLocationDisplay', () => {
  it('shortens London locality addresses', () => {
    expect(formatRequirementLocationDisplay(
      'Dulwich, London, England, United Kingdom',
      'Fallback'
    )).toBe('Dulwich, London')
  })

  it('shortens county addresses', () => {
    expect(formatRequirementLocationDisplay(
      'Canterbury, Kent, England, United Kingdom',
      'Fallback'
    )).toBe('Canterbury, Kent')
  })

  it('removes UK suffixes when only one locality remains', () => {
    expect(formatRequirementLocationDisplay('London, UK', 'Fallback')).toBe('London')
  })

  it('falls back to place name when formatted address is unavailable', () => {
    expect(formatRequirementLocationDisplay(
      null,
      'Dulwich, London, England, United Kingdom'
    )).toBe('Dulwich, London')
  })

  it('returns an empty string when no usable location is available', () => {
    expect(formatRequirementLocationDisplay(null, null)).toBe('')
    expect(formatRequirementLocationDisplay('', '   ')).toBe('')
  })
})
