'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button, Segmented, SegmentedOption } from '../primitives';
import { MapStyle, ViewMode, Units } from '@/types/sitesketcher-v2';
import {
  Box,
  Cuboid,
  Layers,
  Map as MapIcon,
  Mountain,
  Ruler,
} from 'lucide-react';

export function FloatingMapControls() {
  const { view, setView, units, setUnits, mapStyle, setMapStyle } = useSketchStore();

  const viewOptions: SegmentedOption<ViewMode>[] = [
    { value: '2d', label: '2D', icon: <Box className="w-3.5 h-3.5" /> },
    { value: '3d', label: '3D', icon: <Cuboid className="w-3.5 h-3.5" /> },
  ];

  const unitsOptions: SegmentedOption<Units>[] = [
    { value: 'metric', label: 'm', icon: <Ruler className="w-3.5 h-3.5" /> },
    { value: 'imperial', label: 'ft', icon: <Ruler className="w-3.5 h-3.5" /> },
  ];

  const mapStyleOptions: SegmentedOption<MapStyle>[] = [
    { value: 'satellite', label: 'Satellite', icon: <Mountain className="w-3.5 h-3.5" /> },
    { value: 'hybrid', label: 'Hybrid', icon: <Layers className="w-3.5 h-3.5" /> },
    { value: 'streets', label: 'Streets', icon: <MapIcon className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-3">
      {/* View mode (2D/3D) */}
      <div className="bg-sm-surface border border-sm-border rounded-lg shadow-lg p-2">
        <Segmented
          options={viewOptions}
          value={view}
          onChange={setView}
          size="sm"
        />
      </div>

      {/* Units (m/ft) */}
      <div className="bg-sm-surface border border-sm-border rounded-lg shadow-lg p-2">
        <Segmented
          options={unitsOptions}
          value={units}
          onChange={setUnits}
          size="sm"
        />
      </div>

      {/* Map style */}
      <div className="bg-sm-surface border border-sm-border rounded-lg shadow-lg p-2">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-sm-ink px-2">Map Style</span>
          <div className="flex flex-col gap-1">
            {mapStyleOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setMapStyle(option.value)}
                className={`flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors ${
                  mapStyle === option.value
                    ? 'bg-sm-violet text-white'
                    : 'text-sm-ink hover:bg-sm-bg'
                }`}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
