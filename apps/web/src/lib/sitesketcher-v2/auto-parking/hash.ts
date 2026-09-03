/**
 * Auto parking — canonical source hash + derived staleness.
 *
 * PURE MODULE. `sourceHash` is a deterministic fingerprint of everything an
 * applied layout was generated from: the boundary ring, the CURRENT
 * mandatory-exclusion set derived from it, the snapped access point, and the
 * settings snapshot. `isStale` is never stored — always recompute the hash of
 * the layout's current inputs and compare. See INTEGRATION_PLAN.md §3c.
 */

import type { AutoParkingLayout } from '@/types/sitesketcher-v2';
import type { LngLat } from '@/lib/parking-layout-lab/types';
import type { DetectedExclusion } from './detection';

export interface SourceHashInput {
  boundaryRing: LngLat[];
  exclusions: DetectedExclusion[];
  accessPoint: LngLat;
  settingsSnapshot: AutoParkingLayout['settingsSnapshot'];
}

const HASH_VERSION = 'v1';

export function computeSourceHash(input: SourceHashInput): string {
  const sortedExclusions = [...input.exclusions]
    .sort((a, b) => exclusionKey(a).localeCompare(exclusionKey(b)))
    .map((e) => ({ id: e.id, kind: e.kind, ring: e.ring }));

  const payload = stableStringify({
    boundary: input.boundaryRing,
    exclusions: sortedExclusions,
    accessPoint: input.accessPoint,
    settings: input.settingsSnapshot,
  });

  return `${HASH_VERSION}-${fnv1a(payload)}`;
}

/** Recomputes the layout's current hash and compares — never trust a stored flag. */
export function isLayoutStale(layout: Pick<AutoParkingLayout, 'sourceHash'>, currentInput: SourceHashInput): boolean {
  return layout.sourceHash !== computeSourceHash(currentInput);
}

function exclusionKey(e: DetectedExclusion): string {
  return `${e.kind}:${e.id}`;
}

/** Deterministic JSON: object keys sorted, so key insertion order can't perturb the hash. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a 32-bit — fast, dependency-free, more than enough for a staleness fingerprint. */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
