'use client';

import { useState, useRef } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button } from '../primitives/Button';
import { DropdownMenu } from '../primitives/DropdownMenu';
import { Upload, Check, AlertCircle, Edit, RotateCcw, Trash2, Layers } from 'lucide-react';
import { CalibrationModal } from '../modals/CalibrationModal';
import { CadUpgradeModal } from '../modals/CadUpgradeModal';
import type { CadImage, SavedCad } from '@/types/sitesketcher-v2';
import { clsx } from 'clsx';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const DEFAULT_BG_THRESHOLD = 245;
const DEFAULT_CROP_PADDING = 20;

interface UploadResult {
  id: string;
  fileName: string;
  url: string;
  storagePath: string;
  imageWidthPx: number;
  imageHeightPx: number;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load CAD image for cleanup'));
    image.src = url;
  });

const calculateAutoCropBounds = (
  imageData: ImageData,
  width: number,
  height: number,
  padding: number
): CropRect => {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hasContent = false;

  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        hasContent = true;
      }
    }
  }

  if (!hasContent) {
    return { x: 0, y: 0, width, height };
  }

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + padding * 2);

  return {
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight,
  };
};

const createDefaultCleanedCadBlob = async (imageUrl: string) => {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create canvas context');

  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r > DEFAULT_BG_THRESHOLD && g > DEFAULT_BG_THRESHOLD && b > DEFAULT_BG_THRESHOLD) {
      data[i + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);

  const cropRect = calculateAutoCropBounds(
    imageData,
    image.width,
    image.height,
    DEFAULT_CROP_PADDING
  );

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = cropRect.width;
  finalCanvas.height = cropRect.height;

  const finalContext = finalCanvas.getContext('2d');
  if (!finalContext) throw new Error('Could not create final canvas context');

  finalContext.drawImage(
    canvas,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height
  );

  const processedBlob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create processed CAD image'));
    }, 'image/png');
  });

  return {
    processedBlob,
    newWidthPx: cropRect.width,
    newHeightPx: cropRect.height,
  };
};

export function CadToolPanel() {
  const { hasProAccess, hasPlusAccess, billingInterval } = useSubscriptionTier();
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
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal flow state
  const [uploadedImage, setUploadedImage] = useState<UploadResult | null>(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // CAD upgrade modal state
  const [showCadUpgradeModal, setShowCadUpgradeModal] = useState(false);

  // Show upgrade modal for non-Plus users
  if (!hasPlusAccess) {
    return (
      <>
        <div className="p-4 space-y-4">
          <div className="p-6 bg-[#F5F1FF] border border-[rgba(112,51,255,0.2)] rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-white rounded">
                <Layers className="w-5 h-5 text-[#7033FF]" />
              </div>
              <div>
                <h3 className="text-sm font-[600] text-[#171419] mb-1">
                  CAD Overlay is Plus Only
                </h3>
                <p className="text-xs text-[#171419]/70 leading-relaxed">
                  Upload CAD drawings and site plans, calibrate the scale, and overlay them on your sketches
                  with adjustable opacity.
                </p>
              </div>
            </div>

            {hasProAccess ? (
              <Button
                onClick={() => setShowCadUpgradeModal(true)}
                variant="primary"
                className="w-full bg-[#7033FF] hover:bg-[#5421CC] text-white"
              >
                Upgrade to Plus
              </Button>
            ) : (
              <Button
                onClick={() => (window.location.href = '/settings/billing?upgrade=plus')}
                variant="primary"
                className="w-full bg-[#7033FF] hover:bg-[#5421CC] text-white"
              >
                Upgrade to Plus
              </Button>
            )}
          </div>
        </div>

        {showCadUpgradeModal && hasProAccess && (
          <CadUpgradeModal
            onClose={() => setShowCadUpgradeModal(false)}
            billingInterval={billingInterval || 'month'}
          />
        )}
      </>
    );
  }

  const uploadFile = async (file: File) => {
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
      await processUploadedImage(result);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await uploadFile(file);
  };

  const processUploadedImage = async (image: UploadResult) => {
    try {
      const result = await createDefaultCleanedCadBlob(image.url);
      const formData = new FormData();
      const processedFileName = image.fileName.replace(/\.(jpg|jpeg|png|pdf)$/i, '.png');
      formData.append('file', result.processedBlob, processedFileName);
      formData.append('originalStoragePath', image.storagePath);

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
        ...image,
        fileName: processedFileName,
        imageWidthPx: processed.imageWidthPx,
        imageHeightPx: processed.imageHeightPx,
        storagePath: processed.storagePath,
      });
      setProcessedImageUrl(processed.url);
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
      {/* Upload Dropzone */}
      <div className="space-y-3">
        <p className="text-xs leading-5 text-sm-ink/60">
          Upload a CAD or site plan image (PNG/JPG) to overlay on the map. You&apos;ll
          calibrate the scale after upload.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            const nextTarget = e.relatedTarget as Node | null;
            if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
          disabled={uploading}
          className={clsx(
            'w-full min-h-[184px] rounded-2xl border-2 border-dashed px-4 py-6',
            'flex flex-col items-center justify-center text-center transition-colors',
            'bg-white border-[#ded8cf] hover:bg-[#f7f2ff] hover:border-[#c6a4ff] focus-ring',
            uploading && 'cursor-not-allowed opacity-60',
            isDragging && !uploading && 'bg-[#f7f2ff] border-[#c6a4ff]'
          )}
        >
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#eadcff] text-[#6d38ff]">
            <Upload className="h-5 w-5" />
          </span>
          <span className="text-xs font-semibold text-sm-ink">
            {uploading ? 'Preparing CAD...' : 'Drop CAD image here'}
          </span>
          <span className="mt-3 text-xs text-[#8b8494]">
            or click to browse
          </span>
          <span className="mt-4 text-[10px] leading-none text-[#aaa3b2]">
            PNG or JPG, max 50MB
          </span>
        </button>
      </div>

      <div className="border-t border-sm-border" />

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
                'group relative bg-sm-surface border rounded-lg overflow-visible transition-all',
                cadPlacementInProgress &&
                  typeof cadPlacementInProgress === 'object' &&
                  cadPlacementInProgress.savedCadId === cad.id
                  ? 'border-sm-violet ring-2 ring-sm-violet/20'
                  : 'border-sm-border hover:border-sm-violet/40'
              )}
            >
              {/* Thumbnail */}
              <div className="relative h-20 bg-sm-bg overflow-visible">
                <img
                  src={cad.url}
                  alt={cad.name}
                  className="w-full h-full object-cover rounded-t-lg"
                />
                <div className="absolute top-2 right-2 z-[110]">
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
