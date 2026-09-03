import { getSketchObjectCount } from '../object-count';
import type { CadImage, CadInstance, ParkingBlock, Polygon } from '@/types/sitesketcher-v2';

const polygon = {
  id: 'polygon-1',
  name: 'Plot A',
  colorIndex: 0,
  points: [],
  rotation: 0,
  height: 0,
  showDistances: true,
  showArea: true,
  createdAt: 1,
  updatedAt: 1,
} satisfies Polygon;

const parkingBlock = {
  id: 'parking-1',
  name: 'Parking 1',
  spaces: 10,
  layout: 'single',
  stallSize: 'standard',
  anchor: [-0.1, 51.5],
  rotation: 0,
  createdAt: 1,
  updatedAt: 1,
} satisfies ParkingBlock;

const placedLegacyCad = {
  id: 'cad-1',
  fileName: 'site-plan.png',
  url: 'https://example.com/site-plan.png',
  storagePath: 'user/site-plan.png',
  metresPerPixel: 0.5,
  anchor: [-0.1, 51.5],
  rotation: 0,
  opacity: 0.8,
  imageWidthPx: 200,
  imageHeightPx: 100,
  createdAt: 1,
  updatedAt: 1,
} satisfies CadImage;

const unplacedLegacyCad = {
  ...placedLegacyCad,
  id: 'cad-2',
  anchor: null,
} satisfies CadImage;

const cadInstance = {
  id: 'cad-instance-1',
  savedCadId: 'saved-cad-1',
  anchor: [-0.1, 51.5],
  rotation: 0,
  opacity: 0.7,
  locked: false,
  createdAt: 1,
  updatedAt: 1,
} satisfies CadInstance;

describe('getSketchObjectCount', () => {
  it('counts placed legacy CADs and saved CAD instances for modal summaries', () => {
    expect(
      getSketchObjectCount({
        polygons: [polygon],
        parkingBlocks: [parkingBlock],
        cadImages: [placedLegacyCad, unplacedLegacyCad],
        cadInstances: [cadInstance],
      })
    ).toEqual({
      polygons: 1,
      parkingBlocks: 1,
      cadImages: 2,
      autoLayouts: 0,
    });
  });

  it('counts applied auto-parking layouts', () => {
    expect(
      getSketchObjectCount({
        polygons: [polygon],
        parkingBlocks: [],
        cadImages: [],
        cadInstances: [],
        autoLayouts: [
          {
            id: 'auto-1',
            name: 'Auto layout 1',
            geometrySchemaVersion: 1,
            boundaryId: polygon.id,
            exclusionRefs: [],
            accessPoint: [0, 0],
            settingsSnapshot: {
              stallSize: 'standard',
              aisleWidth: 6,
              boundarySetback: 1,
              buildingClearance: 1,
              checkManoeuvring: false,
              oneWay: false,
              gateQueueVehicles: null,
              accessibleBays: { on: false, percent: 5 },
            },
            geometry: { type: 'FeatureCollection', features: [] },
            metrics: { totalSpaces: 10, standard: 10, accessible: 0, rows: 1, footprintSqm: 50 },
            warnings: [],
            sourceHash: 'v1-abc',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      })
    ).toEqual({
      polygons: 1,
      parkingBlocks: 0,
      cadImages: 0,
      autoLayouts: 1,
    });
  });
});
