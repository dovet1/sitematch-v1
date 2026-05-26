'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { POLYGON_COLORS } from '@/lib/sitesketcher-v2/constants';
import { Eye, EyeOff, Trash2 } from 'lucide-react';

export function LayersPanel() {
  const { polygons, parkingBlocks, cadImages, selectedId, setSelectedId, deletePolygon } = useSketchStore();

  const totalObjects = polygons.length + parkingBlocks.length + cadImages.length;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-sm-ink mb-1">Layers</h3>
        <p className="text-xs text-sm-ink/60">
          {totalObjects} object{totalObjects !== 1 ? 's' : ''} in sketch
        </p>
      </div>

      {totalObjects === 0 && (
        <div className="text-center py-8 text-sm text-sm-ink/50">
          No objects yet
          <br />
          <span className="text-xs">Start drawing to add layers</span>
        </div>
      )}

      {polygons.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-sm-ink/70 mb-2 uppercase tracking-wide">
            Polygons ({polygons.length})
          </h4>
          <div className="space-y-1">
            {polygons.map((polygon) => {
              const color = POLYGON_COLORS[polygon.colorIndex] || POLYGON_COLORS[0];
              const isSelected = selectedId === polygon.id;

              return (
                <button
                  key={polygon.id}
                  onClick={() => setSelectedId(polygon.id, 'polygon')}
                  className={`
                    w-full flex items-center gap-2 p-2 rounded transition-all text-left
                    ${
                      isSelected
                        ? 'bg-sm-violet/10 border border-sm-violet'
                        : 'hover:bg-sm-bg border border-transparent'
                    }
                  `}
                >
                  <div
                    className="w-4 h-4 rounded border-2 flex-shrink-0"
                    style={{
                      backgroundColor: color.fill,
                      borderColor: color.stroke,
                    }}
                  />
                  <span className="text-sm text-sm-ink flex-1 truncate">
                    {polygon.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${polygon.name}?`)) {
                        deletePolygon(polygon.id);
                      }
                    }}
                    className="p-1 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {parkingBlocks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-sm-ink/70 mb-2 uppercase tracking-wide">
            Parking ({parkingBlocks.length})
          </h4>
          <div className="space-y-1">
            <div className="text-sm text-sm-ink/50 text-center py-4">
              Coming soon
            </div>
          </div>
        </div>
      )}

      {cadImages.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-sm-ink/70 mb-2 uppercase tracking-wide">
            CAD Images ({cadImages.length})
          </h4>
          <div className="space-y-1">
            <div className="text-sm text-sm-ink/50 text-center py-4">
              Coming soon
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
