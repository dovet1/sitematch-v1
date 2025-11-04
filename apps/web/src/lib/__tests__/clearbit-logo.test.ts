// =====================================================
// Logo.dev Service Unit Tests (formerly Clearbit) - Story 9.0
// =====================================================

import {
  validateDomain,
  normalizeDomain,
  fetchCompanyLogo,
  getClearbitLogoUrl,
  clearLogoCache,
  getCacheStats
} from '../clearbit-logo';

// Mock environment variable
process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN = 'pk_test_token';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock AbortSignal.timeout for Node.js compatibility
global.AbortSignal.timeout = jest.fn().mockImplementation((ms: number) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
});

describe('logo-dev service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLogoCache();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('validateDomain', () => {
    it('should validate correct domain formats', () => {
      expect(validateDomain('apple.com')).toBe(true);
      expect(validateDomain('google.co.uk')).toBe(true);
      expect(validateDomain('sub.domain.com')).toBe(true);
      expect(validateDomain('example-company.org')).toBe(true);
    });

    it('should handle domains with protocols', () => {
      expect(validateDomain('https://apple.com')).toBe(true);
      expect(validateDomain('http://google.com')).toBe(true);
    });

    it('should handle domains with www prefix', () => {
      expect(validateDomain('www.apple.com')).toBe(true);
      expect(validateDomain('https://www.google.com')).toBe(true);
    });

    it('should reject invalid domain formats', () => {
      expect(validateDomain('')).toBe(false);
      expect(validateDomain('invalid')).toBe(false);
      expect(validateDomain('no-tld')).toBe(false);
      expect(validateDomain('.com')).toBe(false);
      expect(validateDomain('domain.')).toBe(false);
      expect(validateDomain('space domain.com')).toBe(false);
    });

    it('should handle null and undefined inputs', () => {
      expect(validateDomain(null as any)).toBe(false);
      expect(validateDomain(undefined as any)).toBe(false);
      expect(validateDomain(123 as any)).toBe(false);
    });
  });

  describe('normalizeDomain', () => {
    it('should normalize domain to lowercase', () => {
      expect(normalizeDomain('APPLE.COM')).toBe('apple.com');
      expect(normalizeDomain('Google.Co.UK')).toBe('google.co.uk');
    });

    it('should remove protocols', () => {
      expect(normalizeDomain('https://apple.com')).toBe('apple.com');
      expect(normalizeDomain('http://google.com')).toBe('google.com');
    });

    it('should remove www prefix', () => {
      expect(normalizeDomain('www.apple.com')).toBe('apple.com');
      expect(normalizeDomain('https://www.google.com')).toBe('google.com');
    });

    it('should remove trailing slashes', () => {
      expect(normalizeDomain('apple.com/')).toBe('apple.com');
      expect(normalizeDomain('https://google.com/')).toBe('google.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeDomain('  apple.com  ')).toBe('apple.com');
      expect(normalizeDomain('\tgoogle.com\n')).toBe('google.com');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(normalizeDomain('')).toBe('');
      expect(normalizeDomain(null as any)).toBe('');
      expect(normalizeDomain(undefined as any)).toBe('');
    });
  });

  describe('getClearbitLogoUrl', () => {
    it('should return correct Logo.dev URL for valid domains', () => {
      expect(getClearbitLogoUrl('apple.com')).toBe('https://img.logo.dev/apple.com?token=pk_test_token&size=300&retina=true&format=png');
      expect(getClearbitLogoUrl('www.google.com')).toBe('https://img.logo.dev/google.com?token=pk_test_token&size=300&retina=true&format=png');
    });

    it('should return null for invalid domains', () => {
      expect(getClearbitLogoUrl('invalid')).toBe(null);
      expect(getClearbitLogoUrl('')).toBe(null);
    });
  });

  describe('fetchCompanyLogo', () => {
    it('should throw error for invalid domain', async () => {
      await expect(fetchCompanyLogo('invalid')).rejects.toThrow('Invalid domain format');
    });

    it('should return logo URL for successful API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response);

      const result = await fetchCompanyLogo('apple.com');
      expect(result).toBe('https://img.logo.dev/apple.com?token=pk_test_token&size=300&retina=true&format=png');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://img.logo.dev/apple.com?token=pk_test_token&size=300&retina=true&format=png',
        {
          method: 'HEAD',
          signal: expect.any(AbortSignal)
        }
      );
    });

    it('should return null for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      const result = await fetchCompanyLogo('nonexistent.com');
      expect(result).toBe(null);
    });

    it('should cache successful results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response);

      // First call
      await fetchCompanyLogo('apple.com');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await fetchCompanyLogo('apple.com');
      expect(result).toBe('https://img.logo.dev/apple.com?token=pk_test_token&size=300&retina=true&format=png');
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
    });

    it('should cache failure results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      // First call
      await fetchCompanyLogo('nonexistent.com');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await fetchCompanyLogo('nonexistent.com');
      expect(result).toBe(null);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
    });

    it('should respect cache expiry', async () => {
      jest.useFakeTimers();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response);

      // First call
      await fetchCompanyLogo('apple.com');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Fast forward past cache expiry (1 hour)
      jest.advanceTimersByTime(60 * 60 * 1000 + 1);

      // Second call should make new request
      await fetchCompanyLogo('apple.com');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchCompanyLogo('apple.com')).rejects.toThrow(
        'Unable to fetch logo. Please check the domain or try uploading your own logo.'
      );
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      await expect(fetchCompanyLogo('apple.com')).rejects.toThrow(
        'Request timed out. Please try again.'
      );
    });

    it('should implement rate limiting', async () => {
      jest.useFakeTimers();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response);
      
      // Make two consecutive calls to different domains
      const promise1 = fetchCompanyLogo('apple.com');
      
      // Run all pending timers
      jest.runAllTimers();
      await promise1;
      
      const promise2 = fetchCompanyLogo('google.com');
      jest.runAllTimers();
      await promise2;

      // Should have made both requests
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
  });

  describe('cache management', () => {
    it('should track cache statistics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response);

      await fetchCompanyLogo('apple.com');
      await fetchCompanyLogo('google.com');

      const stats = getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toContain('apple.com');
      expect(stats.entries).toContain('google.com');
    });

    it('should clear cache completely', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response);

      await fetchCompanyLogo('apple.com');
      expect(getCacheStats().size).toBe(1);

      clearLogoCache();
      expect(getCacheStats().size).toBe(0);
    });
  });
});