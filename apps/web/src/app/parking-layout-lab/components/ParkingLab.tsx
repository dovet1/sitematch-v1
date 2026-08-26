'use client';

/**
 * Parking Layout Lab — orchestrator.
 *
 * Owns the workflow state, drives the isolated LabMap, calls the pure solver,
 * and renders candidate summaries + GeoJSON export. Shares nothing with
 * SiteSketcher or the unified workspace.
 *
 * CONCEPTUAL TOOL: the output is a feasibility / yield estimate only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LabMap, { type LabMapHandle } from './LabMap';
import { createSolverWorkerClient, type SolverWorkerClient } from '@/lib/parking-layout-lab/workerClient';
import { candidateToGeoJSON } from '@/lib/parking-layout-lab/geojson';
import type {
  CandidateLayout,
  DestinationPoint,
  LngLat,
  OrientationSummary,
  SolverInput,
  SolverOutput,
} from '@/lib/parking-layout-lab/types';

// --- Orientation-aware candidate stability (see solver.ts's own 5° distinct-
// candidate tolerance in selectDistinct) -----------------------------------
function representativeAngle(s: OrientationSummary): number {
  return s.kind === 'uniform' ? s.angleDeg : (s.edgeAnglesDeg[0] ?? 0);
}
function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}
const ORIENTATION_MATCH_TOL_DEG = 5;

/**
 * A fresh solve's candidates are re-ranked and re-ID'd (`candidate-N` is
 * positional, not stable — see solver.ts's selectDistinct). Instead of
 * always jumping to the new best, follow the previously-selected
 * orientation/strategy across the recompute; only fall back to best when
 * that orientation is no longer offered.
 */
function pickStableCandidate(
  result: SolverOutput,
  prev: CandidateLayout | null,
): CandidateLayout | null {
  const best = result.candidates[0] ?? null;
  if (!prev || result.candidates.length === 0) return best;
  const prevAngle = representativeAngle(prev.orientationSummary);
  let match: CandidateLayout | null = null;
  let matchDiff = Infinity;
  for (const c of result.candidates) {
    const d = angleDiff(representativeAngle(c.orientationSummary), prevAngle);
    if (d < matchDiff) {
      matchDiff = d;
      match = c;
    }
  }
  return match && matchDiff <= ORIENTATION_MATCH_TOL_DEG ? match : best;
}

const STALL_PRESETS = {
  standard: { width: 2.4, length: 4.8, label: 'Standard (2.4 × 4.8 m)' },
  larger: { width: 2.7, length: 5.0, label: 'Larger (2.7 × 5.0 m)' },
} as const;

type StallPreset = keyof typeof STALL_PRESETS;

// A single reasonable passenger-car profile — kept simple (one toggle, not
// six separate inputs) since this is a conceptual approximation either way.
const STANDARD_VEHICLE = { turningRadius: 6, sweptWidth: 2.0, length: 4.8 };

const DISCLAIMER =
  'Concept layout only. This does not test planning compliance, accessibility, vehicle tracking, gradients, drainage or detailed highway design.';

