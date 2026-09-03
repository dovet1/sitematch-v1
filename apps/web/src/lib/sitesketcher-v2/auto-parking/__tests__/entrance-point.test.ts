import {
  entranceWall,
  isEntranceValid,
  isPointInsideRing,
  resolveEntrance,
  snapEntranceToBuildings,
  type EntranceBuilding,
} from '../entrance-point';
import type { LngLat } from '@/lib/parking-layout-lab/types';

const ORIGIN: LngLat = [-1.08, 51.28];
const EARTH_R = 6_378_137;
function m(x: number, y: number): LngLat {
  const cosLat0 = Math.cos((ORIGIN[1] * Math.PI) / 180);
  return [
    ORIGIN[0] + (x / (EARTH_R * cosLat0)) * (180 / Math.PI),
    ORIGIN[1] + (y / EARTH_R) * (180 / Math.PI),
  ];
}

function building(id: string, x: number, kind: EntranceBuilding['kind'] = 'polygon'): EntranceBuilding {
  return { id, kind, ring: [m(x, 10), m(x + 10, 10), m(x + 10, 20), m(x, 20), m(x, 10)] };
}

describe('building entrance geometry', () => {
  const buildings = [building('a', 5), building('b', 30)];

  it('snaps to the nearest building wall and resolves from its edge anchor', () => {
    const result = snapEntranceToBuildings(m(29, 15), buildings);
    expect(result?.entrance.buildingId).toBe('b');
    expect(result?.entrance.buildingKind).toBe('polygon');
    expect(resolveEntrance(result!.entrance, buildings)).toEqual(result!.point);
    expect(entranceWall(result!.entrance, buildings)).toEqual(result!.wall);
  });

  it('snaps to a CAD footprint and tags the entrance as a CAD wall', () => {
    const cad = building('cad-1', 30, 'cadInstance');
    const result = snapEntranceToBuildings(m(29, 15), [building('a', 5), cad]);
    expect(result?.entrance.buildingId).toBe('cad-1');
    expect(result?.entrance.buildingKind).toBe('cadInstance');
    expect(resolveEntrance(result!.entrance, [cad])).toEqual(result!.point);
    // A same-id polygon must not satisfy a CAD-kind entrance.
    expect(resolveEntrance(result!.entrance, [building('cad-1', 30, 'polygon')])).toBeNull();
  });

  it('treats a missing buildingKind as a polygon (backward compatibility)', () => {
    const entrance = { kind: 'building' as const, buildingId: 'a', edgeIndex: 0, distanceAlongEdgeM: 2 };
    expect(isEntranceValid(entrance, buildings)).toBe(true);
    expect(resolveEntrance(entrance, [building('a', 5, 'cadInstance')])).toBeNull();
  });

  it('becomes invalid when its referenced building is missing', () => {
    const entrance = { kind: 'building' as const, buildingId: 'a', buildingKind: 'polygon' as const, edgeIndex: 0, distanceAlongEdgeM: 2 };
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
