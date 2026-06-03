'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { X } from 'lucide-react';
import { PolygonInspector } from '../inspectors/PolygonInspector';
import { ParkingInspector } from '../inspectors/ParkingInspector';
import { CadInspector } from '../inspectors/CadInspector';

export function RightInspector() {
  const { selectedId, selectedType, setSelectedId } = useSketchStore();

  const isVisible = selectedId !== null && selectedType !== null;

  if (!isVisible) {
    return null;
  }

  const handleClose = () => {
    setSelectedId(null, null);
  };

  return (
    <div className="absolute top-0 right-0 bottom-0 z-20 w-80 bg-sm-surface border-l border-sm-border shadow-lg flex flex-col transition-panel custom-scrollbar overflow-y-auto">
      <div className="p-4 border-b border-sm-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sm-ink">
          {getInspectorTitle(selectedType)}
        </h2>
        <button
          className="p-1 hover:bg-sm-bg rounded transition-colors"
          onClick={handleClose}
        >
          <X className="w-4 h-4 text-sm-ink/50" />
        </button>
      </div>

      <div className="flex-1">
        {renderInspectorContent(selectedId, selectedType)}
      </div>
    </div>
  );
}

function getInspectorTitle(type: 'polygon' | 'parking' | 'cad' | null): string {
  const titles: Record<string, string> = {
    polygon: 'Polygon Properties',
    parking: 'Parking Block',
    cad: 'CAD Image',
  };
  return type ? titles[type] || 'Properties' : 'Properties';
}

function renderInspectorContent(selectedId: string | null, selectedType: 'polygon' | 'parking' | 'cad' | null) {
  if (!selectedId || !selectedType) return null;

  switch (selectedType) {
    case 'polygon':
      return <PolygonInspector polygonId={selectedId} />;
    case 'parking':
      return <ParkingInspector parkingBlockId={selectedId} />;
    case 'cad':
      return <CadInspector cadImageId={selectedId} />;
    default:
      return null;
  }
}
