'use client';

import { useState, useEffect } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { POLYGON_COLORS } from '@/lib/sitesketcher-v2/constants';
import { Input } from '../primitives/Input';
import { Slider } from '../primitives/Slider';
import { Toggle } from '../primitives/Toggle';
import { Polygon } from '@/types/sitesketcher-v2';
import { formatAreaBreakdown } from '@/lib/sitesketcher-v2/polygon-utils';

interface PolygonInspectorProps {
  polygonId: string;
}

export function PolygonInspector({ polygonId }: PolygonInspectorProps) {
  const { polygons, updatePolygon, rotatePolygon, deletePolygon, units } = useSketchStore();
  const polygon = polygons.find(p => p.id === polygonId);

  const [localName, setLocalName] = useState(polygon?.name || '');

  useEffect(() => {
    setLocalName(polygon?.name || '');
  }, [polygon?.name]);

  if (!polygon) {
    return (
      <div className="p-4 text-sm text-sm-ink/50">
        Polygon not found
      </div>
    );
  }

  const handleNameBlur = () => {
    if (localName !== polygon.name && localName.trim()) {
      updatePolygon(polygonId, { name: localName.trim() });
    } else if (!localName.trim()) {
      setLocalName(polygon.name);
    }
  };

  const area = formatAreaBreakdown(polygon.points, units);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-sm-ink mb-3">Polygon Properties</h3>
      </div>

      <Input
        value={localName}
        onChange={(event) => setLocalName(event.target.value)}
        onBlur={handleNameBlur}
        label="Name"
        placeholder="Enter polygon name"
      />

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Colour
        </label>
        <div className="grid grid-cols-3 gap-2">
          {POLYGON_COLORS.map((color, index) => (
            <button
              key={color.label}
              onClick={() => updatePolygon(polygonId, { colorIndex: index })}
              className={`
                flex items-center gap-2 p-2 rounded border-2 transition-all
                ${
                  polygon.colorIndex === index
                    ? 'border-sm-violet bg-sm-violet/5'
                    : 'border-sm-border hover:border-sm-violet/40'
                }
              `}
              title={color.label}
            >
              <div
                className="w-4 h-4 rounded border-2"
                style={{
                  backgroundColor: color.fill,
                  borderColor: color.stroke,
                }}
              />
              <span className="text-xs text-sm-ink">{color.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Area
        </label>
        <div className="font-mono bg-sm-bg p-2 rounded border border-sm-border">
          <div className="text-sm text-sm-ink/80">{area.primary}</div>
          <div className="text-xs text-sm-ink/55 mt-1">{area.secondary}</div>
        </div>
      </div>

      <Slider
        label="Height (3D)"
        value={polygon.height}
        onChange={(height) => updatePolygon(polygonId, { height })}
        min={0}
        max={100}
        step={1}
        suffix={units === 'metric' ? 'm' : 'ft'}
      />

      <Slider
        label="Rotation"
        value={polygon.rotation}
        onChange={(rotation) => rotatePolygon(polygonId, rotation)}
        min={0}
        max={360}
        step={1}
        suffix="°"
      />

      <Toggle
        checked={polygon.showDistances}
        onChange={(showDistances) => updatePolygon(polygonId, { showDistances })}
        label="Show edge distances"
      />

      <div className="pt-4 border-t border-sm-border">
        <button
          onClick={() => {
            if (confirm(`Delete ${polygon.name}?`)) {
              deletePolygon(polygonId);
            }
          }}
          className="w-full px-3 py-2 bg-red-500/10 text-red-600 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-medium"
        >
          Delete Polygon
        </button>
      </div>
    </div>
  );
}
