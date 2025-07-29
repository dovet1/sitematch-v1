'use client';

import { Undo2, Redo2, Trash2 } from 'lucide-react';
import { TouchOptimizedButton } from './TouchOptimizedButton';
import { cn } from '@/lib/utils';

interface MobileControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  className?: string;
}

export function MobileControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
  className
}: MobileControlsProps) {
  const handleClearAll = () => {
    onClearAll();
  };

  return (
    <div className={cn(
      "fixed bottom-24 right-4 z-40 flex flex-col gap-2 md:hidden",
      className
    )}>
      <TouchOptimizedButton
        variant="secondary"
        onClick={onUndo}
        disabled={!canUndo}
        className="bg-white shadow-lg"
        minSize={48}
        visualFeedback="scale"
      >
        <Undo2 className="h-5 w-5" />
      </TouchOptimizedButton>
      
      <TouchOptimizedButton
        variant="secondary"
        onClick={onRedo}
        disabled={!canRedo}
        className="bg-white shadow-lg"
        minSize={48}
        visualFeedback="scale"
      >
        <Redo2 className="h-5 w-5" />
      </TouchOptimizedButton>
      
      <div className="border-t pt-2 mt-2">
        <TouchOptimizedButton
          variant="destructive"
          onClick={handleClearAll}
          className="bg-white text-destructive border-destructive shadow-lg"
          minSize={48}
          visualFeedback="scale"
        >
          <Trash2 className="h-5 w-5" />
        </TouchOptimizedButton>
      </div>
    </div>
  );
}