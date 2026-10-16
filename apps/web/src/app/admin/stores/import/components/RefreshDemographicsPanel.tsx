'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Users } from 'lucide-react'

interface StepResponse {
  success: boolean
  done?: boolean
  stage?: string
  next?: number
  message?: string
  error?: string
  details?: string
}

/**
 * Rebuilds Brand Matcher's town profiles and backtest scores after an import. The route does a
 * short step per request, so this keeps posting the cursor it gets back until the route says it
 * is done, showing each step's message as it goes. Closing the page stops it; running it again
 * starts over, which is safe.
 */
export function RefreshDemographicsPanel() {
  const [running, setRunning] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setRunning(true)
    setError(null)
    setLines([])
    let cursor: { stage?: string; next?: number } = {}
    try {
      for (let step = 0; step < 200; step++) {
        const response = await fetch('/api/admin/stores/refresh-brand-demographics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cursor),
        })
        const body: StepResponse = await response.json().catch(() => ({ success: false }))
        if (!response.ok || !body.success) {
          setError(body.details || body.error || `Refresh failed (${response.status})`)
          return
        }
        if (body.message) setLines((l) => [...l, body.message as string])
        if (body.done) return
        cursor = { stage: body.stage, next: body.next }
      }
      setError('Stopped after 200 steps without finishing')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mt-10 bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Brand Matcher demographics
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-xl">
            After importing stores, rebuild each brand&apos;s town profile and re-test it, so the
            Brand Matcher&apos;s demographic pill reflects the new stores. Takes a few minutes; keep
            this page open until it finishes.
          </p>
        </div>
        <Button onClick={run} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Refreshing…' : 'Refresh demographics'}
        </Button>
      </div>
      {lines.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-gray-700">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  )
}
