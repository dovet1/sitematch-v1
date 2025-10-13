'use client';

import { Box, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ViewMode } from '@/types/sitesketcher';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onToggle: () => void;
  className?: string;
}

export function ViewModeToggle({ viewMode, onToggle, className = '' }: ViewModeToggleProps) {
  const is3D = viewMode === '3D';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700">View Mode</label>
      <Button
        onClick={onToggle}
        variant={is3D ? 'default' : 'outline'}
        className="w-full justify-start gap-2"
        size="sm"
      >
        {is3D ? (
          <>
            <Layers3 className="h-4 w-4" />
            3D View
          </>
        ) : (
          <>
            <Box className="h-4 w-4" />
            2D View
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        {is3D ? 'Perspective view with 3D buildings' : 'Top-down flat view'}
      </p>
    </div>
  );
}
