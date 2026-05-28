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
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';

const MINIMUM_WIDTH = 1024;

export default function SiteSketcherV2Page() {
  const [isSupported, setIsSupported] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

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
  if (isLoading) {
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

  // Main SiteSketcher v2 UI
  return (
    <div className="sitesketcher-v2-container">
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
