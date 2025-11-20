'use client';

import { useMobileBreakpoint } from './shared/hooks/useMobileBreakpoint';
import { SiteDemographerDesktop } from './desktop/SiteDemographerDesktop';
import { SiteDemographerMobile } from './mobile/SiteDemographerMobile';

/**
 * Router component for SiteDemographer
 * Switches between mobile and desktop implementations based on screen size
 *
 * Architecture:
 * - Mobile (<768px): Touch-optimized mobile layout with bottom sheet
 * - Desktop (>=768px): Traditional desktop layout with side panel
 *
 * Both implementations share the same data hooks from /shared
 */
export function SiteDemographerPage() {
  const { isMobile } = useMobileBreakpoint();

  return isMobile ? <SiteDemographerMobile /> : <SiteDemographerDesktop />;
}
