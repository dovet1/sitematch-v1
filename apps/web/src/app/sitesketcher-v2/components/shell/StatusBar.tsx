'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { MousePointer2 } from 'lucide-react';

export function StatusBar() {
  const { activeTool, polygons, parkingBlocks, cadImages, cadInstances, viewport } = useSketchStore();

  const totalCads = cadImages.length + cadInstances.length;
  const totalObjects = polygons.length + parkingBlocks.length + totalCads;

  return (
    <div className="h-8 bg-sm-surface border-t border-sm-border flex items-center justify-between px-4 text-xs text-sm-ink/60 flex-shrink-0">
      {/* Left: Active tool status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <MousePointer2 className="w-3.5 h-3.5" />
          <span>
            {activeTool === 'select'
              ? 'Select mode'
              : `${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} tool active`}
          </span>
        </div>

        {totalObjects > 0 && (
          <div className="flex items-center gap-3">
            {polygons.length > 0 && (
              <span>{polygons.length} polygon{polygons.length !== 1 ? 's' : ''}</span>
            )}
            {parkingBlocks.length > 0 && (
              <span>{parkingBlocks.length} parking</span>
            )}
            {totalCads > 0 && (
              <span>{totalCads} CAD</span>
            )}
          </div>
        )}
      </div>

      {/* Right: Map info */}
      <div className="flex items-center gap-4">
        <span>
          Zoom: {viewport.zoom.toFixed(2)}
        </span>
        <span>
          {viewport.center[1].toFixed(6)}, {viewport.center[0].toFixed(6)}
        </span>
      </div>
    </div>
  );
}
