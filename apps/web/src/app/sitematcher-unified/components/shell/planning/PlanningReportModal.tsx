'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, Map as MapIcon, X } from 'lucide-react'
import type { DigestReport } from '@/lib/planning-monitor/types'
import { useFocusTrap } from '../../../lib/hooks/useFocusTrap'
import { formatShortDate } from '../../../lib/planning-monitor-ui'
import { fetchReport } from '../../../lib/services/planning-monitor-service'

/**
 * A saved report exactly as it was generated: its period, its counts, its summary and the linked
 * applications frozen at the time. "View current map" is a separate action that leaves the report.
 */
export function PlanningReportModal({ runId, onClose, onViewMap }: { runId: string; onClose: () => void; onViewMap: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useFocusTrap(ref, true, onClose)
  const [report, setReport] = useState<DigestReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchReport(runId, controller.signal)
      .then((res) => setReport(res.report))
      .catch((err) => err?.name !== 'AbortError' && setError(err instanceof Error ? err.message : 'Report could not be loaded'))
    return () => controller.abort()
  }, [runId])

  const counts = report?.counts
  const stats = counts
    ? [
        ['New applications', counts.newApplications],
        ['New developments', counts.newDevelopments],
        ['Decisions', counts.decisions],
        ['Approved', counts.approvals],
        ['Refused', counts.refusals],
        ['Withdrawn', counts.withdrawals],
        ['Newly found older applications', counts.lateDiscoveries],
        ['Homes in approved schemes (known counts)', counts.knownNewDwellings],
        ['Watched developments with changes', counts.watchedChanges],
      ] as const
    : []

  return (
    <div className="fixed inset-0 z-[210] flex items-stretch justify-center bg-[rgba(14,21,34,0.55)] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="pm-report-title" className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:w-[min(760px,100%)] sm:rounded-[22px]">
        <header className="flex items-start justify-between border-b border-[#EEECF5] px-6 py-5">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#6C47FF]">
              {report?.kind === 'scheduled' ? 'Weekly report' : 'Initial snapshot'}
            </p>
            <h2 id="pm-report-title" className="mt-1 text-[22px] font-bold text-sm-ink">{report ? `${report.patchName} · ${report.periodLabel}` : 'Report'}</h2>
            {report && <p className="text-[12.5px] text-sm-ink3">Prepared {formatShortDate(report.generatedAt) ?? '—'} · criteria revision {report.revision}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-sm-ink3 hover:bg-sm-bg hover:text-sm-ink" data-autofocus>
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!report && !error && <p className="flex items-center gap-2 text-[13px] text-sm-ink3"><Loader2 size={14} className="animate-spin" aria-hidden /> Loading report…</p>}
          {error && <p role="alert" className="text-[13px] text-[#8A2A1F]">{error}</p>}
          {report && report.status !== 'generated' && <p className="text-[14px] text-sm-ink2">This report is still being prepared.</p>}
          {report?.summary && (
            <section className="rounded-2xl border border-[#E7DEFF] bg-[linear-gradient(180deg,#F3EFFF,#FAF8FF)] px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6C47FF]">{report.summaryKind === 'ai' ? 'AI summary' : 'Summary'}</p>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-[#2A2833]">{report.summary.overview}</p>
              {report.summary.keyChanges.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-[#2A2833]">
                  {report.summary.keyChanges.map((c, i) => <li key={i}>{c.text}</li>)}
                </ul>
              )}
              {report.summary.residentialTheme && <p className="mt-2 text-[14px]"><strong>Residential:</strong> {report.summary.residentialTheme}</p>}
              {report.summary.commercialTheme && <p className="mt-1 text-[14px]"><strong>Commercial:</strong> {report.summary.commercialTheme}</p>}
              {report.summary.watchedChanges.length > 0 && (
                <>
                  <p className="mt-3 text-[13px] font-semibold text-sm-ink">Developments you watch</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px]">{report.summary.watchedChanges.map((c, i) => <li key={i}>{c.text}</li>)}</ul>
                </>
              )}
              {report.summary.caveats.map((c, i) => <p key={i} className="mt-2 text-[12px] text-sm-ink3">{c}</p>)}
            </section>
          )}
          {stats.length > 0 && (
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11.5px] text-sm-ink3">{label}</dt>
                  <dd className="text-[18px] font-bold text-sm-ink">{value.toLocaleString('en-GB')}</dd>
                </div>
              ))}
            </dl>
          )}
          {report && report.highlights.length > 0 && (
            <>
              <h3 className="mt-6 text-[15px] font-bold text-sm-ink">Applications</h3>
              <ul className="mt-2 divide-y divide-[#ECEAF3]">
                {report.highlights.map((h) => (
                  <li key={h.applicationId} className="py-3">
                    <p className="text-[12px] font-semibold text-[#4B23C9]">{h.headline}</p>
                    <p className="text-[14px] font-semibold text-sm-ink">{h.address || h.reference}</p>
                    <p className="text-[12px] text-[#8A8895]">{h.authorityName} · {h.reference}{h.approximateLocation ? ' · approximate location' : ''}</p>
                    {h.sourceUrl && (
                      <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#6C47FF] hover:underline">
                        Council record <ExternalLink size={12} aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {report.omittedHighlights > 0 && <p className="mt-2 text-[12.5px] text-sm-ink3">{report.omittedHighlights} further changes are counted above but not listed.</p>}
            </>
          )}
        </div>
        <footer className="flex justify-end gap-3 border-t border-[#EEECF5] px-6 py-4">
          <button type="button" onClick={onViewMap} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E3EF] px-4 py-2.5 text-[14px] font-semibold text-sm-ink hover:bg-sm-bg">
            <MapIcon size={15} aria-hidden /> View current map
          </button>
        </footer>
      </div>
    </div>
  )
}
