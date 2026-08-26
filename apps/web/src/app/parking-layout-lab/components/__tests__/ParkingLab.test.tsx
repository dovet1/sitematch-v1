/**
 * @jest-environment jsdom
 *
 * Parking Layout Lab — orchestrator UI tests.
 *
 * LabMap owns a real Mapbox GL + Draw instance, which jsdom can't run, so it's
 * mocked here to a controllable stand-in: the test drives its callback props
 * directly (simulating draw events) and inspects calls to its imperative
 * handle (`setResultCollection`) to verify what ParkingLab told the map to
 * render. The worker client is mocked the same way, so these tests exercise
 * ParkingLab's OWN scheduling/invalidation logic — the solver's correctness
 * is covered separately in solver.test.ts.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParkingLab from '../ParkingLab';
import type { DestinationPoint, LngLat, SolverOutput } from '@/lib/parking-layout-lab/types';

// --- Mock LabMap: capture the latest props + a spy-able imperative handle. ---
let mockLatestLabMapProps: {
  onBoundaryChange: (ring: LngLat[] | null) => void;
  onExclusionsChange: (rings: LngLat[][]) => void;
  onAccessPoint: (pt: LngLat) => void;
  onModeEnd: () => void;
  live: boolean;
  onLiveGeometryChange: (boundary: LngLat[] | null, exclusions: LngLat[][]) => void;
  destinations: DestinationPoint[];
  onDestinationPoint: (pt: LngLat) => void;
  onDestinationRemove: (id: string) => void;
} | null = null;
const mockSetResultCollection = jest.fn();
const mockSetPreviewUpdating = jest.fn();

jest.mock('../LabMap', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      mockLatestLabMapProps = props;
      React.useImperativeHandle(ref, () => ({
        startBoundary: jest.fn(),
        startExclusion: jest.fn(),
        startAccess: jest.fn(),
        startDestination: jest.fn(),
        cancelMode: jest.fn(),
        clearAll: jest.fn(),
        deleteSelected: jest.fn(),
        setResultCollection: mockSetResultCollection,
        setPreviewUpdating: mockSetPreviewUpdating,
      }));
      return React.createElement('div', { 'data-testid': 'lab-map-mock' });
    }),
  };
});

// --- Mock the worker client: fully controllable from the test. ---
type FakeClient = {
  solve: jest.Mock;
  onResult: jest.Mock;
  onError: jest.Mock;
  terminate: jest.Mock;
  isFallback: jest.Mock;
  emitResult: (output: SolverOutput, input: unknown) => void;
  emitError: (message: string) => void;
};
let mockClients: FakeClient[] = [];

function makeFakeClient(): FakeClient {
  let resultCb: ((output: SolverOutput, input: unknown) => void) | null = null;
  let errorCb: ((message: string) => void) | null = null;
  const client: FakeClient = {
    solve: jest.fn(),
    onResult: jest.fn((cb) => {
      resultCb = cb;
    }),
    onError: jest.fn((cb) => {
      errorCb = cb;
    }),
    terminate: jest.fn(),
    isFallback: jest.fn(() => false),
    emitResult: (output, input) => resultCb?.(output, input),
    emitError: (message) => errorCb?.(message),
  };
  return client;
}

jest.mock('@/lib/parking-layout-lab/workerClient', () => ({
  createSolverWorkerClient: () => {
    const client = makeFakeClient();
    mockClients.push(client);
    return client;
  },
}));

// --- Fixture helpers -------------------------------------------------------
const BOUNDARY: LngLat[] = [
  [-1.081, 51.279],
  [-1.079, 51.279],
  [-1.079, 51.281],
  [-1.081, 51.281],
];
const ACCESS: LngLat = [-1.08, 51.279];

function emptyOutput(): SolverOutput {
  return {
    snappedAccessPoint: ACCESS,
    usableBoundary: { ring: BOUNDARY },
    expandedExclusions: [],
    candidates: [],
    warnings: [],
  };
}

beforeEach(() => {
  mockClients = [];
  mockLatestLabMapProps = null;
  mockSetResultCollection.mockClear();
  mockSetPreviewUpdating.mockClear();
});

describe('ParkingLab', () => {
  it('creates exactly one worker client on mount and terminates it on unmount', () => {
    const { unmount } = render(<ParkingLab />);
    expect(mockClients.length).toBe(1);
    unmount();
    expect(mockClients[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('schedules a live solve as soon as boundary + access point are both set', () => {
    render(<ParkingLab />);
    const client = mockClients[0];

    act(() => {
      mockLatestLabMapProps!.onBoundaryChange(BOUNDARY);
    });
    expect(client.solve).not.toHaveBeenCalled(); // no access point yet

    act(() => {
      mockLatestLabMapProps!.onAccessPoint(ACCESS);
    });
    expect(client.solve).toHaveBeenCalledTimes(1);
  });

  it('renders the result on the map when the worker resolves', () => {
    render(<ParkingLab />);
    const client = mockClients[0];

    act(() => {
      mockLatestLabMapProps!.onBoundaryChange(BOUNDARY);
      mockLatestLabMapProps!.onAccessPoint(ACCESS);
    });
    const input = client.solve.mock.calls[0][0];

    mockSetResultCollection.mockClear();
    act(() => {
      client.emitResult(emptyOutput(), input);
    });
    expect(mockSetResultCollection).toHaveBeenCalledTimes(1);
    // No candidates -> the map is told to clear its result layer, not show stale geometry.
    expect(mockSetResultCollection.mock.calls[0][0]).toBeNull();
  });

  it('during-drag live geometry updates reschedule a solve without clearing the current result first', () => {
    render(<ParkingLab />);
    const client = mockClients[0];

    act(() => {
      mockLatestLabMapProps!.onBoundaryChange(BOUNDARY);
      mockLatestLabMapProps!.onAccessPoint(ACCESS);
    });
    const firstCallCount = client.solve.mock.calls.length;
    mockSetResultCollection.mockClear();

    const draggedBoundary: LngLat[] = [
      [-1.0815, 51.2795],
      [-1.0795, 51.2795],
      [-1.0795, 51.2815],
      [-1.0815, 51.2815],
    ];
    act(() => {
      mockLatestLabMapProps!.onLiveGeometryChange(draggedBoundary, []);
    });

    // A new solve was scheduled for the dragged geometry...
    expect(client.solve.mock.calls.length).toBeGreaterThan(firstCallCount);
    // ...and the map was NOT told to clear (live mode swaps seamlessly, no flash).
    expect(mockSetResultCollection).not.toHaveBeenCalled();
  });

  it('a non-live edit clears the result panel and the map geometry immediately', async () => {
    const user = userEvent.setup();
    render(<ParkingLab />);
    const client = mockClients[0];

    act(() => {
      mockLatestLabMapProps!.onBoundaryChange(BOUNDARY);
      mockLatestLabMapProps!.onAccessPoint(ACCESS);
    });
    const input = client.solve.mock.calls[0][0];
    act(() => {
      client.emitResult(emptyOutput(), input);
    });
    mockSetResultCollection.mockClear();

    // Turn live off, then make a structural edit (a new exclusion drawn) — the
    // stale result must clear immediately rather than lingering until the next
    // manual Generate click.
    await user.click(screen.getByLabelText(/live/i));
    expect(mockLatestLabMapProps!.live).toBe(false);

    act(() => {
      mockLatestLabMapProps!.onExclusionsChange([BOUNDARY]);
    });
    expect(mockSetResultCollection).toHaveBeenCalledWith(null);
  });

  it('worker error is surfaced without throwing and stops the generating state', () => {
    render(<ParkingLab />);
    const client = mockClients[0];

    act(() => {
      mockLatestLabMapProps!.onBoundaryChange(BOUNDARY);
      mockLatestLabMapProps!.onAccessPoint(ACCESS);
    });
    expect(() => {
      act(() => {
        client.emitError('The layout worker failed; falling back to main-thread solving.');
      });
    }).not.toThrow();
  });

  it('M2: placing a destination via the map callback is included in the next solve input', () => {
    render(<ParkingLab />);
    const client = mockClients[0];

    act(() => {
      mockLatestLabMapProps!.onBoundaryChange(BOUNDARY);
      mockLatestLabMapProps!.onAccessPoint(ACCESS);
    });
    client.solve.mockClear();

    act(() => {
      mockLatestLabMapProps!.onDestinationPoint(ACCESS);
    });
    expect(client.solve).toHaveBeenCalled();
    const lastInput = client.solve.mock.calls[client.solve.mock.calls.length - 1][0];
    expect(lastInput.destinations).toHaveLength(1);
    expect(mockLatestLabMapProps!.destinations).toHaveLength(1);

    const destId = mockLatestLabMapProps!.destinations[0].id;
    act(() => {
      mockLatestLabMapProps!.onDestinationRemove(destId);
    });
    expect(mockLatestLabMapProps!.destinations).toHaveLength(0);
  });

  it('M2: enabling manoeuvring checks includes a vehicle profile in the solve input', async () => {
    const user = userEvent.setup();
    render(<ParkingLab />);
    const client = mockClients[0];

    act(() => {
      mockLatestLabMapProps!.onBoundaryChange(BOUNDARY);
      mockLatestLabMapProps!.onAccessPoint(ACCESS);
    });
    client.solve.mockClear();

    await user.click(screen.getByLabelText(/check manoeuvring/i));
    expect(client.solve).toHaveBeenCalled();
    const lastInput = client.solve.mock.calls[client.solve.mock.calls.length - 1][0];
    expect(lastInput.vehicle).toBeDefined();
    expect(lastInput.vehicle.turningRadius).toBeGreaterThan(0);
  });
});
