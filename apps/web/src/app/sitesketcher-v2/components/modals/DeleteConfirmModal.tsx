'use client';

import { Button } from '../primitives/Button';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  itemType: 'polygon' | 'parking' | 'cad' | 'sketch';
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmModal({
  itemType,
  itemName,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteConfirmModalProps) {
  const typeLabels = {
    polygon: 'polygon',
    parking: 'parking block',
    cad: 'CAD image',
    sketch: 'sketch',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      onConfirm();
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
            <div className="p-2 bg-red-500/10 rounded">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-sm-ink">
              Delete {typeLabels[itemType]}?
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1.5 hover:bg-sm-bg rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-sm-ink/60" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-sm-ink">
            Are you sure you want to delete{' '}
            <span className="font-semibold">"{itemName}"</span>?
          </p>
          <p className="text-sm text-sm-ink/60 mt-2">
            This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-sm-border">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
