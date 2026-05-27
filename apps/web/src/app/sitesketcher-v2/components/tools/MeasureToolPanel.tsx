'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button } from '../primitives/Button';
import { calculateDistance } from '@/lib/sitesketcher-v2/polygon-utils';

export function MeasureToolPanel() {
  const { measurementInProgress, units, cancelMeasurement } = useSketchStore();

  // Calculate total distance
  let totalDistance = 0;
  const segments: { distance: string; index: number }[] = [];

  if (measurementInProgress && measurementInProgress.points.length > 1) {
    for (let i = 1; i < measurementInProgress.points.length; i++) {
      const dist = calculateDistance(
        measurementInProgress.points[i - 1].lngLat,
        measurementInProgress.points[i].lngLat,
        units
      );
      totalDistance += parseFloat(dist.replace(/[^\d.]/g, ''));
      segments.push({ distance: dist, index: i });
    }
  }

  const unitLabel = units === 'metric' ? 'm' : 'ft';

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-sm-ink mb-3">Measure Distance</h3>
        <p className="text-xs text-sm-ink/60 mb-4">
          Click points on the map to measure distances. Press Escape to clear.
        </p>
      </div>

      {measurementInProgress && measurementInProgress.points.length > 0 ? (
        <>
          <div className="p-3 bg-sm-violet-tint-soft border border-sm-violet/20 rounded-lg">
            <div className="text-xs font-medium text-sm-ink mb-1">Total Distance</div>
            <div className="text-lg font-bold font-mono text-sm-violet">
              {totalDistance.toFixed(1)} {unitLabel}
            </div>
          </div>

          {segments.length > 0 && (
            <div>
              <div className="text-xs font-medium text-sm-ink mb-2">Segments</div>
              <div className="space-y-1">
                {segments.map((segment) => (
                  <div
                    key={segment.index}
                    className="flex justify-between items-center text-xs py-1.5 px-2 bg-sm-bg rounded"
                  >
                    <span className="text-sm-ink/60">Segment {segment.index}</span>
                    <span className="font-mono text-sm-ink">{segment.distance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        <Button
          variant="ghost"
          onClick={cancelMeasurement}
          className="w-full"
        >
            Clear Measurement
          </Button>
        </>
      ) : (
        <div className="p-4 text-center text-sm text-sm-ink/50 border border-sm-border rounded-lg border-dashed">
          Click on the map to start measuring
        </div>
      )}

      <div className="pt-2 border-t border-sm-border">
        <h4 className="text-xs font-medium text-sm-ink mb-2">Shortcuts</h4>
        <ul className="space-y-1 text-xs text-sm-ink/60">
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              M
            </kbd>{' '}
            Measure tool
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              Esc
            </kbd>{' '}
            Clear measurement
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              V
            </kbd>{' '}
            Switch to select
          </li>
        </ul>
      </div>
    </div>
  );
}
