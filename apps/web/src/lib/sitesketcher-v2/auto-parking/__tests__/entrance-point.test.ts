import {
  entranceWall,
  isEntranceValid,
  isPointInsideRing,
  resolveEntrance,
  snapEntranceToBuildings,
} from '../entrance-point';
import type { LngLat } from '@/lib/parking-layout-lab/types';
import type { Polygon } from '@/types/sitesketcher-v2';

const ORIGIN: LngLat = [-1.08, 51.28];
const EARTH_R = 6_378_137;
function m(x: number, y: number): LngLat {
  const cosLat0 = Math.cos((ORIGIN[1] * Math.PI) / 180);
  return [
    ORIGIN[0] + (x / (EARTH_R * cosLat0)) * (180 / Math.PI),
    ORIGIN[1] + (y / EARTH_R) * (180 / Math.PI),
  ];
}

function building(id: string, x: number): Polygon {
  return {
    id,
    name: id,
    colorIndex: 0,
    points: [m(x, 10), m(x + 10, 10), m(x + 10, 20), m(x, 20), m(x, 10)],
    rotation: 0,
    height: 0,
    showDistances: false,
    showArea: false,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('building entrance geometry', () => {
  const buildings = [building('a', 5), building('b', 30)];
  const refs = buildings.map((item) => ({ id: item.id, kind: 'polygon' as const, source: 'selected' as const }));

  it('snaps to the nearest selected building wall and resolves from its edge anchor', () => {
    const result = snapEntranceToBuildings(m(29, 15), refs, buildings);
    expect(result?.entrance.buildingId).toBe('b');
    expect(resolveEntrance(result!.entrance, buildings)).toEqual(result!.point);
    expect(entranceWall(result!.entrance, buildings)).toEqual(result!.wall);
  });

  it('becomes invalid when its referenced building is missing', () => {
    const entrance = { kind: 'building' as const, buildingId: 'a', edgeIndex: 0, distanceAlongEdgeM: 2 };
    expect(isEntranceValid(entrance, buildings)).toBe(true);
    expect(isEntranceValid(entrance, buildings.slice(1))).toBe(false);
    expect(resolveEntrance(entrance, buildings.slice(1))).toBeNull();
  });

  it('supports a free visitor target only within the site ring', () => {
    const site = [m(0, 0), m(50, 0), m(50, 40), m(0, 40), m(0, 0)];
    expect(isPointInsideRing(m(20, 20), site)).toBe(true);
    expect(isPointInsideRing(m(60, 20), site)).toBe(false);
  });
});
