'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Segmented, SegmentedOption } from '../primitives/Segmented';
import { X } from 'lucide-react';

interface CalibrationModalProps {
  imageUrl: string;
  imageWidthPx: number;
  imageHeightPx: number;
  fileName: string;
  initialName?: string;
  onComplete: (calibration: {
    name: string;
    metresPerPixel: number;
    calibrationPoints: {
      a: { x: number; y: number };
      b: { x: number; y: number };
      distance: number;
    };
  }) => void;
  onCancel: () => void;
}

export function CalibrationModal({
  imageUrl,
  imageWidthPx,
  imageHeightPx,
  fileName,
  initialName,
  onComplete,
  onCancel,
}: CalibrationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Default name: fileName without extension
  const defaultName = initialName || fileName.replace(/\.[^/.]+$/, '');

  const [name, setName] = useState(defaultName);
  const [pointA, setPointA] = useState<{ x: number; y: number } | null>(null);
  const [pointB, setPointB] = useState<{ x: number; y: number } | null>(null);
  const [knownDistance, setKnownDistance] = useState('30');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageScale, setImageScale] = useState(1); // CRITICAL: Store scale factor for coordinate conversion

  const unitOptions: SegmentedOption<'metric' | 'imperial'>[] = [
    { value: 'metric', label: 'Metres' },
    { value: 'imperial', label: 'Feet' },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Scale image to fit canvas while maintaining aspect ratio
      const maxWidth = 600;
      const maxHeight = 400;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setImageLoaded(true);
      setImageScale(scale); // CRITICAL: Store scale for coordinate conversion

      // Draw points if they exist
      if (pointA) {
        ctx.fillStyle = '#7033FF';
        ctx.beginPath();
        ctx.arc(pointA.x, pointA.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (pointB) {
        ctx.fillStyle = '#7033FF';
        ctx.beginPath();
        ctx.arc(pointB.x, pointB.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw line between points
      if (pointA && pointB) {
        ctx.strokeStyle = '#7033FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pointA.x, pointA.y);
        ctx.lineTo(pointB.x, pointB.y);
        ctx.stroke();
      }
    };
    img.src = imageUrl;
  }, [imageUrl, pointA, pointB]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!pointA) {
      setPointA({ x, y });
    } else if (!pointB) {
      setPointB({ x, y });
    } else {
      // Reset and start over
      setPointA({ x, y });
      setPointB(null);
    }
  };

  const handleConfirm = () => {
    if (!pointA || !pointB || !knownDistance || !name.trim()) return;

    const distance = parseFloat(knownDistance);
    if (isNaN(distance) || distance <= 0) return;

    // CRITICAL: Convert canvas coordinates to original image coordinates
    const originalPointA = {
      x: pointA.x / imageScale,
      y: pointA.y / imageScale,
    };
    const originalPointB = {
      x: pointB.x / imageScale,
      y: pointB.y / imageScale,
    };

    // Calculate pixel distance in ORIGINAL image coordinates
    const dx = originalPointB.x - originalPointA.x;
    const dy = originalPointB.y - originalPointA.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    // Convert to metres
    const knownDistanceMetres = units === 'imperial'
      ? distance / 3.28084
      : distance;

    // Calculate scale
    const metresPerPixel = knownDistanceMetres / pixelDistance;

    onComplete({
      name: name.trim(),
      metresPerPixel,
      calibrationPoints: {
        a: originalPointA, // Store original coordinates
        b: originalPointB,
        distance: knownDistanceMetres,
      },
    });
  };

  const canConfirm = name.trim() && pointA && pointB && knownDistance && parseFloat(knownDistance) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-sm-surface border border-sm-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-sm-border">
          <div>
            <h2 className="text-lg font-semibold text-sm-ink">Calibrate CAD Image</h2>
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
            <label className="text-xs font-medium text-sm-ink block mb-2">
              CAD Name *
            </label>
            <Input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Site Plan A"
              autoFocus
            />
          </div>

          <div>
            <p className="text-sm text-sm-ink mb-3">
              Click two points on the image with a known distance between them.
            </p>
            <div className="border border-sm-border rounded-lg overflow-hidden bg-sm-bg">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="cursor-crosshair max-w-full"
                style={{ display: 'block', margin: '0 auto' }}
              />
            </div>
            {!imageLoaded && (
              <div className="text-sm text-sm-ink/50 text-center py-8">
                Loading image...
              </div>
            )}
          </div>

          {pointA && pointB && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-sm-ink block mb-2">
                    Known Distance
                  </label>
                  <Input
                    type="number"
                    value={knownDistance}
                    onChange={(event) => setKnownDistance(event.target.value)}
                    placeholder="e.g. 30"
                    min={0}
                    step={0.1}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-sm-ink block mb-2">
                    Unit
                  </label>
                  <Segmented
                    options={unitOptions}
                    value={units}
                    onChange={setUnits}
                    fullWidth
                  />
                </div>
              </div>

              {canConfirm && (
                <div className="p-3 bg-sm-violet-tint-soft border border-sm-violet/20 rounded">
                  <div className="text-xs text-sm-ink/70">
                    The image will be calibrated using the {knownDistance} {units === 'metric' ? 'metre' : 'foot'} reference distance you specified.
                  </div>
                </div>
              )}
            </div>
          )}

          {!pointA && (
            <div className="text-sm text-sm-ink/50 text-center py-2">
              Click the first point on the image
            </div>
          )}

          {pointA && !pointB && (
            <div className="text-sm text-sm-ink/50 text-center py-2">
              Click the second point on the image
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-sm-border">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Confirm Calibration
          </Button>
        </div>
      </div>
    </div>
  );
}
