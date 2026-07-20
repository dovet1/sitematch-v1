// Client-side fetch wrapper for the planning-applications route.
//
// The route streams NDJSON — progress lines while it fans out across planning
// authorities, then exactly one terminal `result` or `error` line.

import type {
  PlanningApplication,
  PlanningProgress,
  PlanningTruncationReason,
} from '../../types/unified-workspace'

export interface PlanningFetchResult {
  applications: PlanningApplication[]
  truncated: boolean
  truncationReason: PlanningTruncationReason
}

export async function fetchPlanningApplications(
  boundary: GeoJSON.Geometry,
  signal?: AbortSignal,
  onProgress?: (progress: PlanningProgress) => void
): Promise<PlanningFetchResult> {
  const res = await fetch('/api/public/planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boundary }),
    signal,
  })
  // Validation failures short-circuit before the stream opens and come back as
  // plain JSON with a status.
  if (!res.ok) {
    const detail = await res
      .json()
      .then((d) => d?.error)
      .catch(() => null)
    throw new Error(detail || `planning failed (${res.status})`)
  }
  if (!res.body) throw new Error('planning failed (no response body)')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: PlanningFetchResult | null = null
  let streamError: string | null = null

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let msg: { type?: string; error?: string } & Record<string, unknown>
    try {
      msg = JSON.parse(trimmed)
    } catch {
      return // ignore a partial or malformed line rather than failing the run
    }
    if (msg.type === 'progress') {
      onProgress?.({
        done: Number(msg.done) || 0,
        total: Number(msg.total) || 0,
        authority: (msg.authority as string | null) ?? null,
      })
    } else if (msg.type === 'result') {
      result = {
        applications: (msg.applications as PlanningApplication[]) ?? [],
        truncated: Boolean(msg.truncated),
        truncationReason:
          (msg.truncationReason as PlanningTruncationReason) ?? null,
      }
    } else if (msg.type === 'error') {
      streamError = msg.error || 'Planning data failed'
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      handleLine(buffer.slice(0, newline))
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
    }
  }
  handleLine(buffer)

  if (streamError) throw new Error(streamError)
  if (!result) throw new Error('planning failed (incomplete response)')
  return result
}
