'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { X } from 'lucide-react';
import { PolygonToolPanel } from '../tools/PolygonToolPanel';
import { ParkingToolPanel } from '../tools/ParkingToolPanel';
import { CadToolPanel } from '../tools/CadToolPanel';
import { MeasureToolPanel } from '../tools/MeasureToolPanel';
import { LayersPanel } from '../panels/LayersPanel';
import { SavedSketchesPanel } from '../panels/SavedSketchesPanel';

export function LeftPanel() {
  const {
    activeTool,
    activePanel,
    selectedPolygonColorIndex,
    setActiveTool,
    setActivePanel,
    setSelectedPolygonColorIndex,
  } = useSketchStore();

  // Panel visibility logic - show if tool is active OR panel is active
  const isVisible = activeTool !== 'select' || activePanel !== null;

  if (!isVisible) {
    return null;
  }

  const handleClose = () => {
    if (activePanel) {
      setActivePanel(null);
    } else {
      setActiveTool('select');
    }
  };

  const panelContent = activePanel || activeTool;

  return (
    <div className="w-80 bg-sm-surface border-r border-sm-border flex flex-col flex-shrink-0 transition-panel custom-scrollbar overflow-y-auto">
      <div className="p-4 border-b border-sm-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sm-ink">
          {getPanelTitle(panelContent)}
        </h2>
        <button
          className="p-1 hover:bg-sm-bg rounded transition-colors"
          onClick={handleClose}
        >
          <X className="w-4 h-4 text-sm-ink/50" />
        </button>
      </div>

      <div className="flex-1">
        {renderPanelContent(panelContent, selectedPolygonColorIndex, setSelectedPolygonColorIndex)}
      </div>
    </div>
  );
}

function getPanelTitle(content: string): string {
  const titles: Record<string, string> = {
    polygon: 'Draw Polygon',
    parking: 'Add Parking',
    cad: 'CAD Overlay',
    measure: 'Measure Distance',
    layers: 'Layers',
    saved: 'Saved Sketches',
  };
  return titles[content] || 'Tool Options';
}

function renderPanelContent(
  content: string,
  selectedColorIndex: number,
  setSelectedColorIndex: (index: number) => void
) {
  switch (content) {
    case 'polygon':
      return (
        <PolygonToolPanel
          selectedColorIndex={selectedColorIndex}
          onColorChange={setSelectedColorIndex}
        />
      );
    case 'parking':
      return <ParkingToolPanel />;
    case 'cad':
      return <CadToolPanel />;
    case 'measure':
      return <MeasureToolPanel />;
    case 'layers':
      return <LayersPanel />;
    case 'saved':
      return <SavedSketchesPanel />;
    default:
      return null;
  }
}
