'use client';

import { Button } from '../primitives/Button';
import { AlertTriangle, FilePlus, X } from 'lucide-react';

interface NewSketchConfirmModalProps {
  mode: 'saved-clean' | 'saved-dirty' | 'unsaved';
  sketchName: string;
  objectCount: {
    polygons: number;
    parkingBlocks: number;
    cadImages: number;
  };
  onCancel: () => void;
  onStartNew: () => void;
  onSaveAndStart?: () => void;
  isLoading?: boolean;
}

export function NewSketchConfirmModal({
  mode,
  sketchName,
  objectCount,
  onCancel,
  onStartNew,
  onSaveAndStart,
  isLoading = false,
}: NewSketchConfirmModalProps) {
  const isDirtySavedSketch = mode === 'saved-dirty';
  const isUnsavedSketch = mode === 'unsaved';
  const title = isDirtySavedSketch
    ? 'Save changes before starting a new sketch?'
    : 'Start a new sketch?';
  const totalObjects = objectCount.polygons + objectCount.parkingBlocks + objectCount.cadImages;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onCancel();
    } else if (event.key === 'Enter' && !isUnsavedSketch) {
      if (isDirtySavedSketch && onSaveAndStart) {
        onSaveAndStart();
      } else {
        onStartNew();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-sm-surface border border-sm-border rounded-lg shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-sm-border">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded ${isUnsavedSketch ? 'bg-red-500/10' : 'bg-sm-violet/10'}`}>
              {isUnsavedSketch ? (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              ) : (
                <FilePlus className="w-5 h-5 text-sm-violet" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-sm-ink">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1.5 hover:bg-sm-bg rounded transition-colors disabled:opacity-50"
            aria-label="Cancel new sketch"
          >
            <X className="w-5 h-5 text-sm-ink/60" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isDirtySavedSketch && (
            <p className="text-sm text-sm-ink">
              <span className="font-semibold">&quot;{sketchName}&quot;</span> is saved, but your most recent edits
              have not finished saving yet.
            </p>
          )}

          {mode === 'saved-clean' && (
            <p className="text-sm text-sm-ink">
              Your current sketch <span className="font-semibold">&quot;{sketchName}&quot;</span> will stay saved and
              available from the Saved panel.
            </p>
          )}

          {isUnsavedSketch && (
            <p className="text-sm text-sm-ink">
              This sketch has not been saved yet. Starting a new sketch will clear the current canvas.
            </p>
          )}

          {totalObjects > 0 && (
            <div className="p-3 bg-sm-bg border border-sm-border rounded">
              <div className="text-xs font-medium text-sm-ink mb-2">Current canvas</div>
              <div className="space-y-1 text-xs text-sm-ink/70">
                {objectCount.polygons > 0 && (
                  <div>{objectCount.polygons} polygon{objectCount.polygons !== 1 ? 's' : ''}</div>
                )}
                {objectCount.parkingBlocks > 0 && (
                  <div>{objectCount.parkingBlocks} parking block{objectCount.parkingBlocks !== 1 ? 's' : ''}</div>
                )}
                {objectCount.cadImages > 0 && (
                  <div>{objectCount.cadImages} CAD image{objectCount.cadImages !== 1 ? 's' : ''}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-sm-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>

          {isDirtySavedSketch && (
            <>
              <Button
                type="button"
                variant="danger"
                onClick={onStartNew}
                disabled={isLoading}
              >
                Start without saving
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={onSaveAndStart}
                isLoading={isLoading}
              >
                Save and start new
              </Button>
            </>
          )}

          {mode === 'saved-clean' && (
            <Button
              type="button"
              variant="primary"
              onClick={onStartNew}
              disabled={isLoading}
            >
              Start new sketch
            </Button>
          )}

          {isUnsavedSketch && (
            <Button
              type="button"
              variant="danger"
              onClick={onStartNew}
              disabled={isLoading}
            >
              Start new sketch
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
