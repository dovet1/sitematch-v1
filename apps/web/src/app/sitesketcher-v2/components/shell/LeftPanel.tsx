'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Car, FileUp, Pentagon, Sparkles, X } from 'lucide-react';
import { PolygonToolPanel } from '../tools/PolygonToolPanel';
import { ParkingToolPanel } from '../tools/ParkingToolPanel';
import { CadToolPanel } from '../tools/CadToolPanel';
import { MeasureToolPanel } from '../tools/MeasureToolPanel';
import { LayersPanel } from '../panels/LayersPanel';
import { SavedSketchesPanel } from '../panels/SavedSketchesPanel';
import { Badge } from '../primitives/Badge';

export function LeftPanel() {
  const {
    activeTool,
    activePanel,
    polygons,
    parkingBlocks,
    cadImages,
    selectedPolygonColorIndex,
    setActiveTool,
    setActivePanel,
    setSelectedPolygonColorIndex,
  } = useSketchStore();

  const hasSketchContent =
    polygons.length > 0 || parkingBlocks.length > 0 || cadImages.length > 0;
  const showSelectEmptyState =
    activeTool === 'select' && activePanel === null && !hasSketchContent;
  const isVisible = activeTool !== 'select' || activePanel !== null || showSelectEmptyState;

  if (!isVisible) {
    return null;
  }

  if (showSelectEmptyState) {
    return (
      <div className="w-80 bg-sm-surface border-r border-sm-border flex flex-col flex-shrink-0 transition-panel">
        <SelectEmptyState onSelectTool={setActiveTool} />
      </div>
    );
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
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-sm-ink">
            {getPanelTitle(panelContent)}
          </h2>
          {panelContent === 'cad' && <Badge variant="violet">Pro</Badge>}
        </div>
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

interface SelectEmptyStateProps {
  onSelectTool: (tool: 'polygon' | 'parking' | 'cad') => void;
}

function SelectEmptyState({ onSelectTool }: SelectEmptyStateProps) {
  return (
    <div className="flex-1 p-4 pt-10">
      <div className="flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded-lg bg-sm-violet/10 flex items-center justify-center mb-4">
          <Sparkles className="w-4 h-4 text-sm-violet" />
        </div>

        <h2 className="text-sm font-semibold text-sm-ink mb-2">Start sketching</h2>
        <p className="text-xs leading-5 text-sm-ink/60 max-w-[220px] mb-5">
          Pick a tool on the left, then click on the map to drop your first point.
        </p>

        <div className="w-full space-y-2">
          <button
            type="button"
            onClick={() => onSelectTool('polygon')}
            className="w-full px-3.5 py-2 rounded-lg bg-sm-violet text-white hover:bg-sm-violet/90 transition-colors focus-ring inline-flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Pentagon className="w-4 h-4" />
            Draw a polygon
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('parking')}
            className="w-full px-2.5 py-1.5 rounded-lg border border-sm-border bg-sm-surface text-sm-ink hover:bg-sm-bg transition-colors focus-ring inline-flex items-center justify-center gap-1.5 text-xs font-medium"
          >
            <Car className="w-3.5 h-3.5" />
            Add parking
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('cad')}
            className="w-full px-2.5 py-1.5 rounded-lg border border-sm-border bg-sm-surface text-sm-ink hover:bg-sm-bg transition-colors focus-ring inline-flex items-center justify-center gap-1.5 text-xs font-medium"
          >
            <FileUp className="w-3.5 h-3.5" />
            Upload CAD
          </button>
        </div>

        <div className="w-full mt-6 rounded-lg border border-sm-border bg-sm-bg/70 p-3 text-left">
          <div className="text-xs font-medium text-sm-ink mb-1">
            Shortcut
          </div>
          <p className="text-xs leading-5 text-sm-ink/60">
            Search a postcode or address above to fly there first.
          </p>
        </div>
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
