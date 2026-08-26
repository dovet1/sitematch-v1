/**
 * Parking Layout Lab — worker client scheduling tests.
 *
 * Exercises the latest-only protocol against a FAKE worker (jsdom has no real
 * Worker implementation): at most one active solve + one pending input, a
 * monotonic run id so a stale response can never publish, and the
 * main-thread fallback when the worker fails. Also covers the draft/full
 * priority rule: a draft (`input.draft`) is dropped outright rather than
 * scheduled whenever a full is running or queued, so a full result can
 * never be superseded or trailed by a draft.
 */

import { createSolverWorkerClient, type WorkerLike } from '../workerClient';
import type { SolverInput, SolverOutput } from '../types';
import type { SolverResponseMessage } from '../workerProtocol';

function fakeInput(tag: string): SolverInput {
  return {
    boundary: { ring: [] },
    exclusions: [],
    accessPoint: [0, 0],
    stall: { width: 2.4, length: 4.8 },
    aisleWidth: 6,
    boundarySetback: 1,
    exclusionClearance: 1,
    // maxCandidates doubles as a harmless distinguishing tag between fixtures.
    options: { maxCandidates: tag.length || 1 },
  };
}

function fakeDraftInput(tag: string): SolverInput {
  return { ...fakeInput(tag), draft: true };
}

function fakeOutput(tag: string): SolverOutput {
  return {
    snappedAccessPoint: [0, 0],
    usableBoundary: null,
    expandedExclusions: [],
    candidates: [],
    warnings: [{ code: 'tag', message: tag }],
  };
}

