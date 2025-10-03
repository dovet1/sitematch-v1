'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Square } from 'lucide-react';
import type { MeasurementUnit } from '@/types/sitesketcher';

interface RectangleDimensionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (width: number, length: number) => void;
  measurementUnit: MeasurementUnit;
}

export function RectangleDimensionsModal({
  isOpen,
  onClose,
  onSubmit,
  measurementUnit
}: RectangleDimensionsModalProps) {
  const [width, setWidth] = useState<string>('10');
  const [length, setLength] = useState<string>('20');

  const unitLabel = measurementUnit === 'metric' ? 'm' : 'ft';
  const unitName = measurementUnit === 'metric' ? 'meters' : 'feet';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const widthNum = parseFloat(width);
    const lengthNum = parseFloat(length);

    if (isNaN(widthNum) || isNaN(lengthNum) || widthNum <= 0 || lengthNum <= 0) {
      alert('Please enter valid positive numbers for width and length');
      return;
    }

    onSubmit(widthNum, lengthNum);
    onClose();

    // Reset to defaults for next time
    setWidth('10');
    setLength('20');
  };

  const handleCancel = () => {
    onClose();
    // Reset to defaults
    setWidth('10');
    setLength('20');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Square className="h-5 w-5 text-primary" />
            Add Rectangle
          </DialogTitle>
          <DialogDescription>
            Enter the dimensions for your rectangle in {unitName}. Click on the map to place it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="width">
              Width ({unitLabel})
            </Label>
            <Input
              id="width"
              type="number"
              step="0.1"
              min="0.1"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder={`Enter width in ${unitName}`}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="length">
              Length ({unitLabel})
            </Label>
            <Input
              id="length"
              type="number"
              step="0.1"
              min="0.1"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder={`Enter length in ${unitName}`}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              Add to Map
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
