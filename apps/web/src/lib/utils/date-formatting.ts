/**
 * Date formatting utilities for verification dates
 */

/**
 * Format a date for display (e.g., "15 January 2025")
 */
export function formatVerificationDate(date: string | null): string {
  if (!date) return 'Not verified';

  const dateObj = new Date(date);

  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Get relative time from now (e.g., "2 days ago", "3 months ago")
 */
export function getRelativeVerificationTime(date: string | null): string {
  if (!date) return 'Not verified';

  const now = new Date();
  const verifiedDate = new Date(date);
  const diffMs = now.getTime() - verifiedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Check if a listing was verified within a certain number of days
 * Default is 90 days (3 months)
 */
export function isRecentlyVerified(date: string | null, days: number = 90): boolean {
  if (!date) return false;

  const now = new Date();
  const verifiedDate = new Date(date);
  const diffMs = now.getTime() - verifiedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= days;
}

/**
 * Format date for input[type="date"] field (YYYY-MM-DD)
 */
export function formatDateForInput(date: string | Date | null): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as ISO string for setting verification date
 */
export function getTodayISOString(): string {
  return new Date().toISOString();
}
