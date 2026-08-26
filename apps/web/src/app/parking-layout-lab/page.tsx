'use client';

/**
 * Parking Layout Lab — standalone, EXPERIMENTAL route.
 *
 * This route is intentionally NOT wired into any menu or navigation. It is an
 * isolated prototype for evaluating automatic surface-parking yield BEFORE any
 * decision to integrate with SiteSketcher or the unified workspace.
 *
 * Access: Plus tier only, using the project's existing subscription hook.
 * The heavy lab (map + solver) is code-split and only mounted once Plus access
 * is confirmed — it is never initialised for loading/anonymous/non-Plus users.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';

// Code-split: the lab bundle (Mapbox GL, Draw, solver) is not even fetched
// until we render <ParkingLab/>, which only happens for confirmed Plus users.
const ParkingLab = dynamic(() => import('./components/ParkingLab'), {
  ssr: false,
  loading: () => <FullScreenMessage>Loading Parking Layout Lab…</FullScreenMessage>,
});

export default function ParkingLayoutLabPage() {
  const { hasPlusAccess, loading } = useSubscriptionTier();

  // 1. Subscription status still loading.
  if (loading) {
    return <FullScreenMessage>Checking access…</FullScreenMessage>;
  }

  // 2. Not a Plus user — clear upgrade screen. The lab is NOT rendered.
  if (!hasPlusAccess) {
    return <PlusRequired />;
  }

  // 3. Confirmed Plus — initialise the lab.
  return <ParkingLab />;
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sm-bg">
      <div className="text-sm text-sm-ink/60">{children}</div>
    </div>
  );
}

function PlusRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sm-bg px-6">
      <div className="max-w-md rounded-2xl border border-sm-border bg-sm-surface p-8 text-center shadow-sm">
        <div className="mb-3 inline-flex rounded-full bg-sm-violet/10 px-3 py-1 text-xs font-medium text-sm-violet">
          Plus access required
        </div>
        <h1 className="text-xl font-semibold text-sm-ink">Parking Layout Lab</h1>
        <p className="mt-3 text-sm text-sm-ink2">
          This experimental tool for prototyping automatic surface-parking
          layouts is available on the Plus plan only. Upgrade to explore it.
        </p>
        <Link
          href="/subscription"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-sm-violet px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sm-violet-deep"
        >
          Upgrade to Plus
        </Link>
      </div>
    </div>
  );
}
