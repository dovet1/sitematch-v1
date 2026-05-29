'use client';

import { useState, useRef } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button } from '../primitives/Button';
import { Upload, FileImage } from 'lucide-react';
import { CleanupModal } from '../modals/CleanupModal';
import { CalibrationModal } from '../modals/CalibrationModal';
import type { CadImage } from '@/types/sitesketcher-v2';

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
  const { cadImages, addCadImage, mapInstance } = useSketchStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal flow state
  const [uploadedImage, setUploadedImage] = useState<UploadResult | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

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
      setShowCleanupModal(true); // Open cleanup modal

      // Reset file input
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
      // Upload processed blob to Supabase
      const formData = new FormData();
      // CRITICAL: Use .png filename for processed file (cleanup always outputs PNG)
      const processedFileName = uploadedImage.fileName.replace(/\.(jpg|jpeg|png|pdf)$/i, '.png');
      formData.append('file', result.processedBlob, processedFileName);
      formData.append('originalStoragePath', uploadedImage.storagePath);

      const response = await fetch('/api/sitesketcher-v2/process-cad', {
        method: 'POST',
        body: formData,
      });

      // CRITICAL: Check response.ok before parsing
      if (!response.ok) {
        let errorMessage = 'Failed to process CAD image';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default message
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const processed = await response.json();

      // CRITICAL: Use SERVER-VERIFIED dimensions, not client-reported
      // Also update storagePath and fileName since cleanup creates new .png file
      setUploadedImage({
        ...uploadedImage,
        fileName: processedFileName, // Updated to .png extension
        imageWidthPx: processed.imageWidthPx,
        imageHeightPx: processed.imageHeightPx,
        storagePath: processed.storagePath, // Updated path (.png extension)
      });
      setProcessedImageUrl(processed.url);
      setShowCleanupModal(false);
      setShowCalibrationModal(true); // Open calibration modal
    } catch (err: any) {
      setError(err.message || 'Failed to process CAD image');
      console.error('Cleanup processing error:', err);
      // Keep cleanup modal open so user can retry or cancel
    }
  };

  const handleCalibrationComplete = (calibration: {
    metresPerPixel: number;
    calibrationPoints: {
      a: { x: number; y: number };
      b: { x: number; y: number };
      distance: number;
    };
  }) => {
    if (!uploadedImage || !mapInstance) return;

    const cadImage: CadImage = {
      id: crypto.randomUUID(),
      fileName: uploadedImage.fileName,
      url: processedImageUrl || uploadedImage.url,
      storagePath: uploadedImage.storagePath,
      metresPerPixel: calibration.metresPerPixel,
      anchor: null, // Start unplaced - user will click to place
      rotation: 0,
      opacity: 0.6,
      imageWidthPx: uploadedImage.imageWidthPx,
      imageHeightPx: uploadedImage.imageHeightPx,
      calibrationPoints: calibration.calibrationPoints,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    addCadImage(cadImage);
    setShowCalibrationModal(false);
    setUploadedImage(null);
    setProcessedImageUrl(null);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs text-sm-ink/60 mb-4">
          Upload a CAD or site plan image (PNG/JPG) to overlay on the map. You'll calibrate the scale after upload.
        </p>
      </div>

      {cadImages.length === 0 ? (
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
            className="w-full p-6 border-2 border-dashed border-sm-border rounded-lg hover:border-sm-violet/40 hover:bg-sm-violet/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-sm-violet/10 rounded-full">
                <Upload className="w-5 h-5 text-sm-violet" />
              </div>
              <div className="text-sm font-medium text-sm-ink">
                {uploading ? 'Uploading...' : 'Drop CAD image here'}
              </div>
              <div className="text-xs text-sm-ink/50">
                or click to browse
              </div>
              <div className="text-[10px] text-sm-ink/40 mt-1">
                PNG or JPG, max 50MB
              </div>
            </div>
          </button>

          {error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-medium text-sm-ink mb-2">
            Uploaded Images ({cadImages.length})
          </div>
          {cadImages.map((cad) => (
            <div
              key={cad.id}
              className="flex items-center gap-2 p-2 bg-sm-bg border border-sm-border rounded"
            >
              <FileImage className="w-4 h-4 text-sm-ink/50 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-sm-ink truncate">{cad.fileName}</div>
                <div className="text-[10px] text-sm-ink/50">
                  {new Date(cad.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full mt-2"
            size="sm"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload Another
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-sm-border">
        <h4 className="text-xs font-medium text-sm-ink mb-2">Shortcuts</h4>
        <ul className="space-y-1 text-xs text-sm-ink/60">
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              C
            </kbd>{' '}
            CAD tool
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              V
            </kbd>{' '}
            Switch to select
          </li>
        </ul>
      </div>

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
            // Delete uploaded file
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
