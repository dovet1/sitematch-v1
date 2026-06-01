'use client';

import { useEffect, useState } from 'react';
import UnsupportedViewport from './unsupported';
import { TopBar } from './components/shell/TopBar';
import { LeftRail } from './components/shell/LeftRail';
import { LeftPanel } from './components/shell/LeftPanel';
import { RightInspector } from './components/shell/RightInspector';
import { StatusBar } from './components/shell/StatusBar';
import { FloatingMapControls } from './components/shell/FloatingMapControls';
import { MapCanvas } from './components/map/MapCanvas';
import { AnonymousPaywallOverlay } from './components/overlays/AnonymousPaywallOverlay';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { useAuth } from '@/hooks/use-auth';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { TIER_FEATURES } from '@/lib/sitesketcher-v2/constants';
import { Toaster, toast } from 'sonner';

const MINIMUM_WIDTH = 1024;

export default function SiteSketcherV2Page() {
  const [isSupported, setIsSupported] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { hasProAccess, hasPlusAccess, loading: tierLoading } = useSubscriptionTier();
  const { loadSavedCads, setEffectiveAccess, sketchId, loadSketch } = useSketchStore();

  useEffect(() => {
    const checkViewport = () => {
      const supported = window.innerWidth >= MINIMUM_WIDTH;
      setIsSupported(supported);
      setIsLoading(false);
    };

    // Check on mount
    checkViewport();

    // Check on resize
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Sync effective access and handle mid-session subscription changes
  useEffect(() => {
    if (!tierLoading) {
      const tierLimits = hasPlusAccess
        ? TIER_FEATURES.plus
        : hasProAccess
        ? TIER_FEATURES.pro
        : TIER_FEATURES.free;

      const prevAccess = useSketchStore.getState().effectiveAccess;
      const newAccess = { hasProAccess, hasPlusAccess, tierLimits };

      // Check if Plus access changed
      const accessChanged = prevAccess.hasPlusAccess !== hasPlusAccess;

      // Update store
      setEffectiveAccess(newAccess);

      // If Plus access changed and a sketch is loaded, refetch from server
      if (accessChanged && sketchId) {
        // CRITICAL: Refetch from server, not reload from current state
        // Current state has empty CAD arrays for non-Plus, but server has full data
        fetch(`/api/sitesketcher-v2/sketches/${sketchId}`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
          })
          .then(({ sketch }) => {
            if (sketch) {
              // loadSketch will re-apply CAD filtering based on new effectiveAccess
              loadSketch(sketch);
            }
          })
          .catch(err => {
            console.error('Failed to reload sketch after tier change:', err);
            toast.error('Failed to update sketch. Please refresh the page.');
          });
      }
    }
  }, [hasProAccess, hasPlusAccess, tierLoading, sketchId, loadSketch, setEffectiveAccess]);

  // Gate CAD library loading behind Plus access
  useEffect(() => {
    if (!tierLoading && hasPlusAccess) {
      loadSavedCads();
    }
  }, [tierLoading, hasPlusAccess, loadSavedCads]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const store = useSketchStore.getState();

      switch (e.key.toLowerCase()) {
        case 'v':
          e.preventDefault();
          store.setActiveTool('select');
          break;
        case 'p':
          e.preventDefault();
          store.setActiveTool('polygon');
          break;
        case 'k':
          e.preventDefault();
          store.setActiveTool('parking');
          break;
        case 'c':
          e.preventDefault();
          store.setActiveTool('cad');
          break;
        case 'm':
          e.preventDefault();
          store.setActiveTool('measure');
          break;
        case 'escape':
          store.setActiveTool('select');
          store.cancelMeasurement();
          break;
        case 'enter':
          // If in measure mode with an active measurement, freeze it
          if (store.activeTool === 'measure' && store.measurementInProgress) {
            e.preventDefault();
            store.freezeMeasurement();
          }
          break;
        case 'z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (e.shiftKey) {
              store.redo();
            } else {
              store.undo();
            }
          }
          break;
        case 'delete':
        case 'backspace':
          if (store.selectedId) {
            e.preventDefault();
            // Delete selected object
            if (store.selectedType === 'polygon') {
              if (confirm(`Delete ${store.polygons.find(p => p.id === store.selectedId)?.name}?`)) {
                store.deletePolygon(store.selectedId);
              }
            } else if (store.selectedType === 'parking') {
              if (confirm(`Delete ${store.parkingBlocks.find(p => p.id === store.selectedId)?.name}?`)) {
                store.deleteParkingBlock(store.selectedId);
              }
            } else if (store.selectedType === 'cad') {
              if (confirm(`Delete ${store.cadImages.find(c => c.id === store.selectedId)?.fileName}?`)) {
                store.deleteCadImage(store.selectedId);
              }
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show loading state briefly to avoid flash
  if (isLoading || authLoading || tierLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sm-bg">
        <div className="text-sm-ink/50">Loading...</div>
      </div>
    );
  }

  // Show unsupported viewport screen if needed
  if (!isSupported) {
    return <UnsupportedViewport />;
  }

  // Show anonymous paywall overlay if user is not logged in
  if (!user) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <AnonymousPaywallOverlay />
      </>
    );
  }

  // Main SiteSketcher v2 UI
  return (
    <div className="sitesketcher-v2-container">
      <Toaster position="top-center" richColors />

      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail */}
        <LeftRail />

        {/* Left Panel (conditional) */}
        <LeftPanel />

        {/* Map Canvas */}
        <div className="flex-1 relative">
          <MapCanvas />
          <FloatingMapControls />
          <RightInspector />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
