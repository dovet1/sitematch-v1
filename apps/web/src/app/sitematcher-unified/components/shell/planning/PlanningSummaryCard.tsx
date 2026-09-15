'use client'

import { AlertTriangle, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { formatShortDate } from '../../../lib/planning-monitor-ui'
import type { PatchDigestResponse } from '../../../lib/services/planning-monitor-service'

/**
 * The weekly briefing card. Shows the saved summary exactly as generated, with its period and
 * generation date. It never recycles an old summary as current: an older-revision report is
 * labelled, a failed one says so, and "preparing" is shown while the map stays usable.
 */
export function PlanningSummaryCard({
  data,
  loading,
  error,
  onOpenReport,
  onRetry,
}: {
  data: PatchDigestResponse | null
  loading: boolean
  error: string | null
  onOpenReport: (runId: string) => void
  onRetry: () => void
}) {
  const latest = data?.latest ?? null
  const label = latest
    ? latest.kind === 'scheduled'
      ? `Summary · ${latest.periodLabel}`
      : 'Summary · initial snapshot'
    : 'Weekly summary'
  const ai = latest?.summaryKind === 'ai' || (latest?.summaryKind === 'partial' && latest.summary?.keyChanges.length)

  return (
    <section
      aria-live="polite"
      className="rounded-2xl border border-[#E7DEFF] bg-[linear-gradient(180deg,#F3EFFF,#FAF8FF)] px-5 py-4"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#6C47FF]">
        <Sparkles size={13} aria-hidden />
        <span>{ai ? `AI ${label}` : label}</span>
      </div>

      {loading && !data && (
        <p className="mt-2 flex items-center gap-2 text-[13.5px] text-sm-ink3">
          <Loader2 size={14} className="animate-spin" aria-hidden /> Loading briefing…
        </p>
      )}

      {error && (
        <p className="mt-2 text-[13.5px] text-[#B23A2C]">
          The briefing could not be loaded. <button type="button" className="font-semibold underline" onClick={onRetry}>Try again</button>
        </p>
      )}

      {data && !latest && data.preparing && (
        <p className="mt-2 flex items-center gap-2 text-[14px] leading-[1.55] text-[#2A2833]">
          <Loader2 size={14} className="animate-spin text-[#6C47FF]" aria-hidden />
          Preparing your first briefing. The map is ready to use in the meantime.
        </p>
      )}

      {data && !latest && !data.preparing && (
        <p className="mt-2 text-[14px] leading-[1.55] text-[#2A2833]">
          {data.lastFailed ? 'Your first briefing could not be prepared.' : 'No briefing yet.'}{' '}
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-[#4B23C9] underline-offset-2 hover:underline">
            <RefreshCw size={12} aria-hidden /> Prepare one now
          </button>
        </p>
      )}

      {latest && (
        <>
          {latest.fromOlderRevision && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[12px] text-sm-ink2">
              <AlertTriangle size={13} className="mt-px shrink-0 text-[#B7860B]" aria-hidden />
              Written for your previous criteria{data?.preparing ? '; an updated briefing is being prepared.' : '.'}
            </p>
          )}
          <p className="mt-2 text-[14px] leading-[1.55] text-[#2A2833]">{latest.summary?.overview}</p>
          {latest.summary && latest.summary.keyChanges.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[13.5px] leading-[1.5] text-[#2A2833]">
              {latest.summary.keyChanges.slice(0, 3).map((change, i) => (
                <li key={i}>{change.text}</li>
              ))}
            </ul>
          )}
          {latest.summaryKind === 'fallback' && (
            <p className="mt-2 text-[12px] text-sm-ink3">AI summary unavailable for this report; counts and links are complete.</p>
          )}
          {latest.coverage?.stale && (
            <p className="mt-2 text-[12px] text-[#8A5A00]">Planning data was not fully current when this was prepared.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-sm-ink3">
            <span>
              Prepared {formatShortDate(latest.generatedAt) ?? '—'}
              {data?.nextEmailAt ? ` · next email ${formatShortDate(data.nextEmailAt)}` : ''}
            </span>
            <button
              type="button"
              onClick={() => onOpenReport(latest.runId)}
              className="font-semibold text-[#4B23C9] hover:underline"
            >
              Open full report
            </button>
          </div>
        </>
      )}
    </section>
  )
}
