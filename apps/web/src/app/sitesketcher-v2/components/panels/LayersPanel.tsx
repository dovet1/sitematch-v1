'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { POLYGON_COLORS } from '@/lib/sitesketcher-v2/constants';
import { Polygon } from '@/types/sitesketcher-v2';
import { Trash2 } from 'lucide-react';

const LAYER_FOCUS_ZOOM = 18.5;

function getPolygonBounds(polygon: Polygon): [[number, number], [number, number]] {
  const bounds = polygon.points.reduce(
    (acc, [lng, lat]) => ({
      minLng: Math.min(acc.minLng, lng),
      maxLng: Math.max(acc.maxLng, lng),
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
    }),
    {
      minLng: Number.POSITIVE_INFINITY,
      maxLng: Number.NEGATIVE_INFINITY,
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
    }
  );

  return [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  ];
}

function getBoundsCenter(bounds: [[number, number], [number, number]]): [number, number] {
  return [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ];
}

export function LayersPanel() {
  const {
    polygons,
    parkingBlocks,
    cadImages,
    selectedId,
    setSelectedId,
    focusMap,
    deletePolygon,
    deleteParkingBlock,
  } = useSketchStore();

  const totalObjects = polygons.length + parkingBlocks.length + cadImages.length;
  const focusPolygonLayer = (polygon: Polygon) => {
    const bounds = getPolygonBounds(polygon);

    setSelectedId(polygon.id, 'polygon');
    focusMap({
      center: getBoundsCenter(bounds),
      bounds,
    });
  };
  const focusParkingLayer = (id: string, center: [number, number]) => {
    setSelectedId(id, 'parking');
    focusMap({
      center,
      zoom: LAYER_FOCUS_ZOOM,
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div>
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
                <div
                  key={polygon.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => focusPolygonLayer(polygon)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      focusPolygonLayer(polygon);
                    }
                  }}
                  className={`
                    group w-full flex items-center gap-2 p-2 rounded transition-all text-left cursor-pointer
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
                    type="button"
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
                </div>
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
            {parkingBlocks.map((parking) => {
              const isSelected = selectedId === parking.id;

              return (
                <div
                  key={parking.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => focusParkingLayer(parking.id, parking.anchor)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      focusParkingLayer(parking.id, parking.anchor);
                    }
                  }}
                  className={`
                    group w-full flex items-center gap-2 p-2 rounded transition-all text-left cursor-pointer
                    ${
                      isSelected
                        ? 'bg-sm-violet/10 border border-sm-violet'
                        : 'hover:bg-sm-bg border border-transparent'
                    }
                  `}
                >
                  <div className="w-4 h-4 rounded border-2 flex-shrink-0 bg-teal-500/20 border-teal-600" />
                  <span className="text-sm text-sm-ink flex-1 truncate">
                    {parking.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${parking.name}?`)) {
                        deleteParkingBlock(parking.id);
                      }
                    }}
                    className="p-1 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              );
            })}
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
