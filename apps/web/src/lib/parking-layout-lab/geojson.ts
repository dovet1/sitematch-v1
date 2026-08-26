/**
 * Parking Layout Lab — GeoJSON export.
 *
 * Pure module. Serialises the solver input + a chosen candidate into a single
 * FeatureCollection with explicit `featureType` properties so the result can be
 * inspected or re-imported. This is a CONCEPTUAL export, not a survey drawing.
 */

import type {
  CandidateLayout,
  LngLat,
  OrientationSummary,
  PolygonInput,
  SolverInput,
  SolverOutput,
} from './types';

type Feature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry:
    | { type: 'Polygon'; coordinates: LngLat[][] }
    | { type: 'Point'; coordinates: LngLat };
};

export type ParkingFeatureCollection = {
  type: 'FeatureCollection';
  properties: Record<string, unknown>;
  features: Feature[];
};

function polygonFeature(
  ring: LngLat[],
  properties: Record<string, unknown>,
): Feature {
  const closed = closeRing(ring);
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Polygon', coordinates: [closed] },
  };
}

function pointFeature(pt: LngLat, properties: Record<string, unknown>): Feature {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Point', coordinates: pt },
  };
}

function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function orientationSummaryLabel(s: OrientationSummary): string {
  if (s.kind === 'uniform') return `uniform ${s.angleDeg}°`;
  if (s.kind === 'perimeter-only') return `perimeter-only (${s.edgeAnglesDeg.join('°, ')}°)`;
  return `mixed (${s.edgeAnglesDeg.join('°, ')}°)`;
}

/**
 * Build the export FeatureCollection for one selected candidate.
 */
export function candidateToGeoJSON(
  input: SolverInput,
  output: SolverOutput,
  candidate: CandidateLayout,
): ParkingFeatureCollection {
  const features: Feature[] = [];

  // Site boundary.
  features.push(
    polygonFeature(closeRing(input.boundary.ring), {
      featureType: 'site-boundary',
    }),
  );

  // Usable (inset) boundary, if any.
  if (output.usableBoundary) {
    features.push(
      polygonFeature(output.usableBoundary.ring, {
        featureType: 'usable-boundary',
        boundarySetbackM: input.boundarySetback,
      }),
    );
  }

  // Exclusions (raw + expanded).
  input.exclusions.forEach((ex: PolygonInput, i: number) => {
    features.push(
      polygonFeature(ex.ring, { featureType: 'exclusion', exclusionIndex: i }),
    );
  });
  output.expandedExclusions.forEach((ex: PolygonInput, i: number) => {
    features.push(
      polygonFeature(ex.ring, {
        featureType: 'exclusion-clearance',
        exclusionIndex: i,
        exclusionClearanceM: input.exclusionClearance,
      }),
    );
  });

  // M2: visibility keepouts (sight-line clearance near junctions/entrances).
  (input.visibilityKeepouts ?? []).forEach((vk: PolygonInput, i: number) => {
    features.push(polygonFeature(vk.ring, { featureType: 'visibility-keepout', keepoutIndex: i }));
  });

  // Snapped access point.
  features.push(
    pointFeature(output.snappedAccessPoint, { featureType: 'access-point' }),
  );

  // Access corridor.
  if (candidate.accessCorridor) {
    features.push(
      polygonFeature(candidate.accessCorridor.ring, {
        featureType: 'access-corridor',
        candidateId: candidate.candidateId,
      }),
    );
  }

  // Drive aisles: perimeter, interior, or spine (entrance connector) roles.
  candidate.driveAisles.forEach((aisle) => {
    features.push(
      polygonFeature(aisle.ring, {
        featureType: 'drive-aisle',
        candidateId: candidate.candidateId,
        aisleId: aisle.aisleId,
        role: aisle.role,
        travelDir: aisle.travelDir ?? null,
      }),
    );
  });

  // Parking rows + individual stalls.
  candidate.rows.forEach((row) => {
    // Row envelope as a convenience (bounding outline of its stalls' extremes).
    features.push(
      polygonFeature(rowEnvelope(row.stalls.flatMap((s) => s.corners)), {
        featureType: 'parking-row',
        candidateId: candidate.candidateId,
        rowId: row.rowId,
        aisleId: row.aisleId,
        loading: row.loading,
        placement: row.placement,
        orientation: row.orientation.rowAngleDeg,
        stallCount: row.stalls.length,
      }),
    );

    row.stalls.forEach((stall) => {
      features.push(
        polygonFeature(stall.corners, {
          featureType: 'parking-stall',
          candidateId: candidate.candidateId,
          rowId: row.rowId,
          aisleId: row.aisleId,
          stallIndex: stall.index,
          loading: row.loading,
          placement: row.placement,
          orientation: row.orientation.rowAngleDeg,
          accessible: !!stall.accessible,
          stallWidthM: input.stall.width,
          stallLengthM: input.stall.length,
        }),
      );
    });
  });

  return {
    type: 'FeatureCollection',
    properties: {
      generator: 'parking-layout-lab',
      disclaimer:
        'Concept layout only. Does not test planning compliance, accessibility, vehicle tracking, gradients, drainage or detailed highway design.',
      candidateId: candidate.candidateId,
      orientationSummary: candidate.orientationSummary,
      orientationLabel: orientationSummaryLabel(candidate.orientationSummary),
      stallCount: candidate.stallCount,
      rowCount: candidate.rows.length,
      parkingFootprintSqm: candidate.parkingFootprintSqm,
      score: candidate.score,
      assumptions: {
        stallWidthM: input.stall.width,
        stallLengthM: input.stall.length,
        aisleWidthM: input.aisleWidth,
        boundarySetbackM: input.boundarySetback,
        exclusionClearanceM: input.exclusionClearance,
      },
      warnings: candidate.warnings,
    },
    features,
  };
}

/** A loose axis-aligned envelope around a set of points (for the row outline). */
function rowEnvelope(points: LngLat[]): LngLat[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ];
}
