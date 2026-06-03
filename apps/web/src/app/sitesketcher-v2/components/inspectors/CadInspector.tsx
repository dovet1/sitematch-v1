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
  const {
    cadImages,
    cadInstances,
    getCadForInstance,
    updateCadImage,
    deleteCadImage,
    updateCadInstance,
    deleteCadInstance,
  } = useSketchStore();

  // Check if it's a legacy CadImage
  const legacyCad = cadImages.find(c => c.id === cadImageId);

  // Check if it's a new CadInstance
  const instance = cadInstances.find(i => i.id === cadImageId);
  const savedCad = instance ? getCadForInstance(instance.id) : null;

  // Handle legacy CadImage
  if (legacyCad) {
    return <LegacyCadInspector cad={legacyCad} onUpdate={updateCadImage} onDelete={deleteCadImage} />;
  }

  // Handle new CadInstance
  if (instance) {
    if (!savedCad) {
      return (
        <div className="p-4 space-y-3">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="text-xs font-medium text-red-600 mb-1">
              CAD Deleted
            </div>
            <div className="text-[11px] text-sm-ink/70">
              The library CAD for this instance has been deleted.
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('Remove this deleted CAD instance from sketch?')) {
                deleteCadInstance(instance.id);
              }
            }}
            className="w-full px-3 py-2 bg-red-500/10 text-red-600 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-medium"
          >
            Remove from Sketch
          </button>
        </div>
      );
    }

    return <CadInstanceInspector instance={instance} savedCad={savedCad} onUpdate={updateCadInstance} onDelete={deleteCadInstance} />;
  }

  return (
    <div className="p-4 text-sm text-sm-ink/50">
      CAD not found
    </div>
  );
}

// Legacy CadImage inspector
function LegacyCadInspector({ cad, onUpdate, onDelete }: {
  cad: any;
  onUpdate: (id: string, updates: any) => void;
  onDelete: (id: string) => void;
}) {

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-sm-ink mb-3">CAD Properties (Legacy)</h3>
      </div>

      {cad.anchor === null && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <div className="text-xs font-medium text-orange-600 mb-1">
            Not Placed Yet
          </div>
          <div className="text-[11px] text-sm-ink/70">
            Go to Layers panel and click this CAD to place it on the map.
          </div>
        </div>
      )}

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
          onChange={(value) => onUpdate(cad.id, { opacity: value / 100 })}
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
          onChange={(rotation) => onUpdate(cad.id, { rotation })}
          min={-180}
          max={180}
          step={1}
          suffix="°"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-sm-ink">
          Lock Position
        </label>
        <button
          onClick={() => onUpdate(cad.id, { locked: !cad.locked })}
          disabled={cad.anchor === null}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            cad.locked
              ? 'bg-sm-violet text-white'
              : 'bg-sm-bg border border-sm-border text-sm-ink hover:bg-sm-bg-hover'
          }`}
        >
          {cad.locked ? 'Locked' : 'Unlocked'}
        </button>
      </div>

      <div className="p-3 bg-sm-bg border border-sm-border rounded">
        <div className="text-xs font-medium text-sm-ink mb-1">Calibration</div>
        <div className="text-[11px] text-sm-ink/70">
          Scale: {cad.metresPerPixel.toFixed(4)} m/px
        </div>
        <div className="text-[11px] text-sm-ink/70">
          Dimensions: {(cad.imageWidthPx * cad.metresPerPixel).toFixed(1)}m × {(cad.imageHeightPx * cad.metresPerPixel).toFixed(1)}m
        </div>
        <div className="text-[11px] text-sm-ink/70">
          Image: {cad.imageWidthPx} × {cad.imageHeightPx} px
        </div>
        {cad.calibrationPoints && (
          <div className="text-[11px] text-sm-ink/70 mt-1">
            Calibrated with {cad.calibrationPoints.distance.toFixed(1)}m reference
          </div>
        )}
        {cad.anchor && (
          <div className="text-[11px] text-sm-ink/70 mt-1">
            Position: {cad.anchor[1].toFixed(6)}, {cad.anchor[0].toFixed(6)}
          </div>
        )}
      </div>

      <div>
        <Button
          variant="ghost"
          onClick={() => {
            // TODO: Open calibration modal
            console.log('Recalibrate:', cad.id);
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
              onDelete(cad.id);
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

// New CadInstance inspector
function CadInstanceInspector({ instance, savedCad, onUpdate, onDelete }: {
  instance: any;
  savedCad: any;
  onUpdate: (id: string, updates: any) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Name
        </label>
        <div className="text-sm text-sm-ink/70 py-2 px-3 bg-sm-bg border border-sm-border rounded truncate">
          {savedCad.name}
        </div>
        <div className="text-[10px] text-sm-ink/50 mt-1">
          From library • {savedCad.fileName}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Opacity
        </label>
        <Slider
          value={instance.opacity * 100}
          onChange={(value) => onUpdate(instance.id, { opacity: value / 100 })}
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
          value={instance.rotation}
          onChange={(rotation) => onUpdate(instance.id, { rotation })}
          min={-180}
          max={180}
          step={1}
          suffix="°"
        />
      </div>

      <div className="p-3 bg-sm-bg border border-sm-border rounded">
        <div className="text-xs font-medium text-sm-ink mb-1">Calibration (from library)</div>
        <div className="text-[11px] text-sm-ink/70">
          Scale: {savedCad.metresPerPixel.toFixed(4)} m/px
        </div>
        <div className="text-[11px] text-sm-ink/70">
          Dimensions: {(savedCad.imageWidthPx * savedCad.metresPerPixel).toFixed(1)}m × {(savedCad.imageHeightPx * savedCad.metresPerPixel).toFixed(1)}m
        </div>
        <div className="text-[11px] text-sm-ink/70">
          Image: {savedCad.imageWidthPx} × {savedCad.imageHeightPx} px
        </div>
        {savedCad.calibrationPoints && (
          <div className="text-[11px] text-sm-ink/70 mt-1">
            Calibrated with {savedCad.calibrationPoints.distance.toFixed(1)}m reference
          </div>
        )}
        <div className="text-[11px] text-sm-ink/70 mt-1">
          Position: {instance.anchor[1].toFixed(6)}, {instance.anchor[0].toFixed(6)}
        </div>
      </div>

      <div className="pt-4 border-t border-sm-border">
        <button
          onClick={() => {
            if (confirm(`Remove ${savedCad.name} from sketch?`)) {
              onDelete(instance.id);
            }
          }}
          className="w-full px-3 py-2 bg-red-500/10 text-red-600 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-medium"
        >
          Remove from Sketch
        </button>
      </div>
    </div>
  );
}
