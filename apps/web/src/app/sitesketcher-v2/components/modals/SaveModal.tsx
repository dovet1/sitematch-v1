'use client';

import { useState, useEffect } from 'react';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { X } from 'lucide-react';

interface SaveModalProps {
  currentName?: string;
  currentDescription?: string;
  objectCount: {
    polygons: number;
    parkingBlocks: number;
    cadImages: number;
  };
  onSave: (data: { name: string; description?: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SaveModal({
  currentName = '',
  currentDescription = '',
  objectCount,
  onSave,
  onCancel,
  isLoading = false,
}: SaveModalProps) {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);

  useEffect(() => {
    setName(currentName);
    setDescription(currentDescription);
  }, [currentName, currentDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({ name: name.trim(), description: description.trim() || undefined });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const canSave = name.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-sm-surface border border-sm-border rounded-lg shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-sm-border">
          <h2 className="text-lg font-semibold text-sm-ink">Save Sketch</h2>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1.5 hover:bg-sm-bg rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-sm-ink/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <Input
              label="Sketch Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g., High Street Development"
              autoFocus
              disabled={isLoading}
              required
            />

            <div>
              <label className="text-xs font-medium text-sm-ink block mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                maxLength={500}
                disabled={isLoading}
                className="w-full px-3 py-2 text-sm bg-sm-surface border border-sm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-sm-violet/20 focus:border-sm-violet resize-none disabled:opacity-50"
              />
              <div className="text-[10px] text-sm-ink/40 mt-1">
                {description.length}/500 characters
              </div>
            </div>

            <div className="p-3 bg-sm-bg border border-sm-border rounded">
              <div className="text-xs font-medium text-sm-ink mb-2">Objects in Sketch</div>
              <div className="space-y-1 text-xs text-sm-ink/70">
                {objectCount.polygons > 0 && (
                  <div>• {objectCount.polygons} polygon{objectCount.polygons !== 1 ? 's' : ''}</div>
                )}
                {objectCount.parkingBlocks > 0 && (
                  <div>• {objectCount.parkingBlocks} parking block{objectCount.parkingBlocks !== 1 ? 's' : ''}</div>
                )}
                {objectCount.cadImages > 0 && (
                  <div>• {objectCount.cadImages} CAD image{objectCount.cadImages !== 1 ? 's' : ''}</div>
                )}
                {objectCount.polygons === 0 && objectCount.parkingBlocks === 0 && objectCount.cadImages === 0 && (
                  <div className="text-sm-ink/50">No objects yet</div>
                )}
              </div>
            </div>
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
            <Button
              type="submit"
              disabled={!canSave || isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Sketch'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
