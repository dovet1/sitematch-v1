'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Play, RefreshCw } from 'lucide-react'
import type { RunMatchResponse } from '@/types/floor-area-health'
import { formatInt } from '@/lib/epc/display'

/**
 * Runs one incremental match batch and re-renders the page around it.
 *
 * Deliberately synchronous from the admin's point of view: a batch is capped at 300
 * stores and takes seconds, and a button that returned immediately would leave the
 * reader guessing whether the numbers below it had moved. It can still outlast a
 * browser's patience on a slow run, which is what the note under the button says.
 */
export function RunMatchButton() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunMatchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, startRefresh] = useTransition()

  const run = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/admin/stores/floor-areas/run-match', { method: 'POST' })
      const body: RunMatchResponse = await response.json().catch(() => ({ success: false }))
      if (!response.ok || body.success === false) {
        setError(body.error || `Run failed (${response.status})`)
      } else {
        setResult(body)
        // The counts on this page are server-rendered, so the run has not "finished"
        // from the reader's point of view until they are refetched.
        startRefresh(() => router.refresh())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  const busy = running || refreshing

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <Button onClick={run} disabled={busy}>
        {busy
          ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          : <Play className="h-4 w-4 mr-2" />}
        {running ? 'Matching…' : refreshing ? 'Refreshing…' : 'Run now'}
      </Button>

      {!result && !error && (
        <p className="caption text-muted-foreground max-w-xs md:text-right">
          One batch of up to 300 stores. It may take a minute; the daily cron covers
          whatever is left.
        </p>
      )}

      {result && (
        <p className="caption text-muted-foreground max-w-xs md:text-right">
          {result.considered === 0
            ? (result.message || 'Nothing was awaiting a match.')
            : `Considered ${formatInt(result.considered)} — ${formatInt(result.high)} high, `
              + `${formatInt(result.medium)} medium, ${formatInt(result.low)} low, `
              + `${formatInt(result.none)} none, ${formatInt(result.errored)} errored.`}
        </p>
      )}

      {error && (
        <p className="caption text-error max-w-xs md:text-right">{error}</p>
      )}
    </div>
  )
}
