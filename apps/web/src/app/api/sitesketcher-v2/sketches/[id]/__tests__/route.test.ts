/**
 * @jest-environment node
 *
 * Covers the auto-parking entitlement matrix on PUT (INTEGRATION_PLAN.md
 * §6c): preserve-before-normalise ordering, "non-empty, non-Plus" as the
 * reject gate (not mere presence), and Plus payload-size limits.
 */

import { NextRequest } from 'next/server';
import { PUT } from '../route';
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

/** A minimal chainable Supabase mock covering exactly the calls this route makes. */
function installSupabase({ existingAutoLayouts }: { existingAutoLayouts: any[] | null }) {
  let updatePayload: any = null;
  const client = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: existingAutoLayouts === null ? null : { data: { autoLayouts: existingAutoLayouts } },
                error: null,
              })
            ),
          })),
        })),
      })),
      update: jest.fn((payload: any) => {
        updatePayload = payload;
        return {
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({ data: { id: 'sketch-1', ...payload }, error: null })),
                })),
              })),
            })),
          })),
        };
      }),
    })),
  };
  mockCreateServerClient.mockResolvedValue(client);
  return { getUpdatePayload: () => updatePayload };
}

function putRequest(data: Record<string, unknown> | undefined) {
  return new NextRequest('http://localhost:3000/api/sitesketcher-v2/sketches/sketch-1', {
    method: 'PUT',
    body: JSON.stringify({ name: 'My sketch', data }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function callPut(data: Record<string, unknown> | undefined) {
  return PUT(putRequest(data), { params: Promise.resolve({ id: 'sketch-1' }) });
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

describe('PUT /sketches/[id] — auto-parking entitlement matrix', () => {
  it('Plus, field omitted -> preserves existing autoLayouts', async () => {
    mockHasPlusAccess.mockResolvedValue(true);
    const existing = [fakeLayout('existing-1')];
    const { getUpdatePayload } = installSupabase({ existingAutoLayouts: existing });

    const res = await callPut(baseSketchPayload()); // no autoLayouts key at all
    expect(res.status).toBe(200);
    expect(getUpdatePayload().data.autoLayouts).toEqual(existing);
  });

  it('Plus, explicit [] -> intentionally deletes all', async () => {
    mockHasPlusAccess.mockResolvedValue(true);
    const existing = [fakeLayout('existing-1')];
    const { getUpdatePayload } = installSupabase({ existingAutoLayouts: existing });

    const res = await callPut({ ...baseSketchPayload(), autoLayouts: [] });
    expect(res.status).toBe(200);
    expect(getUpdatePayload().data.autoLayouts).toEqual([]);
  });

  it('Plus, non-empty payload -> accepted as sent', async () => {
    mockHasPlusAccess.mockResolvedValue(true);
    const { getUpdatePayload } = installSupabase({ existingAutoLayouts: [] });
    const layout = fakeLayout('new-1');

    const res = await callPut({ ...baseSketchPayload(), autoLayouts: [layout] });
    expect(res.status).toBe(200);
    expect(getUpdatePayload().data.autoLayouts).toEqual([layout]);
  });

  it('non-Plus, field omitted -> preserves hidden existing layouts', async () => {
    mockHasPlusAccess.mockResolvedValue(false);
    const existing = [fakeLayout('hidden-1')];
    const { getUpdatePayload } = installSupabase({ existingAutoLayouts: existing });

    const res = await callPut(baseSketchPayload());
    expect(res.status).toBe(200);
    expect(getUpdatePayload().data.autoLayouts).toEqual(existing);
  });

  it('non-Plus, explicit [] -> preserves hidden existing layouts (not a delete)', async () => {
    mockHasPlusAccess.mockResolvedValue(false);
    const existing = [fakeLayout('hidden-1')];
    const { getUpdatePayload } = installSupabase({ existingAutoLayouts: existing });

    const res = await callPut({ ...baseSketchPayload(), autoLayouts: [] });
    expect(res.status).toBe(200);
    expect(getUpdatePayload().data.autoLayouts).toEqual(existing);
  });

  it('non-Plus, non-empty -> rejected with 403, no DB write attempted', async () => {
    mockHasPlusAccess.mockResolvedValue(false);
    const { getUpdatePayload } = installSupabase({ existingAutoLayouts: [] });

    const res = await callPut({ ...baseSketchPayload(), autoLayouts: [fakeLayout()] });
    expect(res.status).toBe(403);
    expect(getUpdatePayload()).toBeNull();
  });

  it('an old sketch with no data field at all is untouched (name-only rename)', async () => {
    mockHasPlusAccess.mockResolvedValue(true);
    const { getUpdatePayload } = installSupabase({ existingAutoLayouts: null });

    const res = await callPut(undefined);
    expect(res.status).toBe(200);
    expect(getUpdatePayload().data).toBeUndefined();
  });

  it('Plus payload exceeding the per-sketch layout cap is rejected', async () => {
    mockHasPlusAccess.mockResolvedValue(true);
    installSupabase({ existingAutoLayouts: [] });
    const layouts = Array.from({ length: 25 }, (_, i) => fakeLayout(`l-${i}`));

    const res = await callPut({ ...baseSketchPayload(), autoLayouts: layouts });
    expect(res.status).toBe(403);
  });
});