class FakeWorker implements WorkerLike {
  posted: { runId: number; input: SolverInput }[] = [];
  onmessage: ((event: { data: SolverResponseMessage }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  terminated = false;

  postMessage(message: { runId: number; input: SolverInput }) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  respond(runId: number, output: SolverOutput) {
    this.onmessage?.({ data: { runId, output } });
  }
  triggerError() {
    this.onerror?.(new Event('error'));
  }
}

describe('parking-layout-lab workerClient', () => {
  it('delivers a result for a single scheduled input', () => {
    const worker = new FakeWorker();
    const client = createSolverWorkerClient({ createWorker: () => worker });
    const onResult = jest.fn();
    client.onResult(onResult);

    const input = fakeInput('a');
    client.solve(input);
    expect(worker.posted.length).toBe(1);

    worker.respond(worker.posted[0].runId, fakeOutput('a'));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][1]).toBe(input);
  });

  it('latest-only: a newer input scheduled while one is in flight replaces the pending slot, not the active one', () => {
    const worker = new FakeWorker();
    const client = createSolverWorkerClient({ createWorker: () => worker });
    const onResult = jest.fn();
    client.onResult(onResult);

    client.solve(fakeInput('a'));
    expect(worker.posted.length).toBe(1); // A dispatched immediately

    client.solve(fakeInput('b'));
    client.solve(fakeInput('c')); // supersedes b's pending slot before it's ever sent
    expect(worker.posted.length).toBe(1); // still just A — b/c are pending, not sent

    // A resolves — but it's stale (c is now the latest desired), so it must NOT publish.
    worker.respond(worker.posted[0].runId, fakeOutput('a'));
    expect(onResult).not.toHaveBeenCalled();

    // Only c should now be dispatched (b was discarded when c superseded it).
    expect(worker.posted.length).toBe(2);
    worker.respond(worker.posted[1].runId, fakeOutput('c'));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toEqual(fakeOutput('c'));
  });

  it('surfaces a worker-reported solve error without crashing the client', () => {
    const worker = new FakeWorker();
    const client = createSolverWorkerClient({ createWorker: () => worker });
    const onResult = jest.fn();
    const onError = jest.fn();
    client.onResult(onResult);
    client.onError(onError);

    client.solve(fakeInput('a'));
    worker.onmessage?.({ data: { runId: worker.posted[0].runId, error: 'boom' } });
    expect(onError).toHaveBeenCalledWith('boom');
    expect(onResult).not.toHaveBeenCalled();
  });

  it('falls back to main-thread solving and keeps working after a worker error', () => {
    jest.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const client = createSolverWorkerClient({ createWorker: () => worker });
      const onError = jest.fn();
      client.onError(onError);

      expect(client.isFallback()).toBe(false);
      worker.triggerError();
      expect(client.isFallback()).toBe(true);
      expect(onError).toHaveBeenCalled();
      expect(worker.terminated).toBe(true);

      const onResult = jest.fn();
      client.onResult(onResult);
      // A minimal-but-real input so the actual solver can run synchronously in fallback mode.
      client.solve({
        boundary: { ring: [] },
        exclusions: [],
        accessPoint: [0, 0],
        stall: { width: 2.4, length: 4.8 },
        aisleWidth: 6,
        boundarySetback: 1,
        exclusionClearance: 1,
      });
      jest.runAllTimers();
      expect(onResult).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('terminate() stops the worker and suppresses any further callbacks', () => {
    const worker = new FakeWorker();
    const client = createSolverWorkerClient({ createWorker: () => worker });
    const onResult = jest.fn();
    client.onResult(onResult);

    client.solve(fakeInput('a'));
    const runId = worker.posted[0].runId;
    client.terminate();
    expect(worker.terminated).toBe(true);

    worker.respond(runId, fakeOutput('a'));
    expect(onResult).not.toHaveBeenCalled();

    // Scheduling after terminate is a no-op, not a crash.
    expect(() => client.solve(fakeInput('b'))).not.toThrow();
    expect(worker.posted.length).toBe(1);
  });

  it('full result has priority over a trailing draft: a draft attempted while a full is active is dropped, and the full still publishes', () => {
    const worker = new FakeWorker();
    const client = createSolverWorkerClient({ createWorker: () => worker });
    const onResult = jest.fn();
    client.onResult(onResult);

    client.solve(fakeInput('full')); // dispatched immediately, now active
    expect(worker.posted.length).toBe(1);

    client.solve(fakeDraftInput('draft')); // full is active -> dropped outright
    expect(worker.posted.length).toBe(1); // never posted to the worker

    worker.respond(worker.posted[0].runId, fakeOutput('full'));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toEqual(fakeOutput('full'));
  });

  it('draft never overwrites committed result: a draft cannot replace a pending full, which still dispatches and publishes', () => {
    const worker = new FakeWorker();
    const client = createSolverWorkerClient({ createWorker: () => worker });
    const onResult = jest.fn();
    client.onResult(onResult);

    client.solve(fakeInput('a')); // dispatched immediately, active
    client.solve(fakeInput('b')); // queued as pending (full)
    client.solve(fakeDraftInput('c')); // pending is a full -> dropped, does NOT replace b
    expect(worker.posted.length).toBe(1); // still just a

    // a resolves — stale, since b already supersedes it as the latest full.
    worker.respond(worker.posted[0].runId, fakeOutput('a'));
    expect(onResult).not.toHaveBeenCalled();

    // b (not the dropped draft c) is what dispatches next.
    expect(worker.posted.length).toBe(2);
    worker.respond(worker.posted[1].runId, fakeOutput('b'));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toEqual(fakeOutput('b'));
  });

  it('a draft error is swallowed (never reaches onError); a full error still does', () => {
    const worker = new FakeWorker();
    const client = createSolverWorkerClient({ createWorker: () => worker });
    const onError = jest.fn();
    client.onError(onError);

    client.solve(fakeDraftInput('d'));
    worker.onmessage?.({ data: { runId: worker.posted[0].runId, error: 'draft boom' } });
    expect(onError).not.toHaveBeenCalled();

    client.solve(fakeInput('f'));
    worker.onmessage?.({ data: { runId: worker.posted[1].runId, error: 'full boom' } });
    expect(onError).toHaveBeenCalledWith('full boom');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('repeated supersession of the pending slot never leaks a stale entry: only the truly-latest input is ever dispatched or published, however many replace it', () => {
    // Regression coverage for the "superseded pending leaks its inputByRunId
    // entry" bug: solve() now deletes the outgoing pending's entry whenever
    // it's replaced. inputByRunId itself is a private implementation detail,
    // so this asserts the fix's only externally-observable guarantee —
    // every superseded pending input (full or draft) is fully discarded,
    // never dispatched, and never published, no matter how many pile up.
    const worker = new FakeWorker();
    const client = createSolverWorkerClient({ createWorker: () => worker });
    const onResult = jest.fn();
    client.onResult(onResult);

    client.solve(fakeInput('active')); // dispatched immediately
    expect(worker.posted.length).toBe(1);

    for (let i = 0; i < 500; i++) {
      client.solve(fakeInput(`churn-${i}`));
    }
    client.solve(fakeInput('final-pending'));

    // Still nothing dispatched beyond the active run — all 501 churned
    // inputs only ever touched the single pending slot.
    expect(worker.posted.length).toBe(1);

    worker.respond(worker.posted[0].runId, fakeOutput('active'));
    expect(onResult).not.toHaveBeenCalled(); // stale — superseded long ago

    expect(worker.posted.length).toBe(2);
    worker.respond(worker.posted[1].runId, fakeOutput('final-pending'));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toEqual(fakeOutput('final-pending'));
  });

  it('uses the main-thread fallback from the start when no Worker can be created', () => {
    jest.useFakeTimers();
    try {
      const client = createSolverWorkerClient({
        createWorker: () => {
          throw new Error('Worker unsupported in this environment');
        },
      });
      expect(client.isFallback()).toBe(true);

      const onResult = jest.fn();
      client.onResult(onResult);
      client.solve({
        boundary: { ring: [] },
        exclusions: [],
        accessPoint: [0, 0],
        stall: { width: 2.4, length: 4.8 },
        aisleWidth: 6,
        boundarySetback: 1,
        exclusionClearance: 1,
      });
      jest.runAllTimers();
      expect(onResult).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
