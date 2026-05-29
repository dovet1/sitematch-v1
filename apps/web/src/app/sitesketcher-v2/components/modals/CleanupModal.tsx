'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../primitives/Button';
import { X } from 'lucide-react';

const DEFAULT_BG_THRESHOLD = 245;
const DEFAULT_CROP_PADDING = 20;
const MIN_CROP_SIZE = 10;

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

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
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

  const [manualCropEnabled, setManualCropEnabled] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [cropDragStart, setCropDragStart] = useState<{ x: number; y: number } | null>(null);

  // Manual crop state
  const [cropRect, setCropRect] = useState<CropRect>({
    x: 0,
    y: 0,
    width: imageWidthPx,
    height: imageHeightPx,
  });

  // Store original image
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const previewScaleRef = useRef(1);

  // Use ref to access cropRect in manual mode without causing re-renders
  const cropRectRef = useRef(cropRect);
  cropRectRef.current = cropRect;

  const clampCropRect = useCallback((rect: CropRect, width: number, height: number): CropRect => {
    const x = Math.max(0, Math.min(Math.round(rect.x), width - MIN_CROP_SIZE));
    const y = Math.max(0, Math.min(Math.round(rect.y), height - MIN_CROP_SIZE));

    return {
      x,
      y,
      width: Math.max(MIN_CROP_SIZE, Math.min(Math.round(rect.width), width - x)),
      height: Math.max(MIN_CROP_SIZE, Math.min(Math.round(rect.height), height - y)),
    };
  }, []);

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

  const createProcessedCanvas = useCallback((img: HTMLImageElement) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    tempCtx.drawImage(img, 0, 0);

    // Apply background removal
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r > DEFAULT_BG_THRESHOLD && g > DEFAULT_BG_THRESHOLD && b > DEFAULT_BG_THRESHOLD) {
        data[i + 3] = 0;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);
    return { tempCanvas, imageData };
  }, []);

  const getCanvasImagePoint = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = img.width / rect.width;
    const scaleY = img.height / rect.height;

    return {
      x: Math.max(0, Math.min(img.width, (event.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(img.height, (event.clientY - rect.top) * scaleY)),
    };
  }, []);

  const drawManualCropOverlay = useCallback((
    ctx: CanvasRenderingContext2D,
    rect: CropRect,
    scale: number
  ) => {
    const x = rect.x * scale;
    const y = rect.y * scale;
    const width = rect.width * scale;
    const height = rect.height * scale;

    ctx.save();
    ctx.fillStyle = 'rgba(11, 11, 11, 0.42)';
    ctx.fillRect(0, 0, ctx.canvas.width, y);
    ctx.fillRect(0, y + height, ctx.canvas.width, ctx.canvas.height - y - height);
    ctx.fillRect(0, y, x, height);
    ctx.fillRect(x + width, y, ctx.canvas.width - x - width, height);

    ctx.strokeStyle = '#7033FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = '#7033FF';
    const handleSize = 8;
    const handles = [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ];
    handles.forEach(([handleX, handleY]) => {
      ctx.fillRect(handleX - handleSize / 2, handleY - handleSize / 2, handleSize, handleSize);
    });
    ctx.restore();
  }, []);

  const drawProcessedImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = originalImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const processed = createProcessedCanvas(img);
    if (!processed) return;

    const { tempCanvas, imageData } = processed;
    const scale = previewScaleRef.current;

    if (manualCropEnabled) {
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(showOriginal ? img : tempCanvas, 0, 0, canvas.width, canvas.height);
      drawManualCropOverlay(ctx, clampCropRect(cropRectRef.current, img.width, img.height), scale);
      return;
    }

    const finalCropRect = calculateAutoCropBounds(
      imageData,
      img.width,
      img.height,
      DEFAULT_CROP_PADDING
    );

    setCropRect(prev => {
      if (prev.x !== finalCropRect.x || prev.y !== finalCropRect.y ||
          prev.width !== finalCropRect.width || prev.height !== finalCropRect.height) {
        return finalCropRect;
      }
      return prev;
    });

    canvas.width = finalCropRect.width * scale;
    canvas.height = finalCropRect.height * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      showOriginal ? img : tempCanvas,
      finalCropRect.x,
      finalCropRect.y,
      finalCropRect.width,
      finalCropRect.height,
      0,
      0,
      finalCropRect.width * scale,
      finalCropRect.height * scale
    );
  }, [
    showOriginal,
    manualCropEnabled,
    calculateAutoCropBounds,
    clampCropRect,
    createProcessedCanvas,
    drawManualCropOverlay,
  ]);

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
      previewScaleRef.current = scale;

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

  const handleManualCropToggle = (enabled: boolean) => {
    setManualCropEnabled(enabled);
    setIsDraggingCrop(false);
    setCropDragStart(null);
  };

  const handleCropPointerDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!manualCropEnabled || showOriginal || processing) return;

    const point = getCanvasImagePoint(event);
    if (!point) return;

    setCropDragStart(point);
    setCropRect({
      x: point.x,
      y: point.y,
      width: MIN_CROP_SIZE,
      height: MIN_CROP_SIZE,
    });
    setIsDraggingCrop(true);
  };

  const handleCropPointerMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!manualCropEnabled || !isDraggingCrop || !cropDragStart) return;

    const point = getCanvasImagePoint(event);
    if (!point) return;

    const img = originalImageRef.current;
    if (!img) return;

    const x = Math.round(Math.min(cropDragStart.x, point.x));
    const y = Math.round(Math.min(cropDragStart.y, point.y));
    const width = Math.round(Math.max(MIN_CROP_SIZE, Math.abs(point.x - cropDragStart.x)));
    const height = Math.round(Math.max(MIN_CROP_SIZE, Math.abs(point.y - cropDragStart.y)));

    setCropRect(clampCropRect({ x, y, width, height }, img.width, img.height));
  };

  const handleCropPointerUp = () => {
    setIsDraggingCrop(false);
    setCropDragStart(null);
  };

  const handleNext = async () => {
    const img = originalImageRef.current;
    if (!img) return;

    setProcessing(true);
    try {
      const processed = createProcessedCanvas(img);
      if (!processed) throw new Error('Could not create canvas context');

      // Calculate final crop bounds
      let finalCropRect = clampCropRect(cropRect, img.width, img.height);
      if (!manualCropEnabled) {
        finalCropRect = calculateAutoCropBounds(
          processed.imageData,
          img.width,
          img.height,
          DEFAULT_CROP_PADDING
        );
      }

      // Create final cropped canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = finalCropRect.width;
      finalCanvas.height = finalCropRect.height;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) throw new Error('Could not create final canvas context');

      finalCtx.drawImage(
        processed.tempCanvas,
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
                onMouseDown={handleCropPointerDown}
                onMouseMove={handleCropPointerMove}
                onMouseUp={handleCropPointerUp}
                onMouseLeave={handleCropPointerUp}
                className={manualCropEnabled && !showOriginal ? 'max-w-full cursor-crosshair' : 'max-w-full'}
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
                  variant={showOriginal ? 'ghost' : 'primary'}
                  onClick={() => setShowOriginal(false)}
                  size="sm"
                >
                  Processed
                </Button>
                <Button
                  variant={showOriginal ? 'primary' : 'ghost'}
                  onClick={() => setShowOriginal(true)}
                  size="sm"
                >
                  Original
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="manual-crop"
                  checked={manualCropEnabled}
                  onChange={(e) => handleManualCropToggle(e.target.checked)}
                  className="rounded border-sm-border"
                />
                <label htmlFor="manual-crop" className="text-sm text-sm-ink cursor-pointer">
                  Crop manually
                </label>
              </div>

              {manualCropEnabled && (
                <p className="text-xs text-sm-ink/50">
                  Drag over the cleaned image to keep only the store plan area.
                </p>
              )}

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
