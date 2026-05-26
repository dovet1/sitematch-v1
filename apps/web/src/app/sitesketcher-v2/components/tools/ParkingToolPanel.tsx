'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Stepper } from '../primitives/Stepper';
import { Segmented, SegmentedOption } from '../primitives/Segmented';
import { PARKING_DIMENSIONS } from '@/lib/sitesketcher-v2/constants';

export function ParkingToolPanel() {
  const { parkingPlacement, setParkingPlacement } = useSketchStore();
  const { spaces, layout, stallSize } = parkingPlacement;

  const layoutOptions: SegmentedOption<'single' | 'double'>[] = [
    { value: 'single', label: 'Single Row' },
    { value: 'double', label: 'Double Row' },
  ];

  const stallSizeOptions: SegmentedOption<'standard' | 'larger'>[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'larger', label: 'Larger' },
  ];

  // Calculate dimensions
  const dimensions = PARKING_DIMENSIONS[stallSize];
  const totalLength = dimensions.width * spaces;
  const totalWidth = layout === 'double' ? dimensions.length * 2 : dimensions.length;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-sm-ink mb-3">Add Parking</h3>
        <p className="text-xs text-sm-ink/60 mb-4">
          Click on the map to place a parking block. Drag to rotate.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Number of Spaces
        </label>
        <Stepper
          value={spaces}
          onChange={(value) => setParkingPlacement({ spaces: value })}
          min={1}
          max={100}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Layout
        </label>
        <Segmented
          options={layoutOptions}
          value={layout}
          onChange={(value) => setParkingPlacement({ layout: value })}
          fullWidth
        />
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Stall Size
        </label>
        <Segmented
          options={stallSizeOptions}
          value={stallSize}
          onChange={(value) => setParkingPlacement({ stallSize: value })}
          fullWidth
        />
        <p className="text-[10px] text-sm-ink/50 mt-1">
          {stallSize === 'standard' ? '2.4m × 4.8m' : '2.7m × 5.0m'} per space
        </p>
      </div>

      <div className="p-3 bg-sm-violet-tint-soft border border-sm-violet/20 rounded-lg">
        <div className="text-xs font-medium text-sm-ink mb-1">Preview</div>
        <div className="text-[11px] text-sm-ink/70">
          {totalLength.toFixed(1)}m × {totalWidth.toFixed(1)}m
        </div>
        <div className="text-[11px] text-sm-ink/70">
          {spaces} spaces ({layout})
        </div>
      </div>

      <div className="pt-2 border-t border-sm-border">
        <h4 className="text-xs font-medium text-sm-ink mb-2">Shortcuts</h4>
        <ul className="space-y-1 text-xs text-sm-ink/60">
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              K
            </kbd>{' '}
            Parking tool
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              V
            </kbd>{' '}
            Switch to select
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              Esc
            </kbd>{' '}
            Cancel
          </li>
        </ul>
      </div>
    </div>
  );
}
