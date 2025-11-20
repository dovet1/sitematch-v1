'use client';

import { useMobileBreakpoint } from './shared/hooks/useMobileBreakpoint';
import { SiteDemographerDesktop } from './desktop/SiteDemographerDesktop';

/**
 * Router component for SiteDemographer
 * Switches between mobile and desktop implementations based on screen size
 *
 * Architecture:
 * - Mobile (<768px): Will use mobile components (to be implemented)
 * - Desktop (>=768px): Uses existing desktop layout
 *
 * Both implementations share the same data hooks from /shared
 */
export function SiteDemographerPage() {
  const { isMobile } = useMobileBreakpoint();

  // For now, always use desktop until mobile is implemented
  // TODO: Add mobile component
  // return isMobile ? <SiteDemographerMobile /> : <SiteDemographerDesktop />;

  return <SiteDemographerDesktop />;
}
