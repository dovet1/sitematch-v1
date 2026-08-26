/**
 * Parking Layout Lab — message shapes shared between the worker client and
 * the worker itself. Kept as plain data (no functions) so it's safe to
 * postMessage and easy to fake in tests.
 */

import type { SolverInput, SolverOutput } from './types';

export type SolverRequestMessage = {
  runId: number;
  input: SolverInput;
};

export type SolverResponseMessage =
  | { runId: number; output: SolverOutput; error?: undefined }
  | { runId: number; error: string; output?: undefined };