export default function ParkingLab() {
  const mapRef = useRef<LabMapHandle>(null);
  const workerRef = useRef<SolverWorkerClient | null>(null);
  /** The exact input that produced the currently-displayed `output` — selection/export use THIS, not fresh state. */
  const matchedInputRef = useRef<SolverInput | null>(null);

  // --- Workflow input state ------------------------------------------------
  const [boundary, setBoundary] = useState<LngLat[] | null>(null);
  const [exclusions, setExclusions] = useState<LngLat[][]>([]);
  const [accessPoint, setAccessPoint] = useState<LngLat | null>(null);
  const [activeMode, setActiveMode] = useState<'boundary' | 'exclusion' | 'access' | 'destination' | null>(null);

  // --- During-drag geometry overlay: null when not dragging (use the
  // committed boundary/exclusions above); set only by onLiveGeometryChange,
  // and cleared the moment a committed change lands (draw.update etc). Kept
  // separate from `boundary`/`exclusions` so a drag tick can never trigger a
  // FULL solve — only the cheap draft path below reads these. ---
  const [liveBoundary, setLiveBoundary] = useState<LngLat[] | null>(null);
  const [liveExclusions, setLiveExclusions] = useState<LngLat[][] | null>(null);

  // --- Assumptions ---------------------------------------------------------
  const [stallPreset, setStallPreset] = useState<StallPreset>('standard');
  const [aisleWidth, setAisleWidth] = useState(6);
  const [boundarySetback, setBoundarySetback] = useState(1);
  const [exclusionClearance, setExclusionClearance] = useState(1);

  // --- M2: manoeuvring + accessibility + pedestrian routing -----------------
  const [vehicleEnabled, setVehicleEnabled] = useState(false);
  const [oneWay, setOneWay] = useState(false);
  const [gateQueueVehicles, setGateQueueVehicles] = useState(0);
  const [accessibleEnabled, setAccessibleEnabled] = useState(false);
  const [accessibleRatePct, setAccessibleRatePct] = useState(5);
  const [destinations, setDestinations] = useState<DestinationPoint[]>([]);

  // --- Live recompute --------------------------------------------------------
  const [live, setLive] = useState(true);
  const liveRef = useRef(live);
  liveRef.current = live;

  // --- Results -------------------------------------------------------------
  const [output, setOutput] = useState<SolverOutput | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const selectedCandidate: CandidateLayout | null = useMemo(() => {
    if (!output) return null;
    return output.candidates.find((c) => c.candidateId === selectedId) ?? output.candidates[0] ?? null;
  }, [output, selectedId]);
  /** Mirrors `selectedCandidate` for the onResult closure below (registered once on mount). */
  const selectedCandidateRef = useRef<CandidateLayout | null>(null);
  selectedCandidateRef.current = selectedCandidate;

  // --- Worker lifecycle ------------------------------------------------------
  useEffect(() => {
    const client = createSolverWorkerClient();
    workerRef.current = client;
    client.onResult((result, input) => {
      // Any response — draft or full — means whatever solve was in flight has
      // landed; clear the restrained "preview updating" affordance.
      mapRef.current?.setPreviewUpdating(false);

      if (input.draft) {
        // Draft: MAP-ONLY preview. Never touches candidate cards, warnings,
        // export data, or matchedInputRef — only a full solve on release
        // commits the results panel.
        renderCandidate(input, result, result.candidates[0] ?? null);
        return;
      }

      matchedInputRef.current = input;
      setOutput(result);
      setRunError(null);
      setGenerating(false);
      const next = pickStableCandidate(result, selectedCandidateRef.current);
      setSelectedId(next?.candidateId ?? null);
      renderCandidate(input, result, next);
    });
    client.onError((message) => {
      setRunError(message);
      setGenerating(false);
    });
    return () => client.terminate();
  }, []);

  const renderCandidate = (
    input: SolverInput,
    result: SolverOutput,
    candidate: CandidateLayout | null,
  ) => {
    if (!candidate) {
      mapRef.current?.setResultCollection(null);
      return;
    }
    const fc = candidateToGeoJSON(input, result, candidate);
    mapRef.current?.setResultCollection(fc as unknown as GeoJSON.FeatureCollection);
  };

  // --- Invalidation: clear stale results (map + panel) when a non-live edit happens.
  const invalidateResult = useCallback(() => {
    setOutput(null);
    setSelectedId(null);
    setRunError(null);
    matchedInputRef.current = null;
    mapRef.current?.setResultCollection(null);
  }, []);

  // --- Draw callbacks (stable) --------------------------------------------
  // draw.create / draw.delete / draw.update — the DEFINITIVE, committed
  // geometry. Clears any in-progress drag overlay: this update supersedes it.
  const handleBoundaryChange = useCallback(
    (ring: LngLat[] | null) => {
      setBoundary(ring);
      setLiveBoundary(null);
      setLiveExclusions(null);
      if (!liveRef.current) invalidateResult();
    },
    [invalidateResult],
  );
  const handleExclusionsChange = useCallback(
    (rings: LngLat[][]) => {
      setExclusions(rings);
      setLiveBoundary(null);
      setLiveExclusions(null);
      if (!liveRef.current) invalidateResult();
    },
    [invalidateResult],
  );
  const handleAccessPoint = useCallback(
    (pt: LngLat) => {
      setAccessPoint(pt);
      if (!liveRef.current) invalidateResult();
    },
    [invalidateResult],
  );
  const handleModeEnd = useCallback(() => setActiveMode(null), []);
  // draw.render, throttled — a DRAFT trigger only. Kept out of the committed
  // boundary/exclusions state so a drag tick can never itself schedule a full solve.
  const handleLiveGeometryChange = useCallback((draggedBoundary: LngLat[] | null, draggedExclusions: LngLat[][]) => {
    setLiveBoundary(draggedBoundary);
    setLiveExclusions(draggedExclusions);
  }, []);
  const handleDestinationPoint = useCallback(
    (pt: LngLat) => {
      setDestinations((prev) => [...prev, { id: `dest-${Date.now()}-${prev.length}`, point: pt, attachTo: 'boundary' }]);
      if (!liveRef.current) invalidateResult();
    },
    [invalidateResult],
  );
  const handleDestinationRemove = useCallback(
    (id: string) => {
      setDestinations((prev) => prev.filter((d) => d.id !== id));
      if (!liveRef.current) invalidateResult();
    },
    [invalidateResult],
  );

  // --- Mode controls -------------------------------------------------------
  const drawBoundary = () => {
    setActiveMode('boundary');
    mapRef.current?.startBoundary();
  };
  const addExclusion = () => {
    setActiveMode('exclusion');
    mapRef.current?.startExclusion();
  };
  const pickAccess = () => {
    setActiveMode('access');
    mapRef.current?.startAccess();
  };
  const addDestination = () => {
    setActiveMode('destination');
    mapRef.current?.startDestination();
  };
  const deleteSelected = () => mapRef.current?.deleteSelected();
  const clearAll = () => {
    mapRef.current?.clearAll();
    setBoundary(null);
    setExclusions([]);
    setLiveBoundary(null);
    setLiveExclusions(null);
    setAccessPoint(null);
    setDestinations([]);
    setActiveMode(null);
    invalidateResult();
  };

  // --- Build solver input (memoised: selection/export stay tied to what solved it) ---
  const currentInput: SolverInput | null = useMemo(() => {
    if (!boundary || !accessPoint) return null;
    const preset = STALL_PRESETS[stallPreset];
    return {
      boundary: { ring: boundary },
      exclusions: exclusions.map((ring) => ({ ring })),
      accessPoint,
      stall: { width: preset.width, length: preset.length },
      aisleWidth,
      boundarySetback,
      exclusionClearance,
      vehicle: vehicleEnabled ? STANDARD_VEHICLE : undefined,
      oneWay: vehicleEnabled ? oneWay : undefined,
      gateQueue: vehicleEnabled && gateQueueVehicles > 0 ? { vehicles: gateQueueVehicles } : undefined,
      accessible: accessibleEnabled
        ? { rate: accessibleRatePct / 100, bay: { width: 3.6, length: 4.8, sharedAccessWidth: 1.2 } }
        : undefined,
      destinations: destinations.length > 0 ? destinations : undefined,
    };
  }, [
    boundary,
    exclusions,
    accessPoint,
    stallPreset,
    aisleWidth,
    boundarySetback,
    exclusionClearance,
    vehicleEnabled,
    oneWay,
    gateQueueVehicles,
    accessibleEnabled,
    accessibleRatePct,
    destinations,
  ]);

  // --- Full solve: fires on every COMMITTED input change while live is on. ---
  useEffect(() => {
    if (!live || !currentInput) return;
    setGenerating(true);
    workerRef.current?.solve(currentInput);
  }, [live, currentInput]);

  // --- Draft solve: cheap during-drag preview only, built from the live-drag
  // overlay (never the committed boundary/exclusions directly, so a drag
  // tick can't itself trigger a full solve). Null whenever not dragging. ---
  const draftInput: SolverInput | null = useMemo(() => {
    if (!live || (liveBoundary === null && liveExclusions === null)) return null;
    const b = liveBoundary ?? boundary;
    const ex = liveExclusions ?? exclusions;
    if (!b || !accessPoint) return null;
    const preset = STALL_PRESETS[stallPreset];
    return {
      boundary: { ring: b },
      exclusions: ex.map((ring) => ({ ring })),
      accessPoint,
      stall: { width: preset.width, length: preset.length },
      aisleWidth,
      boundarySetback,
      exclusionClearance,
      draft: true,
      draftOrientationDeg: selectedCandidate ? representativeAngle(selectedCandidate.orientationSummary) : undefined,
      // M2 fields intentionally omitted — their absence reproduces M1
      // geometry exactly, which is the cheapest draft path (see solver.ts).
    };
  }, [
    live,
    liveBoundary,
    liveExclusions,
    boundary,
    exclusions,
    accessPoint,
    stallPreset,
    aisleWidth,
    boundarySetback,
    exclusionClearance,
    selectedCandidate,
  ]);

  useEffect(() => {
    if (!draftInput) return;
    mapRef.current?.setPreviewUpdating(true);
    workerRef.current?.solve(draftInput);
  }, [draftInput]);

  // --- Generate (manual button — also used when live is off) ----------------
  const generate = () => {
    if (!currentInput) return;
    setGenerating(true);
    setRunError(null);
    workerRef.current?.solve(currentInput);
  };

  const selectCandidate = (candidate: CandidateLayout) => {
    setSelectedId(candidate.candidateId);
    if (matchedInputRef.current && output) renderCandidate(matchedInputRef.current, output, candidate);
  };

  // --- Export --------------------------------------------------------------
  const exportGeoJSON = () => {
    const input = matchedInputRef.current;
    if (!input || !output || !selectedCandidate) return;
    const fc = candidateToGeoJSON(input, output, selectedCandidate);
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parking-layout-${selectedCandidate.candidateId}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canGenerate = !!boundary && !!accessPoint && !generating;

  return (
    <div className="flex h-screen w-full flex-col bg-sm-bg">
      <Header />
      <div className="flex min-h-0 flex-1">
        {/* Controls */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-sm-border bg-sm-surface">
          <div className="flex-1 space-y-5 p-4">
            <Workflow
              boundary={!!boundary}
              exclusions={exclusions.length}
              access={!!accessPoint}
              hasResult={!!output}
            />

            <Section title="1–3 · Draw the site">
              <div className="grid grid-cols-1 gap-2">
                <ModeButton active={activeMode === 'boundary'} onClick={drawBoundary}>
                  {boundary ? 'Replace site boundary' : 'Draw site boundary'}
                </ModeButton>
                <ModeButton active={activeMode === 'exclusion'} onClick={addExclusion}>
                  Add building / exclusion
                </ModeButton>
                <ModeButton active={activeMode === 'access'} onClick={pickAccess}>
                  {accessPoint ? 'Change access point' : 'Pick access point'}
                </ModeButton>
                <SecondaryButton onClick={deleteSelected}>Delete selected shape</SecondaryButton>
              </div>
              {(activeMode === 'boundary' || activeMode === 'exclusion' || activeMode === 'access') && (
                <p className="mt-2 text-xs text-sm-violet">
                  {activeMode === 'access'
                    ? 'Click near the site boundary to set the access point.'
                    : 'Click on the map to add points; double-click to finish.'}
                </p>
              )}
            </Section>

            <Section title="4 · Parking assumptions">
              <div className="space-y-3">
                <div>
                  <FieldLabel>Stall size</FieldLabel>
                  <div className="mt-1 grid grid-cols-1 gap-1">
                    {(Object.keys(STALL_PRESETS) as StallPreset[]).map((key) => (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                          stallPreset === key
                            ? 'border-sm-violet bg-sm-violet-tint-soft text-sm-ink'
                            : 'border-sm-border text-sm-ink2'
                        }`}
                      >
                        <input
                          type="radio"
                          name="stall"
                          checked={stallPreset === key}
                          onChange={() => {
                            setStallPreset(key);
                            if (!live) invalidateResult();
                          }}
                          className="accent-sm-violet"
                        />
                        {STALL_PRESETS[key].label}
                      </label>
                    ))}
                  </div>
                </div>
                <NumberField
                  label="Drive-aisle width (m)"
                  value={aisleWidth}
                  min={2}
                  max={12}
                  step={0.5}
                  onChange={(v) => {
                    setAisleWidth(v);
                    if (!live) invalidateResult();
                  }}
                />
                <NumberField
                  label="Boundary setback (m)"
                  value={boundarySetback}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(v) => {
                    setBoundarySetback(v);
                    if (!live) invalidateResult();
                  }}
                />
                <NumberField
                  label="Exclusion clearance (m)"
                  value={exclusionClearance}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(v) => {
                    setExclusionClearance(v);
                    if (!live) invalidateResult();
                  }}
                />
              </div>
            </Section>

            <Section title="Manoeuvring & accessibility (optional)">
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-sm-ink2">
                  <input
                    type="checkbox"
                    checked={vehicleEnabled}
                    onChange={(e) => {
                      setVehicleEnabled(e.target.checked);
                      if (!live) invalidateResult();
                    }}
                    className="accent-sm-violet"
                  />
                  Check manoeuvring (standard car: 6 m turning radius)
                </label>
                {vehicleEnabled && (
                  <div className="ml-5 space-y-2 border-l border-sm-border-soft pl-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-sm-ink2">
                      <input
                        type="checkbox"
                        checked={oneWay}
                        onChange={(e) => {
                          setOneWay(e.target.checked);
                          if (!live) invalidateResult();
                        }}
                        className="accent-sm-violet"
                      />
                      One-way circulation
                    </label>
                    <NumberField
                      label="Gate queue (vehicles)"
                      value={gateQueueVehicles}
                      min={0}
                      max={10}
                      step={1}
                      onChange={(v) => {
                        setGateQueueVehicles(v);
                        if (!live) invalidateResult();
                      }}
                    />
                  </div>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-sm-ink2">
                  <input
                    type="checkbox"
                    checked={accessibleEnabled}
                    onChange={(e) => {
                      setAccessibleEnabled(e.target.checked);
                      if (!live) invalidateResult();
                    }}
                    className="accent-sm-violet"
                  />
                  Reserve accessible bays
                </label>
                {accessibleEnabled && (
                  <div className="ml-5 border-l border-sm-border-soft pl-3">
                    <NumberField
                      label="Target rate (%)"
                      value={accessibleRatePct}
                      min={1}
                      max={50}
                      step={1}
                      onChange={(v) => {
                        setAccessibleRatePct(v);
                        if (!live) invalidateResult();
                      }}
                    />
                  </div>
                )}
              </div>
            </Section>

            <Section title="Pedestrian destinations (optional)">
              <div className="grid grid-cols-1 gap-2">
                <ModeButton active={activeMode === 'destination'} onClick={addDestination}>
                  Add destination
                </ModeButton>
              </div>
              {destinations.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {destinations.map((d, i) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between rounded-md border border-sm-border-soft bg-sm-bg px-2 py-1 text-xs text-sm-ink2"
                    >
                      <span>Destination {i + 1}</span>
                      <button
                        onClick={() => handleDestinationRemove(d.id)}
                        className="text-sm-ink4 hover:text-red-600"
                        aria-label={`Remove destination ${i + 1}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {activeMode === 'destination' && (
                <p className="mt-2 text-xs text-sm-violet">Click the map to place a destination.</p>
              )}
            </Section>

            <Section title="5 · Generate">
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-sm-ink2">
                <input
                  type="checkbox"
                  checked={live}
                  onChange={(e) => setLive(e.target.checked)}
                  className="accent-sm-violet"
                />
                Live — recompute while dragging
              </label>
              <div className="grid grid-cols-1 gap-2">
                <PrimaryButton disabled={!canGenerate} onClick={generate}>
                  {generating ? 'Generating…' : output ? 'Regenerate layouts' : 'Generate layouts'}
                </PrimaryButton>
                <SecondaryButton onClick={clearAll}>Clear experiment</SecondaryButton>
              </div>
              {!boundary && (
                <p className="mt-2 text-xs text-sm-ink3">Draw a site boundary to begin.</p>
              )}
              {boundary && !accessPoint && (
                <p className="mt-2 text-xs text-sm-ink3">Pick an access point to enable generation.</p>
              )}
              {runError && <p className="mt-2 text-xs text-red-600">{runError}</p>}
            </Section>

            {output && (
              <ResultsPanel
                output={output}
                selectedId={selectedCandidate?.candidateId ?? null}
                onSelect={selectCandidate}
                onExport={exportGeoJSON}
              />
            )}
          </div>
        </aside>

        {/* Map */}
        <main className="relative min-w-0 flex-1">
          <LabMap
            ref={mapRef}
            onBoundaryChange={handleBoundaryChange}
            onExclusionsChange={handleExclusionsChange}
            onAccessPoint={handleAccessPoint}
            onModeEnd={handleModeEnd}
            live={live}
            onLiveGeometryChange={handleLiveGeometryChange}
            destinations={destinations}
            onDestinationPoint={handleDestinationPoint}
            onDestinationRemove={handleDestinationRemove}
          />
          <Legend />
        </main>
      </div>

      {/* Persistent disclaimer */}
      <footer className="shrink-0 border-t border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
        {DISCLAIMER}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results / candidate comparison.
// ---------------------------------------------------------------------------
function ResultsPanel({
  output,
  selectedId,
  onSelect,
  onExport,
}: {
  output: SolverOutput;
  selectedId: string | null;
  onSelect: (c: CandidateLayout) => void;
  onExport: () => void;
}) {
  return (
    <Section title={`6–7 · Candidates (${output.candidates.length})`}>
      {output.warnings.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          {output.warnings.map((w, i) => (
            <li key={i}>• {w.message}</li>
          ))}
        </ul>
      )}

      {output.candidates.length === 0 ? (
        <p className="text-xs text-sm-ink3">No valid layouts for this configuration.</p>
      ) : (
        <div className="space-y-2">
          {output.candidates.map((c, i) => {
            const selected = c.candidateId === selectedId;
            return (
              <button
                key={c.candidateId}
                onClick={() => onSelect(c)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? 'border-sm-violet bg-sm-violet-tint-soft ring-1 ring-sm-violet'
                    : 'border-sm-border bg-sm-surface hover:border-sm-border-hard'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-sm-ink">
                    Option {i + 1}
                    {i === 0 && (
                      <span className="ml-1.5 rounded bg-sm-violet px-1.5 py-0.5 text-[10px] font-medium text-white">
                        best
                      </span>
                    )}
                  </span>
                  <span className="text-lg font-bold text-sm-violet">{c.stallCount}</span>
                </div>
                <div className="mt-1 text-xs text-sm-ink2">
                  {c.stallCount} spaces · {c.rows.length} rows · {describeOrientation(c.orientationSummary)}
                </div>
                <div className="mt-0.5 text-[11px] text-sm-ink3">
                  ~{Math.round(c.parkingFootprintSqm).toLocaleString()} m² footprint · score{' '}
                  {c.score}
                </div>
                {c.warnings.length > 0 && (
                  <div className="mt-1 text-[11px] text-amber-700">
                    ⚠ {c.warnings.length} warning{c.warnings.length > 1 ? 's' : ''}
                  </div>
                )}
              </button>
            );
          })}

          <SelectedDetails
            candidate={output.candidates.find((c) => c.candidateId === selectedId) ?? null}
          />

          <PrimaryButton onClick={onExport} disabled={!selectedId}>
            8 · Export selected as GeoJSON
          </PrimaryButton>
        </div>
      )}
    </Section>
  );
}

function describeOrientation(summary: OrientationSummary): string {
  if (summary.kind === 'uniform') return `${summary.angleDeg}°`;
  if (summary.kind === 'perimeter-only') return `perimeter only (${summary.edgeAnglesDeg.join('°, ')}°)`;
  return `mixed (${summary.edgeAnglesDeg.join('°, ')}°)`;
}

function SelectedDetails({ candidate }: { candidate: CandidateLayout | null }) {
  if (!candidate) return null;
  return (
    <div className="rounded-md border border-sm-border-soft bg-sm-bg p-2.5 text-xs text-sm-ink2">
      <div className="font-medium text-sm-ink">Selected: {candidate.stallCount} spaces</div>
      <div className="mt-1">Orientation: {describeOrientation(candidate.orientationSummary)}</div>
      {candidate.warnings.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {candidate.warnings.map((w, i) => (
            <li key={i} className="text-amber-700">
              ⚠ {w.message}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-sm-ink3">No warnings for this candidate.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational bits.
// ---------------------------------------------------------------------------
function Header() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-sm-border bg-sm-surface px-4 py-2.5">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-sm-ink">Parking Layout Lab</h1>
        <span className="rounded-full bg-sm-orange-tint px-2 py-0.5 text-[10px] font-medium text-sm-orange-deep">
          Experimental
        </span>
      </div>
      <span className="text-[11px] text-sm-ink3">Conceptual yield analysis · not planning-compliant</span>
    </header>
  );
}

function Workflow({
  boundary,
  exclusions,
  access,
  hasResult,
}: {
  boundary: boolean;
  exclusions: number;
  access: boolean;
  hasResult: boolean;
}) {
  const steps = [
    { done: boundary, label: 'Boundary' },
    { done: true, label: `Exclusions (${exclusions})` },
    { done: access, label: 'Access point' },
    { done: hasResult, label: 'Layouts' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((s, i) => (
        <span
          key={i}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            s.done ? 'bg-sm-violet-tint text-sm-violet-deep' : 'bg-sm-bg text-sm-ink4'
          }`}
        >
          {s.done ? '✓ ' : ''}
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sm-ink3">{title}</h2>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-sm-ink2">{children}</span>;
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="w-20 rounded-md border border-sm-border bg-sm-surface px-2 py-1 text-right text-xs text-sm-ink focus:border-sm-violet focus:outline-none"
      />
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-sm-violet px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-sm-border bg-sm-surface px-3 py-2 text-sm font-medium text-sm-ink2 transition-colors hover:border-sm-border-hard hover:text-sm-ink"
    >
      {children}
    </button>
  );
}

function ModeButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-sm-violet bg-sm-violet text-white'
          : 'border-sm-border bg-sm-surface text-sm-ink2 hover:border-sm-violet hover:text-sm-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Legend() {
  const items = [
    { c: '#6D28D9', label: 'Site / exclusion' },
    { c: '#F97316', label: 'Access point' },
    { c: '#F59E0B', label: 'Access corridor' },
    { c: '#FBBF24', label: 'Entrance connector (spine)' },
    { c: '#D1D5DB', label: 'Perimeter drive aisle' },
    { c: '#E5E7EB', label: 'Interior drive aisle' },
    { c: '#A78BFA', label: 'Turning bay' },
    { c: '#1D4ED8', label: 'Perimeter stalls' },
    { c: '#2563EB', label: 'Interior stalls' },
    { c: '#10B981', label: 'Usable boundary' },
    { c: '#EF4444', label: 'Exclusion clearance' },
    { c: '#F97316', label: 'Visibility keepout' },
    { c: '#0D9488', label: 'Pedestrian corridor' },
    { c: '#DC2626', label: 'Pedestrian crossing' },
    { c: '#14B8A6', label: 'Destination' },
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/90 p-2.5 text-[11px] shadow-md ring-1 ring-black/5">
      <div className="mb-1 font-semibold text-sm-ink">Legend</div>
      <div className="grid grid-cols-1 gap-1">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: it.c }}
            />
            <span className="text-sm-ink2">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
