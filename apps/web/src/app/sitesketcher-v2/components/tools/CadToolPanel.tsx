'use client';

import { useState, useRef } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button } from '../primitives/Button';
import { DropdownMenu } from '../primitives/DropdownMenu';
import { Upload, Check, AlertCircle, Edit, RotateCcw, Trash2 } from 'lucide-react';
import { CleanupModal } from '../modals/CleanupModal';
import { CalibrationModal } from '../modals/CalibrationModal';
import type { CadImage, SavedCad } from '@/types/sitesketcher-v2';
import { clsx } from 'clsx';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

interface UploadResult {
  id: string;
  fileName: string;
  url: string;
  storagePath: string;
  imageWidthPx: number;
  imageHeightPx: number;
}

export function CadToolPanel() {
  const {
    savedCads,
    savedCadsLoading,
    savedCadsError,
    addSavedCad,
    updateSavedCad,
    deleteSavedCad,
    startCadPlacement,
    cadPlacementInProgress,
  } = useSketchStore();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal flow state
  const [uploadedImage, setUploadedImage] = useState<UploadResult | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PNG and JPG images are allowed');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 50MB)');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/sitesketcher-v2/upload-cad', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadedImage(result);
      setShowCleanupModal(true);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload CAD image');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleCleanupComplete = async (result: {
    processedBlob: Blob;
    newWidthPx: number;
    newHeightPx: number;
  }) => {
    if (!uploadedImage) return;

    try {
      const formData = new FormData();
      const processedFileName = uploadedImage.fileName.replace(/\.(jpg|jpeg|png|pdf)$/i, '.png');
      formData.append('file', result.processedBlob, processedFileName);
      formData.append('originalStoragePath', uploadedImage.storagePath);

      const response = await fetch('/api/sitesketcher-v2/process-cad', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to process CAD image';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const processed = await response.json();

      setUploadedImage({
        ...uploadedImage,
        fileName: processedFileName,
        imageWidthPx: processed.imageWidthPx,
        imageHeightPx: processed.imageHeightPx,
        storagePath: processed.storagePath,
      });
      setProcessedImageUrl(processed.url);
      setShowCleanupModal(false);
      setShowCalibrationModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to process CAD image');
      console.error('Cleanup processing error:', err);
    }
  };

  const handleCalibrationComplete = async (calibration: {
    name: string;
    metresPerPixel: number;
    calibrationPoints: {
      a: { x: number; y: number };
      b: { x: number; y: number };
      distance: number;
    };
  }) => {
    if (!uploadedImage) return;

    try {
      const response = await fetch('/api/sitesketcher-v2/cads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: calibration.name,
          metresPerPixel: calibration.metresPerPixel,
          imageWidthPx: uploadedImage.imageWidthPx,
          imageHeightPx: uploadedImage.imageHeightPx,
          tmpStoragePath: uploadedImage.storagePath,
          fileName: uploadedImage.fileName,
          calibrationPoints: calibration.calibrationPoints,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save CAD to library');
      }

      const { cad } = await response.json();
      addSavedCad(cad);

      setShowCalibrationModal(false);
      setUploadedImage(null);
      setProcessedImageUrl(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save CAD to library');
      console.error('Save to library error:', err);
    }
  };

  const handlePlaceOnMap = (savedCadId: string) => {
    startCadPlacement(savedCadId);
  };

  const handleRename = async (cad: SavedCad) => {
    if (!renameValue.trim() || renameValue === cad.name) {
      setRenamingId(null);
      return;
    }

    try {
      const response = await fetch(`/api/sitesketcher-v2/cads/${cad.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: renameValue.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to rename CAD');
      }

      const { cad: updated } = await response.json();
      updateSavedCad(cad.id, { name: updated.name });
      setRenamingId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to rename CAD');
      console.error('Rename error:', err);
    }
  };

  const handleDelete = async (cad: SavedCad) => {
    if (!confirm(`Delete "${cad.name}"? This will remove it from your library.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/sitesketcher-v2/cads/${cad.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete CAD');
      }

      deleteSavedCad(cad.id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete CAD');
      console.error('Delete error:', err);
    }
  };

  const startRename = (cad: SavedCad) => {
    setRenamingId(cad.id);
    setRenameValue(cad.name);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-sm-ink mb-1">My CADs</h3>
        <p className="text-xs text-sm-ink/60">
          {savedCadsLoading
            ? 'Loading...'
            : cadPlacementInProgress
            ? 'Placing on map'
            : savedCads.length === 0
            ? 'Upload your first CAD plan'
            : `${savedCads.length} plan${savedCads.length !== 1 ? 's' : ''} • synced to your account`}
        </p>
      </div>

      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sm-violet/10 hover:bg-sm-violet/20 text-sm-violet font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Upload a CAD plan'}
        </button>
        <p className="text-[10px] text-sm-ink/40 text-center mt-1.5">
          PNG • JPG up to 50 MB
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Library Error */}
      {savedCadsError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
          <p className="font-medium">CAD library failed to load</p>
          <p className="mt-1 text-red-600/80">{savedCadsError}</p>
        </div>
      )}

      {/* CAD Library */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-sm-ink uppercase tracking-wide">
            MY CADS {savedCads.length > 0 && savedCads.length}
          </h4>
          <button className="text-xs text-sm-ink/60 hover:text-sm-ink">Recent</button>
        </div>

        <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
          {savedCads.map((cad) => (
            <div
              key={cad.id}
              className={clsx(
                'group relative bg-sm-surface border rounded-lg overflow-hidden transition-all',
                cadPlacementInProgress &&
                  typeof cadPlacementInProgress === 'object' &&
                  cadPlacementInProgress.savedCadId === cad.id
                  ? 'border-sm-violet ring-2 ring-sm-violet/20'
                  : 'border-sm-border hover:border-sm-violet/40'
              )}
            >
              {/* Thumbnail */}
              <div className="relative h-20 bg-sm-bg overflow-hidden">
                <img
                  src={cad.url}
                  alt={cad.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <DropdownMenu
                    align="right"
                    items={[
                      {
                        label: 'Rename',
                        icon: <Edit className="w-4 h-4" />,
                        onClick: () => startRename(cad),
                      },
                      {
                        label: 'Delete',
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: () => handleDelete(cad),
                        variant: 'danger',
                      },
                    ]}
                  />
                </div>
              </div>

              {/* Card Content */}
              <div className="p-3 space-y-2">
                {/* Name */}
                {renamingId === cad.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(cad)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(cad);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                    className="w-full px-2 py-1 text-sm font-medium bg-sm-bg border border-sm-border rounded focus:outline-none focus:ring-2 focus:ring-sm-violet"
                  />
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-sm font-medium text-sm-ink line-clamp-1">{cad.name}</h5>
                    <div className="flex-shrink-0 flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      <Check className="w-3 h-3" />
                      <span>CALIBRATED</span>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-[10px] text-sm-ink/50 space-y-0.5">
                  <div>
                    {cad.imageWidthPx} × {cad.imageHeightPx} • {cad.imageWidthPx} × {cad.imageHeightPx} px
                  </div>
                </div>

                {/* Place Button */}
                <Button
                  onClick={() => handlePlaceOnMap(cad.id)}
                  variant={
                    cadPlacementInProgress &&
                    typeof cadPlacementInProgress === 'object' &&
                    cadPlacementInProgress.savedCadId === cad.id
                      ? 'primary'
                      : 'secondary'
                  }
                  size="sm"
                  className="w-full"
                >
                  {cadPlacementInProgress &&
                  typeof cadPlacementInProgress === 'object' &&
                  cadPlacementInProgress.savedCadId === cad.id
                    ? 'Click map to drop'
                    : 'Place on map'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {!savedCadsLoading && savedCads.length === 0 && !savedCadsError && (
          <div className="text-center py-8 text-sm text-sm-ink/50">
            <p>No CAD plans yet</p>
            <p className="text-xs mt-1">Upload your first plan to get started</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCleanupModal && uploadedImage && (
        <CleanupModal
          imageUrl={uploadedImage.url}
          imageWidthPx={uploadedImage.imageWidthPx}
          imageHeightPx={uploadedImage.imageHeightPx}
          fileName={uploadedImage.fileName}
          onComplete={handleCleanupComplete}
          onSkip={() => {
            setShowCleanupModal(false);
            setShowCalibrationModal(true);
          }}
          onCancel={() => {
            setShowCleanupModal(false);
            setUploadedImage(null);
          }}
        />
      )}

      {showCalibrationModal && uploadedImage && (
        <CalibrationModal
          imageUrl={processedImageUrl || uploadedImage.url}
          imageWidthPx={uploadedImage.imageWidthPx}
          imageHeightPx={uploadedImage.imageHeightPx}
          fileName={uploadedImage.fileName}
          onComplete={handleCalibrationComplete}
          onCancel={() => {
            setShowCalibrationModal(false);
            setUploadedImage(null);
          }}
        />
      )}
    </div>
  );
}
