'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Download, Sparkles, X } from 'lucide-react'
import { groupHighlights, highlightMeta, weekRangeLabel, type DigestGroup } from '@/lib/planning-monitor/digest-groups'
import type { DigestHighlight, DigestReport } from '@/lib/planning-monitor/types'
import { selectPatch, usePlanningMonitorStore } from '../../../lib/stores/planning-monitor-store'
import { useReport } from '../../../lib/hooks/usePlanningMonitor'
import { USE_COLORS, downloadCsv, formatShortDate, milesLabel, toCsv } from '../../../lib/planning-monitor-ui'
import { usePlanningMode } from './PlanningModeContext'
import { markSummarySeen } from './PlanningHomePanel'
import { Spinner, Toggle } from './PlanningUi'

const ROWS_PER_GROUP = 3

const GROUP_DOT: Record<DigestGroup['id'], string> = {
  residential: USE_COLORS.residential.solid,
  commercial: USE_COLORS.commercial.solid,
  mixed: USE_COLORS.mixed.solid,
  decided: '#57534E',
  changes: '#A8A29A',
}

function Counter({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: 'violet' | 'teal' | 'orange' }) {
  const styles = {
    violet: 'bg-[#F7F4FF] border-[#E3DEFA] text-sm-violet-deep',
    teal: 'bg-[#F0FAF8] border-[#D6F0EC] text-[#0B7D72]',
    orange: 'bg-[#FDEEE3] border-[#F7DCC7] text-[#B4531A]',
  }[tone]
  return (
    <div className={`min-w-0 flex-1 rounded-[12px] border px-3.5 py-3 ${styles}`}>
      <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em]">{label}</p>
      <p className="mt-1 text-[22px] font-bold leading-none text-sm-ink">{value.toLocaleString('en-GB')}</p>
      <p className="mt-1.5 truncate text-[11.5px] text-[#57534E]">{sub}</p>
    </div>
  )
}

function HighlightRow({ h, onOpen }: { h: DigestHighlight; onOpen: (h: DigestHighlight) => void }) {
  const kind = h.isResidential && h.isCommercial ? 'mixed' : h.isCommercial ? 'commercial' : 'residential'
  const dot = h.categories ? USE_COLORS[kind].solid : '#A8A29A'
  const docs = h.matchedApplications
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(h)}
        className="flex w-full items-center gap-3 rounded-[12px] border border-[#EDEBE7] px-[14px] py-[13px] text-left transition-colors hover:border-[#E3DEFA] hover:bg-[#FCFBFF]"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-sm-ink">{h.address || h.reference}</span>
          <span className="mt-0.5 block truncate font-mono text-[10.5px] uppercase tracking-[0.04em] text-[#8A857D]">
            {h.categories ? highlightMeta(h) : `${h.headline} · ${h.authorityName}`}
            {h.approximateLocation ? ' · approx. location' : ''}
          </span>
        </span>
        {docs != null && docs > 1 && <span className="shrink-0 font-mono text-[10px] uppercase text-[#8A857D]">{docs} docs</span>}
        <ChevronRight size={15} className="shrink-0 text-[#C9C3BA]" aria-hidden />
      </button>
    </li>
  )
}

