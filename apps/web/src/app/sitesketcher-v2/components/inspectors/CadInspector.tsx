'use client';

import { useState, useEffect } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Input } from '../primitives/Input';
import { Slider } from '../primitives/Slider';
import { Button } from '../primitives/Button';

interface CadInspectorProps {
  cadImageId: string;
}

export function CadInspector({ cadImageId }: CadInspectorProps) {
  const { cadImages, updateCadImage, deleteCadImage } = useSketchStore();
  const cad = cadImages.find(c => c.id === cadImageId);

  if (!cad) {
    return (
      <div className="p-4 text-sm text-sm-ink/50">
        CAD image not found
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-sm-ink mb-3">CAD Properties</h3>
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Filename
        </label>
        <div className="text-sm text-sm-ink/70 py-2 px-3 bg-sm-bg border border-sm-border rounded truncate">
          {cad.fileName}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Opacity
        </label>
        <Slider
          value={cad.opacity * 100}
          onChange={(value) => updateCadImage(cadImageId, { opacity: value / 100 })}
          min={0}
          max={100}
          step={1}
          suffix="%"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Rotation
        </label>
        <Slider
          value={cad.rotation}
          onChange={(rotation) => updateCadImage(cadImageId, { rotation })}
          min={-180}
          max={180}
          step={1}
          suffix="°"
        />
      </div>

      <div className="p-3 bg-sm-bg border border-sm-border rounded">
        <div className="text-xs font-medium text-sm-ink mb-1">Calibration</div>
        <div className="text-[11px] text-sm-ink/70">
          Scale: {cad.metresPerPixel.toFixed(4)} m/px
        </div>
        <div className="text-[11px] text-sm-ink/70">
          Size: {cad.imageWidthPx} × {cad.imageHeightPx} px
        </div>
        {cad.calibrationPoints && (
          <div className="text-[11px] text-sm-ink/70 mt-1">
            Calibrated with {cad.calibrationPoints.distance}m reference
          </div>
        )}
      </div>

      <div>
        <Button
          variant="ghost"
          onClick={() => {
            // TODO: Open calibration modal
            console.log('Recalibrate:', cadImageId);
          }}
          className="w-full"
        >
          Recalibrate
        </Button>
      </div>

      <div className="pt-4 border-t border-sm-border">
        <button
          onClick={() => {
            if (confirm(`Delete ${cad.fileName}?`)) {
              deleteCadImage(cadImageId);
            }
          }}
          className="w-full px-3 py-2 bg-red-500/10 text-red-600 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-medium"
        >
          Delete CAD Image
        </button>
      </div>
    </div>
  );
}
