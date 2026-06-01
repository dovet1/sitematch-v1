import { formatPolygonLineDistance } from '../polygon-utils';

describe('formatPolygonLineDistance', () => {
  it('rounds metric polygon line distances down to whole metres', () => {
    expect(formatPolygonLineDistance(12.4, 'metric')).toBe('12m');
  });

  it('rounds metric polygon line distances up to whole metres', () => {
    expect(formatPolygonLineDistance(12.5, 'metric')).toBe('13m');
  });

  it('converts and rounds imperial polygon line distances to whole feet', () => {
    expect(formatPolygonLineDistance(12, 'imperial')).toBe('39ft');
  });

  it('does not include decimal precision in either unit', () => {
    expect(formatPolygonLineDistance(9.99, 'metric')).not.toContain('.');
    expect(formatPolygonLineDistance(9.99, 'imperial')).not.toContain('.');
  });
});
