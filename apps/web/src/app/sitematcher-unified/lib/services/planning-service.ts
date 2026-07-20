// Client-side fetch wrapper for the planning-applications route.

import type { PlanningApplication } from '../../types/unified-workspace'

export async function fetchPlanningApplications(
  boundary: GeoJSON.Geometry,
  signal?: AbortSignal
): Promise<{ applications: PlanningApplication[]; truncated: boolean }> {
  const res = await fetch('/api/public/planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boundary }),
    signal,
  })
  if (!res.ok) {
    const detail = await res
      .json()
      .then((d) => d?.error)
      .catch(() => null)
    throw new Error(detail || `planning failed (${res.status})`)
  }
  const data = await res.json()
  return {
    applications: data.applications ?? [],
    truncated: Boolean(data.truncated),
  }
}
