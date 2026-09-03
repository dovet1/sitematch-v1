/**
 * Parking Layout Lab — latest-only worker client.
 *
 * Owns the "at most one active solve + one pending input" protocol: a new
 * input always replaces whatever was pending, a monotonic run id makes sure a
 * response for a superseded input can never reach the UI, and if the worker
 * can't be created (or errors) solving falls back to the main thread so the
 * lab keeps working — just without the off-thread benefit.
 *
 * Requests are tagged 'draft' or 'full' via `input.draft`. A full request
 * always wins: a draft is dropped outright (never scheduled at all) if a
 * full is running or queued, so a full result can never be superseded or
 * trailed by a draft.
 *
 * Pure glue + a tiny bit of scheduling state. No React.
 */

import { solveParkingLayout } from './solver';
import type { SolverInput, SolverOutput } from './types';
import type { SolverRequestMessage, SolverResponseMessage } from './workerProtocol';

/** The subset of the DOM Worker interface this client needs — easy to fake in tests. */
export type WorkerLike = {
  postMessage: (message: SolverRequestMessage) => void;
  terminate: () => void;
  onmessage: ((event: { data: SolverResponseMessage }) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

export type SolverWorkerClient = {
  /** Schedule a solve for this input. Replaces any not-yet-started pending input. */
  solve: (input: SolverInput) => void;
  onResult: (cb: ((output: SolverOutput, input: SolverInput) => void) | null) => void;
  onError: (cb: ((message: string) => void) | null) => void;
  /** True once the client has given up on the worker and is solving on the main thread. */
  isFallback: () => boolean;
  terminate: () => void;
};

export function createSolverWorkerClient(opts?: {
  createWorker?: () => WorkerLike;
  /** Called once, the first time the client falls back to main-thread solving. */
  onFallback?: () => void;
  /**
   * Default true (the standalone lab's existing behaviour, unchanged): when
   * the Worker is unavailable or errors, solve synchronously on the main
   * thread rather than fail. Pass `false` for callers where a ~20s blocking
   * main-thread solve would freeze pan and make Cancel unprocessable —
   * worker unavailability/error then surfaces as a genuine `onError` instead.
   */
  mainThreadFallback?: boolean;
}): SolverWorkerClient {
  const allowMainThreadFallback = opts?.mainThreadFallback !== false;
  let worker: WorkerLike | null = null;
  let fallbackMode = false;
  /** No worker, and main-thread fallback is disabled: every dispatch errors. */
  let hardFailed = false;
  let hardFailReason = 'The layout worker is unavailable.';
  let terminated = false;

  let counter = 0;
  let latestRunId = 0;
  let activeRunId: number | null = null;
  let pending: { runId: number; input: SolverInput } | null = null;
  const inputByRunId = new Map<number, SolverInput>();
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  let resultCb: ((output: SolverOutput, input: SolverInput) => void) | null = null;
  let errorCb: ((message: string) => void) | null = null;

  const createWorker =
    opts?.createWorker ??
    (() => new Worker(new URL('./solver.worker.ts', import.meta.url)) as unknown as WorkerLike);

  /** A full solve must never be superseded by a draft — see solve() below. */
  function kindOf(input: SolverInput): 'draft' | 'full' {
    return input.draft ? 'draft' : 'full';
  }

  function goFallback(reason: string) {
    if (fallbackMode || hardFailed) return;
    try {
      worker?.terminate();
    } catch {
      /* already gone */
    }
    worker = null;
    if (allowMainThreadFallback) {
      fallbackMode = true;
      errorCb?.(reason);
      opts?.onFallback?.();
    } else {
      hardFailed = true;
      hardFailReason = reason;
    }
    // Retry whatever was in flight — on the main thread if allowed, otherwise
    // the retry itself resolves as the single `onError` for this run.
    if (activeRunId !== null) {
      const input = inputByRunId.get(activeRunId);
      const runId = activeRunId;
      activeRunId = null;
      if (input) dispatch(runId, input);
    }
  }

  try {
    if (typeof Worker === 'undefined' && !opts?.createWorker) {
      if (allowMainThreadFallback) fallbackMode = true;
      else {
        hardFailed = true;
        hardFailReason = 'The layout worker is unavailable in this environment.';
      }
    } else {
      worker = createWorker();
      worker.onmessage = (event) => handleResponse(event.data);
      worker.onerror = () =>
        goFallback(
          allowMainThreadFallback
            ? 'The layout worker failed; falling back to main-thread solving.'
            : 'The layout worker failed.',
        );
    }
  } catch {
    if (allowMainThreadFallback) fallbackMode = true;
    else {
      hardFailed = true;
      hardFailReason = 'The layout worker could not be created.';
    }
    worker = null;
  }

  function dispatch(runId: number, input: SolverInput) {
    if (terminated) return;
    activeRunId = runId;
    if (hardFailed) {
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null;
        handleResponse({ runId, error: hardFailReason });
      }, 0);
    } else if (fallbackMode || !worker) {
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null;
        let response: SolverResponseMessage;
        try {
          response = { runId, output: solveParkingLayout(input) };
        } catch (err) {
          response = { runId, error: err instanceof Error ? err.message : 'Solve failed unexpectedly.' };
        }
        handleResponse(response);
      }, 0);
    } else {
      worker.postMessage({ runId, input });
    }
  }

  function handleResponse(msg: SolverResponseMessage) {
    if (terminated) return;
    if (msg.runId === latestRunId) {
      const input = inputByRunId.get(msg.runId);
      if (msg.error) {
        // A failed draft is a non-issue — it's a discardable preview, and the
        // map just keeps showing the last good one. Only a failed full solve
        // is worth surfacing to the user.
        if (!input || kindOf(input) === 'full') errorCb?.(msg.error);
      } else if (msg.output && input) {
        resultCb?.(msg.output, input);
      }
    }
    inputByRunId.delete(msg.runId);
    activeRunId = null;
    if (pending) {
      const next = pending;
      pending = null;
      dispatch(next.runId, next.input);
    }
  }

  return {
    solve(input: SolverInput) {
      if (terminated) return;
      const kind = kindOf(input);
      if (kind === 'draft') {
        // A full request anywhere in the pipeline (running now, or queued to
        // run next) always wins: drop this draft rather than let it delay or
        // trail the full result. Not scheduled at all, so it can't touch
        // latestRunId/pending and can't ever supersede the full.
        const activeKind = activeRunId !== null ? kindOf(inputByRunId.get(activeRunId)!) : null;
        const pendingKind = pending ? kindOf(pending.input) : null;
        if (activeKind === 'full' || pendingKind === 'full') return;
      }
      const runId = ++counter;
      latestRunId = runId;
      inputByRunId.set(runId, input);
      if (activeRunId === null) {
        dispatch(runId, input);
      } else {
        // Bugfix: a superseded pending run must not leak its input entry.
        if (pending) inputByRunId.delete(pending.runId);
        pending = { runId, input };
      }
    },
    onResult(cb) {
      resultCb = cb;
    },
    onError(cb) {
      errorCb = cb;
    },
    isFallback() {
      return fallbackMode;
    },
    terminate() {
      terminated = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      try {
        worker?.terminate();
      } catch {
        /* already gone */
      }
      worker = null;
      pending = null;
      inputByRunId.clear();
      resultCb = null;
      errorCb = null;
    },
  };
}
