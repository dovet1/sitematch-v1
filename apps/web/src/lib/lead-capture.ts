const LEAD_MODAL_KEY = 'siteMatch_leadModalShown';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export interface LeadModalState {
  shown: boolean;
  timestamp: number;
}

/**
 * Check if the lead capture modal should be shown
 * Returns true if modal hasn't been shown or if 30 days have passed
 */
export function shouldShowLeadModal(): boolean {
  if (typeof window === 'undefined') {
    return false; // Server-side rendering
  }

  try {
    const stored = localStorage.getItem(LEAD_MODAL_KEY);
    
    if (!stored) {
      return true; // Never shown before
    }

    const state: LeadModalState = JSON.parse(stored);
    const now = Date.now();
    const daysSinceShown = now - state.timestamp;

    return daysSinceShown >= THIRTY_DAYS_MS;
  } catch (error) {
    console.error('Error checking lead modal state:', error);
    return true; // Show modal if there's an error reading localStorage
  }
}

/**
 * Mark the lead capture modal as shown
 */
export function markLeadModalShown(): void {
  if (typeof window === 'undefined') {
    return; // Server-side rendering
  }

  try {
    const state: LeadModalState = {
      shown: true,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(LEAD_MODAL_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving lead modal state:', error);
  }
}

/**
 * Clear the lead modal state (useful for testing)
 */
export function clearLeadModalState(): void {
  if (typeof window === 'undefined') {
    return; // Server-side rendering
  }

  try {
    localStorage.removeItem(LEAD_MODAL_KEY);
  } catch (error) {
    console.error('Error clearing lead modal state:', error);
  }
}