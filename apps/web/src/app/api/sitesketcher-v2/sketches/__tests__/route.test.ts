/**
 * @jest-environment node
 *
 * Covers auto-parking entitlement on POST, and list-GET sanitisation
 * (INTEGRATION_PLAN.md §6c) — the list endpoint's `.select('*')` is
 * otherwise unsanitised.
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getCurrentUser } from '@/lib/auth';
import { hasProAccess, hasPlusAccess } from '@/lib/subscription-utils';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/lib/subscription-utils', () => ({ hasProAccess: jest.fn(), hasPlusAccess: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const mockGetCurrentUser = getCurrentUser as jest.Mock;
const mockHasProAccess = hasProAccess as jest.Mock;
const mockHasPlusAccess = hasPlusAccess as jest.Mock;
const mockCreateServerClient = createServerClient as jest.Mock;

function fakeLayout(id = 'auto-1') {
  return {
    id,
    name: 'Auto layout 1',
    geometrySchemaVersion: 1,
    boundaryId: 'polygon-1',
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
  };
}

const baseSketchPayload = () => ({
  version: 2,
  polygons: [],
  parkingBlocks: [],
  cadInstances: [],
  viewport: { center: [0, 0], zoom: 10, pitch: 0, bearing: 0 },
  settings: { units: 'metric', mapStyle: 'hybrid', sideLabelsOn: true },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
  mockHasProAccess.mockResolvedValue(true);
});

describe('POST /sketches — auto-parking entitlement', () => {
  function installInsertMock() {
    const client = {
      from: jest.fn(() => ({
        insert: jest.fn((payload: any) => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { id: 'new-sketch', ...payload }, error: null })),
          })),
        })),
      })),
    };
    mockCreateServerClient.mockResolvedValue(client);
  }

  function postRequest(data: Record<string, unknown>) {
    return new NextRequest('http://localhost:3000/api/sitesketcher-v2/sketches', {
      method: 'POST',
      body: JSON.stringify({ name: 'My sketch', data }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('rejects a non-empty autoLayouts payload for a non-Plus user', async () => {
    mockHasPlusAccess.mockResolvedValue(false);
    installInsertMock();

    const res = await POST(postRequest({ ...baseSketchPayload(), autoLayouts: [fakeLayout()] }));
    expect(res.status).toBe(403);
  });

  it('accepts an empty (or omitted) autoLayouts for a non-Plus user', async () => {
    mockHasPlusAccess.mockResolvedValue(false);
    installInsertMock();

    const res = await POST(postRequest(baseSketchPayload()));
    expect(res.status).toBe(201);
  });

  it('accepts a non-empty autoLayouts payload for a Plus user', async () => {
    mockHasPlusAccess.mockResolvedValue(true);
    installInsertMock();

    const res = await POST(postRequest({ ...baseSketchPayload(), autoLayouts: [fakeLayout()] }));
    expect(res.status).toBe(201);
  });
});

describe('GET /sketches (list) — sanitisation', () => {
  function installListMock(rows: any[]) {
    const client = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: rows, error: null })),
            })),
          })),
        })),
      })),
    };
    mockCreateServerClient.mockResolvedValue(client);
  }

  it('strips autoLayouts from every row for a non-Plus viewer', async () => {
    mockHasPlusAccess.mockResolvedValue(false);
    installListMock([
      { id: 's1', data: { ...baseSketchPayload(), autoLayouts: [fakeLayout()] } },
      { id: 's2', data: { ...baseSketchPayload(), autoLayouts: [fakeLayout('auto-2')] } },
    ]);

    const res = await GET(new NextRequest('http://localhost:3000/api/sitesketcher-v2/sketches'));
    const body = await res.json();
    expect(body.sketches.every((s: any) => s.data.autoLayouts.length === 0)).toBe(true);
  });

  it('leaves autoLayouts intact for a Plus viewer', async () => {
    mockHasPlusAccess.mockResolvedValue(true);
    const layout = fakeLayout();
    installListMock([{ id: 's1', data: { ...baseSketchPayload(), autoLayouts: [layout] } }]);

    const res = await GET(new NextRequest('http://localhost:3000/api/sitesketcher-v2/sketches'));
    const body = await res.json();
    expect(body.sketches[0].data.autoLayouts).toEqual([layout]);
  });
});
