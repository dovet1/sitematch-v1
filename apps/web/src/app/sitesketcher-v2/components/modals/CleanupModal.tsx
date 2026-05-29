'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../primitives/Button';
import { Slider } from '../primitives/Slider';
import { X } from 'lucide-react';

interface CleanupModalProps {
  imageUrl: string;
  imageWidthPx: number;
  imageHeightPx: number;
  fileName: string;
  onComplete: (result: {
    processedBlob: Blob;
    newWidthPx: number;
    newHeightPx: number;
  }) => Promise<void>;
  onSkip: () => void;
  onCancel: () => void;
}

export function CleanupModal({
  imageUrl,
  imageWidthPx,
  imageHeightPx,
  fileName,
  onComplete,
  onSkip,
  onCancel,
}: CleanupModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Processing settings
  const [bgThreshold, setBgThreshold] = useState(245);
  const [cropPadding, setCropPadding] = useState(20);
  const [manualCropEnabled, setManualCropEnabled] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Manual crop state
  const [cropRect, setCropRect] = useState({
    x: 0,
    y: 0,
    width: imageWidthPx,
    height: imageHeightPx,
  });

  // Store original image
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  // Use ref to access cropRect in manual mode without causing re-renders
  const cropRectRef = useRef(cropRect);
  cropRectRef.current = cropRect;

  const calculateAutoCropBounds = useCallback((
    imageData: ImageData,
    width: number,
    height: number,
    padding: number
  ) => {
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
  }, []);

  const drawProcessedImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showOriginal) {
      // Show original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return;
    }

    // Draw image to temp canvas at full size for processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.drawImage(img, 0, 0);

    // Apply background removal
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // If pixel is above threshold (white-ish), make transparent
      if (r > bgThreshold && g > bgThreshold && b > bgThreshold) {
        data[i + 3] = 0;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    // Calculate crop bounds
    let finalCropRect;
    if (!manualCropEnabled) {
      finalCropRect = calculateAutoCropBounds(imageData, img.width, img.height, cropPadding);
      // Update crop rect state for dimensions display (use functional update to avoid dependency)
      setCropRect(prev => {
        // Only update if values actually changed to prevent unnecessary re-renders
        if (prev.x !== finalCropRect.x || prev.y !== finalCropRect.y ||
            prev.width !== finalCropRect.width || prev.height !== finalCropRect.height) {
          return finalCropRect;
        }
        return prev;
      });
    } else {
      // Use current manual crop rect from ref
      finalCropRect = cropRectRef.current;
    }

    // Draw cropped result to display canvas (scaled)
    const scale = canvas.width / img.width;
    ctx.drawImage(
      tempCanvas,
      finalCropRect.x,
      finalCropRect.y,
      finalCropRect.width,
      finalCropRect.height,
      0,
      0,
      finalCropRect.width * scale,
      finalCropRect.height * scale
    );
  }, [showOriginal, bgThreshold, cropPadding, manualCropEnabled, calculateAutoCropBounds]);

  // Load and draw image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous'; // CRITICAL: Prevent canvas tainting
    img.onload = () => {
      originalImageRef.current = img;

      // Scale preview to max 800px for performance
      const maxPreview = 800;
      const scale = Math.min(1, maxPreview / Math.max(img.width, img.height));

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Redraw when settings change
  useEffect(() => {
    if (imageLoaded) {
      drawProcessedImage();
    }
  }, [imageLoaded, drawProcessedImage]);

  const handleNext = async () => {
    const img = originalImageRef.current;
    if (!img) return;

    setProcessing(true);
    try {
      // Create final processed image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not create canvas context');

      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      tempCtx.drawImage(img, 0, 0);

      // Apply background removal
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r > bgThreshold && g > bgThreshold && b > bgThreshold) {
          data[i + 3] = 0;
        }
      }

      tempCtx.putImageData(imageData, 0, 0);

      // Calculate final crop bounds
      let finalCropRect = cropRect;
      if (!manualCropEnabled) {
        finalCropRect = calculateAutoCropBounds(imageData, img.width, img.height, cropPadding);
      }

      // Create final cropped canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = finalCropRect.width;
      finalCanvas.height = finalCropRect.height;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) throw new Error('Could not create final canvas context');

      finalCtx.drawImage(
        tempCanvas,
        finalCropRect.x,
        finalCropRect.y,
        finalCropRect.width,
        finalCropRect.height,
        0,
        0,
        finalCropRect.width,
        finalCropRect.height
      );

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        finalCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      await onComplete({
        processedBlob: blob,
        newWidthPx: finalCropRect.width,
        newHeightPx: finalCropRect.height,
      });
    } catch (error) {
      console.error('Processing error:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-sm-surface border border-sm-border rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-sm-border">
          <div>
            <h2 className="text-lg font-semibold text-sm-ink">Clean Up CAD Image</h2>
            <p className="text-xs text-sm-ink/60 mt-0.5">{fileName}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-sm-bg rounded transition-colors"
          >
            <X className="w-5 h-5 text-sm-ink/60" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="border border-sm-border rounded-lg overflow-hidden bg-sm-bg">
              <canvas
                ref={canvasRef}
                className="max-w-full"
                style={{ display: 'block', margin: '0 auto' }}
              />
            </div>
            {!imageLoaded && (
              <div className="text-sm text-sm-ink/50 text-center py-8">
                Loading image...
              </div>
            )}
          </div>

          {imageLoaded && (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant={showOriginal ? 'ghost' : 'default'}
                  onClick={() => setShowOriginal(false)}
                  size="sm"
                >
                  Processed
                </Button>
                <Button
                  variant={showOriginal ? 'default' : 'ghost'}
                  onClick={() => setShowOriginal(true)}
                  size="sm"
                >
                  Original
                </Button>
              </div>

              <div>
                <label className="text-xs font-medium text-sm-ink block mb-2">
                  Background Threshold
                </label>
                <Slider
                  value={bgThreshold}
                  onChange={setBgThreshold}
                  min={200}
                  max={255}
                  step={1}
                />
                <p className="text-xs text-sm-ink/50 mt-1">
                  Pixels brighter than this value will be made transparent
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-sm-ink block mb-2">
                  Crop Padding
                </label>
                <Slider
                  value={cropPadding}
                  onChange={setCropPadding}
                  min={0}
                  max={100}
                  step={5}
                  suffix="px"
                  disabled={manualCropEnabled}
                />
                <p className="text-xs text-sm-ink/50 mt-1">
                  Extra space to keep around the detected content
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="manual-crop"
                  checked={manualCropEnabled}
                  onChange={(e) => setManualCropEnabled(e.target.checked)}
                  className="rounded border-sm-border"
                />
                <label htmlFor="manual-crop" className="text-sm text-sm-ink cursor-pointer">
                  Enable manual crop (coming soon)
                </label>
              </div>

              <div className="p-3 bg-sm-violet-tint-soft border border-sm-violet/20 rounded">
                <div className="text-xs text-sm-ink/70">
                  Processed dimensions: {cropRect.width} × {cropRect.height} px
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-sm-border">
          <Button variant="ghost" onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={onSkip} disabled={processing}>
            Skip Cleanup
          </Button>
          <Button onClick={handleNext} disabled={!imageLoaded || processing}>
            {processing ? 'Processing...' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
