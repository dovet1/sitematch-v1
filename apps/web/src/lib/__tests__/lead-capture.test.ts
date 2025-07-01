/**
 * @jest-environment jsdom
 */

import { shouldShowLeadModal, markLeadModalShown, clearLeadModalState } from '../lead-capture';

describe('Lead Capture localStorage utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  describe('shouldShowLeadModal', () => {
    it('should return true when modal has never been shown', () => {
      expect(shouldShowLeadModal()).toBe(true);
    });

    it('should return false when modal was shown recently', () => {
      markLeadModalShown();
      expect(shouldShowLeadModal()).toBe(false);
    });

    it('should return true when 30 days have passed', () => {
      // Set timestamp to 31 days ago
      const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);
      const state = {
        shown: true,
        timestamp: thirtyOneDaysAgo,
      };
      localStorage.setItem('siteMatch_leadModalShown', JSON.stringify(state));

      expect(shouldShowLeadModal()).toBe(true);
    });

    it('should return true when localStorage contains invalid JSON', () => {
      localStorage.setItem('siteMatch_leadModalShown', 'invalid-json');
      expect(shouldShowLeadModal()).toBe(true);
    });
  });

  describe('markLeadModalShown', () => {
    it('should store modal shown state with current timestamp', () => {
      const beforeTimestamp = Date.now();
      markLeadModalShown();
      const afterTimestamp = Date.now();

      const stored = localStorage.getItem('siteMatch_leadModalShown');
      expect(stored).toBeTruthy();

      const state = JSON.parse(stored!);
      expect(state.shown).toBe(true);
      expect(state.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(state.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe('clearLeadModalState', () => {
    it('should remove the modal state from localStorage', () => {
      markLeadModalShown();
      expect(localStorage.getItem('siteMatch_leadModalShown')).toBeTruthy();

      clearLeadModalState();
      expect(localStorage.getItem('siteMatch_leadModalShown')).toBeNull();
    });
  });
});