function Group({ group, onOpen }: { group: DigestGroup; onOpen: (h: DigestHighlight) => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? group.items : group.items.slice(0, ROWS_PER_GROUP)
  const more = group.items.length - ROWS_PER_GROUP
  const unit = group.id === 'decided' || group.id === 'changes' ? 'application' : 'development'
  return (
    <section className="mt-5">
      <p className="mb-2 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#8A857D]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: GROUP_DOT[group.id] }} aria-hidden />
        {group.label} · {group.items.length} {unit}{group.items.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-2">
        {shown.map((h) => <HighlightRow key={h.applicationId} h={h} onOpen={onOpen} />)}
      </ul>
      {more > 0 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 w-full text-center text-[13px] font-bold text-sm-violet hover:text-sm-violet-deep">
          {all ? 'Show fewer' : `Show ${more} more ${group.label.toLowerCase()}`}
        </button>
      )}
    </section>
  )
}

function weekCsv(report: DigestReport): string {
  return toCsv([
    ['Group', 'Address', 'Authority', 'Reference', 'What happened', 'Dwellings', 'Status', 'Validated', 'Decided', 'Link'],
    ...groupHighlights(report.highlights).flatMap((g) =>
      g.items.map((h) => [g.label, h.address, h.authorityName, h.reference, h.headline, h.dwellings, h.stage, h.dateValidated, h.dateDecided, h.sourceUrl])
    ),
  ])
}

/**
 * 1g/1h · The weekly summary: a panel over the map, not a route. Steps through kept weeks; an
 * older week re-scopes the map behind it to that week's applications.
 */
export function PlanningWeeklySummary() {
  const open = usePlanningMonitorStore((s) => s.summaryOpen)
  const runIdParam = usePlanningMonitorStore((s) => s.summaryRunId)
  const closeSummary = usePlanningMonitorStore((s) => s.closeSummary)
  const showWeek = usePlanningMonitorStore((s) => s.showWeek)
  const patch = usePlanningMonitorStore(selectPatch)
  const { digest, setEmail, refData, pickSingle } = usePlanningMode()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const history = useMemo(() => digest.data?.history ?? [], [digest.data])
  const latestId = history[0]?.runId ?? digest.data?.latest?.runId ?? null
  const runId = runIdParam ?? latestId
  const index = Math.max(0, history.findIndex((h) => h.runId === runId))
  const { report, loading, error } = useReport(open ? runId : null)
  const archived = index > 0

  // An archived week re-scopes the map behind the panel to that week's applications.
  useEffect(() => {
    if (!open || !report || report.runId !== runId) return
    showWeek(runIdParam, archived ? { runId: report.runId, points: report.highlights.filter((h) => h.lng != null && h.lat != null) } : null)
  }, [open, report, runId, runIdParam, archived, showWeek])

  useEffect(() => {
    if (!open) return
    if (patch && runId) markSummarySeen(patch.id, runId)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pickerOpen) setPickerOpen(false)
      else closeSummary()
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, pickerOpen, closeSummary, patch, runId])

  if (!open || !patch) return null

  const go = (i: number) => {
    const target = history[i]
    if (!target) return
    setPickerOpen(false)
    showWeek(i === 0 ? null : target.runId, null)
  }
  const counts = report?.counts ?? null
  const quiet = report?.summaryKind === 'no_changes' || (counts != null && counts.newApplications === 0 && counts.decisions === 0)
  const groups = report ? groupHighlights(report.highlights) : []
  const range = report ? weekRangeLabel(report.periodStart, report.periodEnd) : history[index] ? weekRangeLabel(history[index].periodStart, history[index].periodEnd) : ''
  const proximity = patch.criteria.proximity
  const brandName = proximity ? refData.brands.find((b) => b.id === proximity.brandIds[0])?.name ?? 'your brands' : null
  const ai = report?.summaryKind === 'ai' || (report?.summaryKind === 'partial' && Boolean(report.summary?.keyChanges.length))
  const listed = report ? report.highlights.length + report.omittedHighlights : 0

  const openHighlight = (h: DigestHighlight) => {
    if (h.lng == null || h.lat == null) {
      const url = h.sourceUrl
      if (url && /^https?:\/\//.test(url)) window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    closeSummary()
    pickSingle({
      applicationId: h.applicationId,
      rowKey: h.developmentId ?? `app:${h.applicationId}`,
      developmentId: h.developmentId,
      lngLat: [h.lng, h.lat],
      fly: true,
      relaxed: true,
    })
  }

  return (
    <>
      <div className="absolute inset-0 z-30 bg-[rgba(20,16,10,.42)]" onClick={closeSummary} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Weekly summary for ${patch.name}`}
        className="absolute bottom-0 right-0 top-0 z-40 flex w-[560px] max-w-full animate-[pm-slide-in_200ms_ease-out] flex-col bg-white shadow-[-24px_0_60px_-20px_rgba(0,0,0,.45)] outline-none"
      >
        <style>{'@keyframes pm-slide-in{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}'}</style>
        <header className="border-b border-[#EDEBE7] px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-sm-violet">Weekly summary · {patch.name}</p>
            <button type="button" onClick={closeSummary} aria-label="Close summary" className="-mr-1 -mt-1 rounded-md p-1 text-[#8A857D] hover:bg-[#F5F4F2] hover:text-sm-ink">
              <X size={18} />
            </button>
          </div>
          <h2 className="mt-1.5 text-[25px] font-bold leading-tight tracking-[-0.02em] text-sm-ink">
            {!report ? (loading ? 'Loading week…' : 'Weekly summary') : quiet ? `Nothing new in ${patch.name} this week` : `${counts?.newApplications ?? 0} new application${counts?.newApplications === 1 ? '' : 's'}`}
          </h2>
          {report?.kind !== 'scheduled' && report && <p className="mt-0.5 text-[12.5px] text-[#8A857D]">A snapshot of the last 7 days, prepared {formatShortDate(report.generatedAt)}.</p>}

          {history.length > 0 && (
            <div className="relative mt-3 flex items-center gap-2">
              <button type="button" aria-label="Older week" disabled={index >= history.length - 1} onClick={() => go(index + 1)} className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[#EDEBE7] text-sm-ink hover:bg-sm-bg disabled:opacity-40">
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen(!pickerOpen)}
                className={'inline-flex h-[30px] items-center gap-1.5 rounded-[8px] border px-3 text-[14px] font-bold text-sm-ink ' + (pickerOpen ? 'border-sm-violet shadow-[0_0_0_3px_rgba(112,51,255,.12)]' : 'border-[#EDEBE7] hover:bg-sm-bg')}
              >
                {range} {pickerOpen ? <ChevronUp size={14} className="text-sm-violet" /> : <ChevronDown size={14} className="text-[#8A857D]" />}
              </button>
              <button type="button" aria-label="Newer week" disabled={index === 0} onClick={() => go(index - 1)} className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[#EDEBE7] text-sm-ink hover:bg-sm-bg disabled:bg-[#F5F4F2] disabled:opacity-60">
                <ChevronRight size={15} />
              </button>
              {index === 0 && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8A857D]">Latest week</span>}

              {pickerOpen && (
                <div role="listbox" aria-label="Kept weeks" className="absolute left-8 top-10 z-10 w-[330px] overflow-hidden rounded-sm-menu border border-[#EDEBE7] bg-white shadow-[0_24px_50px_-16px_rgba(0,0,0,.35)]">
                  <p className="border-b border-[#EDEBE7] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8A857D]">
                    Previous weeks · {history.length} kept
                  </p>
                  <ul className="max-h-[320px] overflow-y-auto">
                    {history.map((h, i) => {
                      const current = i === index
                      const n = h.newApplications
                      return (
                        <li key={h.runId}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={current}
                            onClick={() => go(i)}
                            className={'flex w-full items-center justify-between gap-3 border-b border-[#F3F1ED] px-4 py-3 text-left last:border-0 ' + (current ? 'bg-[#F7F4FF]' : 'hover:bg-sm-bg')}
                          >
                            <span className="text-[14px] font-semibold text-sm-ink">
                              {weekRangeLabel(h.periodStart, h.periodEnd, false)}
                              {h.kind !== 'scheduled' && <span className="ml-1.5 text-[11.5px] font-medium text-[#8A857D]">snapshot</span>}
                            </span>
                            <span
                              className={
                                'rounded-[6px] px-2 py-0.5 font-mono text-[10.5px] uppercase ' +
                                (current ? 'bg-sm-violet text-white' : n === 0 ? 'bg-[#F5F4F2] text-[#8A857D]' : 'bg-sm-violet-tint text-sm-violet-deep')
                              }
                            >
                              {n == null ? '—' : `${n} new`}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
          {!latestId && (
            <p className="flex items-center gap-2 text-[13.5px] text-[#57534E]">
              {digest.data?.preparing ? <><Spinner className="text-sm-violet" /> Preparing your first summary…</> : 'No weekly summary yet. The first arrives on Monday.'}
            </p>
          )}
          {error && <p role="alert" className="text-[13px] text-[#C0453F]">{error}</p>}
          {loading && !report && (
            <div className="space-y-3" aria-hidden>
              <div className="flex gap-2.5">{[0, 1, 2].map((i) => <div key={i} className="h-[86px] flex-1 animate-pulse rounded-[12px] bg-[#F5F4F2]" />)}</div>
              <div className="h-[120px] animate-pulse rounded-[14px] bg-[#F7F4FF]" />
            </div>
          )}
          {report && report.status !== 'generated' && <p className="flex items-center gap-2 text-[13.5px] text-[#57534E]"><Spinner /> This week is still being prepared.</p>}

          {report && report.status === 'generated' && (
            <>
              {!quiet && counts && (
                <div className="flex gap-2.5">
                  {counts.newResidential != null ? (
                    <>
                      <Counter tone="violet" label="Residential" value={counts.newResidential} sub={`${(counts.newResidentialDwellings ?? 0).toLocaleString('en-GB')} dwellings`} />
                      <Counter tone="teal" label="Commercial" value={counts.newCommercial ?? 0} sub="new applications" />
                      {proximity ? (
                        <Counter tone="orange" label={`Near ${brandName}`} value={counts.newNearStores ?? 0} sub={`within ${milesLabel(proximity.radiusMeters)}`} />
                      ) : (
                        <Counter tone="orange" label="Decided" value={counts.decisions} sub={`${counts.approvals} approved · ${counts.refusals} refused`} />
                      )}
                    </>
                  ) : (
                    <>
                      <Counter tone="violet" label="New" value={counts.newApplications} sub={`${counts.newDevelopments} developments`} />
                      <Counter tone="teal" label="Decided" value={counts.decisions} sub={`${counts.approvals} approved`} />
                      <Counter tone="orange" label="Homes approved" value={counts.knownNewDwellings} sub="known counts" />
                    </>
                  )}
                </div>
              )}

              {report.summary && (
                <section className={'rounded-[14px] border border-[#E3DEFA] bg-[#F7F4FF] px-4 py-[15px] ' + (quiet ? '' : 'mt-4')}>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-sm-violet">
                    <Sparkles size={12} aria-hidden /> {ai ? 'AI summary of this week' : 'Summary of this week'}
                  </p>
                  <p className="mt-2 text-[13.5px] leading-[1.6] text-[#2A2833]">
                    {quiet ? `Nothing new in ${patch.name} this week. The week is kept here so the quiet is on record.` : report.summary.overview}
                  </p>
                  {!quiet && report.summary.keyChanges.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] leading-[1.55] text-[#2A2833]">
                      {report.summary.keyChanges.map((c, i) => <li key={i}>{c.text}</li>)}
                    </ul>
                  )}
                  {report.summaryKind === 'fallback' && <p className="mt-2 text-[12px] text-[#8A857D]">The AI write-up was unavailable for this week; counts and rows are complete.</p>}
                  {report.summary.caveats.map((c, i) => <p key={i} className="mt-2 text-[12px] text-[#8A857D]">{c}</p>)}
                  {!quiet && (
                    <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A857D]">
                      Generated from the {listed} application{listed === 1 ? '' : 's'} below
                    </p>
                  )}
                </section>
              )}

              {groups.map((g) => <Group key={`${report.runId}-${g.id}`} group={g} onOpen={openHighlight} />)}
              {report.omittedHighlights > 0 && (
                <p className="mt-3 text-[12.5px] text-[#8A857D]">{report.omittedHighlights} further changes are counted above but not listed.</p>
              )}

              {archived && (
                <p className="mt-5 flex items-center gap-2.5 rounded-[12px] border border-[#EDEBE7] bg-sm-bg px-3.5 py-3 text-[12.5px] text-[#57534E]">
                  <Clock size={15} className="shrink-0 text-[#8A857D]" aria-hidden />
                  {report.highlights.some((h) => h.lng != null)
                    ? 'Viewing an archived week. The map shows that week’s applications only.'
                    : 'Viewing an archived week. Map positions weren’t kept for this week, so the map shows your patch as it is now.'}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-[#EDEBE7] px-6 py-3.5">
          <Toggle
            checked={Boolean(patch.subscription?.emailEnabled)}
            disabled={emailBusy}
            label="Email me this every Monday"
            onChange={async (next) => {
              setEmailBusy(true)
              setEmailError(null)
              try {
                await setEmail(next)
              } catch (err) {
                setEmailError(err instanceof Error ? err.message : 'Could not change the email setting')
              } finally {
                setEmailBusy(false)
              }
            }}
          />
          <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-sm-ink">
            Email me this every Monday
            {emailError && <span role="alert" className="block text-[12px] font-normal text-[#C0453F]">{emailError}</span>}
          </span>
          <button
            type="button"
            disabled={!report || report.highlights.length === 0}
            onClick={() => report && downloadCsv(`${patch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${report.periodStart.slice(0, 10)}.csv`, weekCsv(report))}
            className="inline-flex items-center gap-1.5 rounded-sm-btn border border-[#EDEBE7] px-3.5 py-2 text-[13px] font-semibold text-sm-ink hover:bg-sm-bg disabled:opacity-40"
          >
            Export week <Download size={13} />
          </button>
        </footer>
      </div>
    </>
  )
}
