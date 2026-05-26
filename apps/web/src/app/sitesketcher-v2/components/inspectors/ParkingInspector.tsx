'use client';

import { useState, useEffect } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { PARKING_DIMENSIONS } from '@/lib/sitesketcher-v2/constants';
import { Input } from '../primitives/Input';
import { Slider } from '../primitives/Slider';
import { Stepper } from '../primitives/Stepper';
import { Segmented, SegmentedOption } from '../primitives/Segmented';

interface ParkingInspectorProps {
  parkingBlockId: string;
}

export function ParkingInspector({ parkingBlockId }: ParkingInspectorProps) {
  const { parkingBlocks, updateParkingBlock, deleteParkingBlock } = useSketchStore();
  const parking = parkingBlocks.find(p => p.id === parkingBlockId);

  const [localName, setLocalName] = useState(parking?.name || '');

  useEffect(() => {
    setLocalName(parking?.name || '');
  }, [parking?.name]);

  if (!parking) {
    return (
      <div className="p-4 text-sm text-sm-ink/50">
        Parking block not found
      </div>
    );
  }

  const handleNameBlur = () => {
    if (localName !== parking.name && localName.trim()) {
      updateParkingBlock(parkingBlockId, { name: localName.trim() });
    } else if (!localName.trim()) {
      setLocalName(parking.name);
    }
  };

  const layoutOptions: SegmentedOption<'single' | 'double'>[] = [
    { value: 'single', label: 'Single Row' },
    { value: 'double', label: 'Double Row' },
  ];

  const stallSizeOptions: SegmentedOption<'standard' | 'larger'>[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'larger', label: 'Larger' },
  ];

  // Calculate dimensions
  const dimensions = PARKING_DIMENSIONS[parking.stallSize];
  const totalLength = dimensions.length * parking.spaces;
  const totalWidth = parking.layout === 'double' ? dimensions.width * 2 : dimensions.width;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-sm-ink mb-3">Parking Properties</h3>
      </div>

      <Input
        value={localName}
        onChange={(event) => setLocalName(event.target.value)}
        onBlur={handleNameBlur}
        label="Name"
        placeholder="Enter parking name"
      />

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Number of Spaces
        </label>
        <Stepper
          value={parking.spaces}
          onChange={(spaces) => updateParkingBlock(parkingBlockId, { spaces })}
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
          value={parking.layout}
          onChange={(layout) => updateParkingBlock(parkingBlockId, { layout })}
          fullWidth
        />
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Stall Size
        </label>
        <Segmented
          options={stallSizeOptions}
          value={parking.stallSize}
          onChange={(stallSize) => updateParkingBlock(parkingBlockId, { stallSize })}
          fullWidth
        />
        <p className="text-[10px] text-sm-ink/50 mt-1">
          {parking.stallSize === 'standard' ? '2.4m × 4.8m' : '2.7m × 5.0m'} per space
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Rotation
        </label>
        <Slider
          value={parking.rotation}
          onChange={(rotation) => updateParkingBlock(parkingBlockId, { rotation })}
          min={0}
          max={360}
          step={1}
          suffix="°"
        />
      </div>

      <div className="p-3 bg-sm-bg border border-sm-border rounded">
        <div className="text-xs font-medium text-sm-ink mb-1">Dimensions</div>
        <div className="text-[11px] text-sm-ink/70">
          {totalLength.toFixed(1)}m × {totalWidth.toFixed(1)}m
        </div>
        <div className="text-[11px] text-sm-ink/70">
          {parking.spaces} spaces ({parking.layout})
        </div>
      </div>

      <div className="pt-4 border-t border-sm-border">
        <button
          onClick={() => {
            if (confirm(`Delete ${parking.name}?`)) {
              deleteParkingBlock(parkingBlockId);
            }
          }}
          className="w-full px-3 py-2 bg-red-500/10 text-red-600 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-medium"
        >
          Delete Parking Block
        </button>
      </div>
    </div>
  );
}
