'use client'

import { useCallback, useEffect } from 'react'
import { createSolverWorkerClient, type SolverWorkerClient } from '@/lib/parking-layout-lab/workerClient'
import type { CandidateLayout, OrientationSummary, SolverInput, SolverOutput } from '@/lib/parking-layout-lab/types'
import { candidateToGeoJSON } from '@/lib/parking-layout-lab/geojson'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'

// --- Orientation-aware candidate stability, mirroring
// apps/web/src/app/parking-layout-lab/components/ParkingLab.tsx's
// pickStableCandidate: a fresh solve re-ranks/re-IDs candidates, so instead
// of always jumping to the new best, follow the previously-selected
// orientation across the recompute. ---
export function representativeAngle(s: OrientationSummary): number {
  return s.kind === 'uniform' ? s.angleDeg : (s.edgeAnglesDeg[0] ?? 0)
}
function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 180
  return Math.min(d, 180 - d)
}
const ORIENTATION_MATCH_TOL_DEG = 5

function pickStableCandidateId(result: SolverOutput, prevCandidate: CandidateLayout | null): string | null {
  const best = result.candidates[0] ?? null
  if (!prevCandidate || result.candidates.length === 0) return best?.candidateId ?? null
  const prevAngle = representativeAngle(prevCandidate.orientationSummary)
  let match: CandidateLayout | null = null
  let matchDiff = Infinity
  for (const c of result.candidates) {
    const d = angleDiff(representativeAngle(c.orientationSummary), prevAngle)
    if (d < matchDiff) {
      matchDiff = d
      match = c
    }
  }
  return (match && matchDiff <= ORIENTATION_MATCH_TOL_DEG ? match : best)?.candidateId ?? null
}

// --- Module-level singleton -------------------------------------------------
// Both the map layer (SketchLayer, for live draft solves while dragging) and
// the Auto panel (for "Create layouts"/"Regenerate" full solves) need to
// share ONE worker client — the workerClient's own "a draft never supersedes
// a full" scheduling protocol only holds if every caller goes through the
// same instance. Reference-counted so the client survives independent
// mount/unmount of either consumer and is only torn down when both are gone.
let sharedClient: SolverWorkerClient | null = null
let refCount = 0

function getSharedClient(): SolverWorkerClient {
  if (!sharedClient) {
    const client = createSolverWorkerClient({ mainThreadFallback: false })
    client.onResult((output: SolverOutput, input: SolverInput) => {
      useSketchStore.getState().setAutoParkingPreviewUpdating(false)

      if (input.draft) {
        const candidate = output.candidates[0] ?? null
        const fc = candidate ? candidateToGeoJSON(input, output, candidate) : null
        useSketchStore.getState().setAutoParkingLivePreview(fc as GeoJSON.FeatureCollection | null)
        return
      }

      const state = useSketchStore.getState()
      const prevCandidate =
        state.autoParkingCandidates.find((c) => c.candidateId === state.autoParkingSelectedCandidateId) ?? null
      const nextSelectedId = pickStableCandidateId(output, prevCandidate)
      state.setAutoParkingCandidates(output.candidates, { input, output }, nextSelectedId)
    })
    client.onError((message: string) => {
      const state = useSketchStore.getState()
      state.setAutoParkingPreviewUpdating(false)
      state.setAutoParkingGenerationStatus('failed', message)
    })
    sharedClient = client
  }
  return sharedClient
}

function releaseSharedClient() {
  if (sharedClient) {
    sharedClient.terminate()
    sharedClient = null
  }
}

/**
 * Owns (a share of) the Auto parking solver's Web Worker client. Constructed
 * with `mainThreadFallback: false`: a ~20s solve blocking the main thread
 * would freeze pan and make Cancel unprocessable, so a missing/failing
 * worker surfaces as a genuine `failed` generation instead of a silent
 * blocking solve.
 *
 * A draft response only ever updates the transient map-only live preview; it
 * never touches candidate cards, metrics, warnings, or the persistence-bound
 * solver run — see `SolverWorkerClient`'s draft-never-supersedes-full
 * protocol in workerClient.ts.
 */
export function useAutoParkingWorker() {
  useEffect(() => {
    refCount += 1
    return () => {
      refCount -= 1
      if (refCount <= 0) {
        refCount = 0
        releaseSharedClient()
      }
    }
  }, [])

  /** Full, authoritative solve — shows the generating state and commits candidate cards. */
  const generate = useCallback((input: SolverInput) => {
    useSketchStore.getState().setAutoParkingGenerationStatus('running')
    useSketchStore.getState().setAutoParkingPhase('generating')
    getSharedClient().solve({ ...input, draft: false })
  }, [])

  /** Cheap, map-only preview solve fired during a drag — never shows the generating state. */
  const generateDraft = useCallback((input: SolverInput, draftOrientationDeg?: number) => {
    useSketchStore.getState().setAutoParkingPreviewUpdating(true)
    getSharedClient().solve({ ...input, draft: true, draftOrientationDeg })
  }, [])

  /**
   * Full solve for an already-visible comparison. Unlike `generate`, this
   * keeps the settings and current layout on screen while the worker replaces
   * them, so sliders can drive the map without reopening the loading state.
   */
  const regenerateLive = useCallback((input: SolverInput) => {
    const state = useSketchStore.getState()
    state.setAutoParkingGenerationStatus('idle')
    state.setAutoParkingPreviewUpdating(true)
    getSharedClient().solve({ ...input, draft: false })
  }, [])

  const cancel = useCallback(() => {
    releaseSharedClient() // lazy-recreate on the next generate()
    useSketchStore.getState().clearAutoParkingGeneration()
    useSketchStore.getState().setAutoParkingPhase('ready')
  }, [])

  return { generate, generateDraft, regenerateLive, cancel }
}
