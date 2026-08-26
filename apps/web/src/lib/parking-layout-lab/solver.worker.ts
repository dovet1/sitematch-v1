/**
 * Parking Layout Lab — solver Web Worker entry point.
 *
 * Runs the pure `solveParkingLayout` heuristic off the main thread so
 * during-drag live recompute never blocks map interaction. Pure glue: all
 * geometry logic stays in ./solver.
 */

import { solveParkingLayout } from './solver';
import type { SolverInput } from './types';
import type { SolverRequestMessage, SolverResponseMessage } from './workerProtocol';

self.onmessage = (event: MessageEvent<SolverRequestMessage>) => {
  const { runId, input } = event.data;
  try {
    const output = solveParkingLayout(input as SolverInput);
    const message: SolverResponseMessage = { runId, output };
    (self as unknown as Worker).postMessage(message);
  } catch (err) {
    const message: SolverResponseMessage = {
      runId,
      error: err instanceof Error ? err.message : 'Solve failed unexpectedly.',
    };
    (self as unknown as Worker).postMessage(message);
  }
};
