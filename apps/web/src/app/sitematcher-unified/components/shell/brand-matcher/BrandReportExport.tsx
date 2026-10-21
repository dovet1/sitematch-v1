'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileText, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useFocusTrap } from '../../../lib/hooks/useFocusTrap'
import { byFit, EMPTY_REPORT_META, PAPER, reportPageCount } from '../../../lib/brand-report'
import {
  readSavedMeta,
  REPORT_MESSAGE,
  saveMeta,
  writeReportJob,
  type BrandReportMessage,
} from '../../../lib/brand-report-job'
import {
  BRAND_REPORT_MAX,
  type BrandMatch,
  type BrandMatcherQuery,
  type BrandReportMeta,
  type BrandReportPaper,
} from '../../../types/brand-matcher'
import { UBrandAvatar } from '../directory/UDirectoryPrimitives'

// Selection + export for the Brand Matcher results (docs/design_handoff_brand_report_export
// §Screens 1–2): the Export menu, the floating selection bar, the toast and the "Create a brand
// report" dialog, which builds the report in a hidden frame and opens the print dialog on it.

export const LIMIT_TOAST = `Reports hold up to ${BRAND_REPORT_MAX} brands. Remove one to add another.`
export const EMPTY_TOAST = `Tick up to ${BRAND_REPORT_MAX} brands, then create your report.`

const EASE = 'ease-[cubic-bezier(.22,1,.36,1)]'

// ---------------------------------------------------------------------------
// Export menu
// ---------------------------------------------------------------------------

export function ExportMenu({
  selected,
  disabled,
  onPdf,
}: {
  selected: number
  disabled: boolean
  onPdf: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = (onClick: () => void, icon: React.ReactNode, title: string, body: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false)
        onClick()
      }}
      className="flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-sm-violet-tint-soft"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sm-violet-tint text-sm-violet-deep">
        {icon}
      </span>
      <span>
        <span className="block text-[14px] font-semibold text-sm-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.4] text-sm-ink3">{body}</span>
      </span>
    </button>
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-xl bg-sm-violet px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:opacity-50"
      >
        <Download size={15} />
        Export
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Export"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[300px] rounded-[14px] border border-[#E3E0E8] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(20,10,40,.25)]"
        >
          {item(
            onPdf,
            <FileText size={15} />,
            `PDF report${selected > 0 ? ` · ${selected} selected` : ''}`,
            `Up to ${BRAND_REPORT_MAX} brands, formatted to share with a client. No contacts.`
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Floating selection bar + toast
// ---------------------------------------------------------------------------

export function SelectionBar({
  count,
  onSelectTop,
  onClear,
  onCreate,
}: {
  count: number
  onSelectTop: () => void
  onClear: () => void
  onCreate: () => void
}) {
  const full = count >= BRAND_REPORT_MAX
  const ghost =
    'whitespace-nowrap rounded-[10px] px-3 py-[9px] text-[13px] font-medium text-white/80 transition-colors hover:bg-white/[.08] hover:text-white'
  return (
    <div
      role="region"
      aria-label="Selected brands"
      className={`pointer-events-auto flex items-center gap-1.5 rounded-2xl bg-[#171419] py-2 pl-[18px] pr-2 text-white shadow-[0_20px_50px_-18px_rgba(20,10,40,.6)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2.5 motion-safe:duration-250 ${EASE}`}
    >
      <div className="mr-2 flex items-center gap-3 whitespace-nowrap text-[14px]">
        <span className={full ? 'text-[#FFC86B]' : undefined} aria-live="polite">
          <b className="font-semibold">{count}</b> of {BRAND_REPORT_MAX} selected
        </span>
        <span className="hidden h-1 w-[72px] overflow-hidden rounded-full bg-white/[.18] sm:block" aria-hidden>
          <span
            className="block h-full rounded-full bg-[#A98BFF] transition-[width] duration-200"
            style={{ width: `${(count / BRAND_REPORT_MAX) * 100}%` }}
          />
        </span>
      </div>
      {!full && (
        <button type="button" onClick={onSelectTop} className={`hidden sm:block ${ghost}`}>
          Select top {BRAND_REPORT_MAX}
        </button>
      )}
      <button type="button" onClick={onClear} className={ghost}>
        Clear
      </button>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-sm-violet px-4 py-[11px] text-[14px] font-semibold text-white transition-colors hover:bg-sm-violet-deep"
      >
        <FileText size={15} />
        Create PDF report
      </button>
    </div>
  )
}

// One message at a time; each new one restarts the 2.6s clock.
export function useToast(): [string | null, (message: string) => void] {
  const [toast, setToast] = useState<{ message: string; at: number } | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])
  return [toast?.message ?? null, (message) => setToast({ message, at: Date.now() })]
}

export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="pointer-events-auto rounded-xl border border-[#E3E0E8] bg-white px-3.5 py-2.5 text-[13.5px] text-sm-ink shadow-[0_14px_30px_-14px_rgba(20,10,40,.3)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2.5 motion-safe:duration-200"
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report dialog
// ---------------------------------------------------------------------------

const INCLUDED = ['Fit score', 'Size fit', 'Use class', 'Acquisitive', 'Demographics', 'Nearest stores', 'Financials']

function useInitialMeta(): { userId: string | null; meta: BrandReportMeta } {
  const { user, profile } = useAuth()
  const userId = user?.id ?? null
  const saved = readSavedMeta(userId)
  const metadata = (user?.user_metadata ?? {}) as {
    full_name?: unknown
    name?: unknown
  }
  const name =
    typeof metadata.full_name === 'string' ? metadata.full_name : typeof metadata.name === 'string' ? metadata.name : ''
  return {
    userId,
    meta: {
      ...EMPTY_REPORT_META,
      preparedBy: name,
      company: profile?.user_company_name ?? '',
      ...saved,
    },
  }
}

type Phase = { kind: 'form' } | { kind: 'building' } | { kind: 'error'; message: string }

const BUILD_TIMEOUT_MS = 90_000

// Loads the report page in a hidden frame and opens the print dialog on it once it is ready.
// Resolves with null when the print dialog opened, or with a message when the build failed.
function buildAndPrint(paper: BrandReportPaper): {
  done: Promise<string | null>
  cancel: () => void
} {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.title = 'Brand report'
  Object.assign(frame.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${PAPER[paper].width}px`,
    height: '200px',
    border: '0',
  })
  let finish: (result: string | null) => void = () => {}
  const done = new Promise<string | null>((resolve) => (finish = resolve))
  let settled = false
  const removeLater = () => {
    // Keep the frame until its print dialog has closed; some browsers print asynchronously.
    const win = frame.contentWindow
    const remove = () => frame.remove()
    win?.addEventListener('afterprint', () => setTimeout(remove, 1000), {
      once: true,
    })
    setTimeout(remove, 10 * 60_000)
  }
  const cleanup = () => {
    window.removeEventListener('message', onMessage)
    clearTimeout(timer)
  }
  const onMessage = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow || e.origin !== window.location.origin) return
    const msg = e.data as BrandReportMessage | null
    if (!msg || msg.type !== REPORT_MESSAGE || settled) return
    settled = true
    cleanup()
    if (msg.status === 'error') {
      frame.remove()
      finish(msg.message)
      return
    }
    // Chrome offers the top document's title as the file name when a frame prints.
    const before = document.title
    document.title = msg.title
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } finally {
      document.title = before
      removeLater()
      finish(null)
    }
  }
  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    cleanup()
    frame.remove()
    finish('The report took too long to build. Try again.')
  }, BUILD_TIMEOUT_MS)
  window.addEventListener('message', onMessage)
  frame.src = '/sitematcher-unified/brand-report?embed=1'
  document.body.appendChild(frame)
  return {
    done,
    cancel: () => {
      if (settled) return
      settled = true
      cleanup()
      frame.remove()
    },
  }
}

export function BrandReportDialog({
  matches,
  query,
  onRemove,
  onClose,
}: {
  // The selected brands.
  matches: BrandMatch[]
  query: BrandMatcherQuery
  onRemove: (brandId: string) => void
  onClose: () => void
}) {
  const initial = useInitialMeta()
  const [meta, setMeta] = useState<BrandReportMeta>(initial.meta)
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const cancelRef = useRef<(() => void) | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const brands = byFit(matches)
  const building = phase.kind === 'building'

  const close = () => {
    cancelRef.current?.()
    onClose()
  }
  useFocusTrap(ref, true, close)
  useEffect(() => () => cancelRef.current?.(), [])

  const up = (k: keyof BrandReportMeta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setMeta((m) => ({ ...m, [k]: e.target.value }))

  const create = async () => {
    if (brands.length === 0) return
    saveMeta(initial.userId, meta)
    const ok = writeReportJob({
      query,
      brandIds: brands.map((b) => b.brandId),
      meta,
      createdAt: new Date().toISOString(),
    })
    if (!ok) {
      setPhase({
        kind: 'error',
        message: "Your browser blocked the report's storage. Allow site data and try again.",
      })
      return
    }
    setPhase({ kind: 'building' })
    const job = buildAndPrint(meta.paper)
    cancelRef.current = job.cancel
    const error = await job.done
    cancelRef.current = null
    if (error) setPhase({ kind: 'error', message: error })
    else onClose()
  }

  const input =
    'w-full rounded-[10px] border border-[#E3E0E8] px-3 py-[11px] text-[14px] text-sm-ink outline-none transition-colors placeholder:text-sm-ink4 focus:border-sm-violet'
  const label = 'flex flex-col gap-1.5 text-[13px] font-medium text-sm-ink2'

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-[rgba(23,20,25,.45)] p-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !building) close()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-report-title"
        className={`relative m-auto w-full max-w-[620px] rounded-[20px] bg-white shadow-[0_30px_70px_-30px_rgba(20,10,40,.45)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[.98] motion-safe:slide-in-from-bottom-2.5 motion-safe:duration-250 ${EASE}`}
      >
        {building ? (
          <div className="flex flex-col items-center gap-3.5 px-7 py-12 text-center" aria-live="polite">
            <span
              className="h-9 w-9 animate-spin rounded-full border-[3px] border-sm-violet-tint border-t-sm-violet"
              aria-hidden
            />
            <h2 id="brand-report-title" className="text-[17px] font-semibold text-sm-ink">
              Building your report
            </h2>
            <p className="text-[14px] text-sm-ink3">
              {brands.length} {brands.length === 1 ? 'brand' : 'brands'} · {reportPageCount(brands.length)} pages
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-1 text-[13px] font-medium text-sm-ink3 hover:text-sm-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#E3E0E8] bg-white text-sm-ink2 transition-colors hover:bg-sm-bg"
            >
              <X size={13} strokeWidth={2.2} />
            </button>
            <div className="px-7 pr-14 pt-6">
              <h2 id="brand-report-title" className="text-[20px] font-bold tracking-[-0.3px] text-sm-ink">
                Create a brand report
              </h2>
              <p className="mt-1.5 text-[14px] leading-[1.5] text-sm-ink2">
                A PDF your client can read without a SiteMatcher account: a cover, a summary of all {brands.length}{' '}
                {brands.length === 1 ? 'brand' : 'brands'}, then one page per brand.
              </p>
            </div>

            <div className="grid gap-3.5 px-7 py-[18px]">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  Prepared for
                  <input
                    data-autofocus
                    value={meta.preparedFor}
                    onChange={up('preparedFor')}
                    placeholder="Client or company name"
                    maxLength={120}
                    className={input}
                  />
                </label>
                <div className={label}>
                  <span id="brand-report-paper">Paper size</span>
                  <div
                    role="radiogroup"
                    aria-labelledby="brand-report-paper"
                    className="flex gap-0.5 rounded-[10px] bg-[#F3F1F6] p-[3px]"
                  >
                    {(['a4', 'letter'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={meta.paper === p}
                        onClick={() => setMeta((m) => ({ ...m, paper: p }))}
                        className={
                          'rounded-lg px-3.5 py-[9px] text-[13px] font-medium transition-colors ' +
                          (meta.paper === p
                            ? 'bg-white text-sm-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]'
                            : 'text-sm-ink2 hover:text-sm-ink')
                        }
                      >
                        {PAPER[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  Prepared by
                  <input value={meta.preparedBy} onChange={up('preparedBy')} maxLength={120} className={input} />
                </label>
                <label className={label}>
                  Company
                  <input value={meta.company} onChange={up('company')} maxLength={120} className={input} />
                </label>
              </div>
              <label className={label}>
                <span>
                  Note on the cover <span className="font-normal text-[#9A94A4]">· optional</span>
                </span>
                <textarea
                  rows={2}
                  value={meta.note}
                  onChange={up('note')}
                  maxLength={400}
                  placeholder="e.g. Brands we think are worth approaching for the High Street unit."
                  className={`${input} resize-none`}
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between text-[13px] font-medium text-sm-ink2">
                  <span>Brands in this report · {brands.length}</span>
                  <span className="font-normal text-[#9A94A4]">Ordered by fit</span>
                </div>
                <div className="max-h-[228px] overflow-y-auto rounded-xl border border-[#ECEAF0]">
                  {brands.length === 0 && (
                    <p className="px-3.5 py-4 text-[13.5px] text-sm-ink3">No brands left. Tick some in the list.</p>
                  )}
                  {brands.map((b, i) => (
                    <div
                      key={b.brandId}
                      className="grid grid-cols-[22px_28px_minmax(0,1fr)_auto_28px] items-center gap-2.5 border-t border-[#F1EFF4] py-2 pl-3.5 pr-2.5 text-[13.5px] first:border-t-0"
                    >
                      <span className="text-[12px] text-[#9A94A4]">{i + 1}</span>
                      <UBrandAvatar
                        id={b.brandId}
                        name={b.name}
                        logoUrl={b.logoUrl}
                        domain={b.domain}
                        size={28}
                        radius={7}
                      />
                      <span className="truncate text-sm-ink">{b.name}</span>
                      <span className="font-semibold tabular-nums text-sm-violet-deep">{b.score}</span>
                      <button
                        type="button"
                        onClick={() => onRemove(b.brandId)}
                        aria-label={`Remove ${b.name}`}
                        title="Remove"
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-sm-ink2 transition-colors hover:bg-[#F5F3F8]"
                      >
                        <X size={12} strokeWidth={2.2} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[13px] font-medium text-sm-ink2">Included for each brand</div>
                <div className="flex flex-wrap gap-1.5">
                  {INCLUDED.map((x) => (
                    <span
                      key={x}
                      className="rounded-full bg-[#EDF8F1] px-2.5 py-1 text-[12px] font-medium text-[#2F855A]"
                    >
                      {x}
                    </span>
                  ))}
                  <span className="rounded-full bg-[#F3F1F6] px-2.5 py-1 text-[12px] font-medium text-sm-ink3 line-through">
                    Contacts
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1EFF4] px-7 pb-[22px] pt-4">
              <span
                className={`text-[12.5px] ${phase.kind === 'error' ? 'text-[#B42323]' : 'text-sm-ink3'}`}
                role={phase.kind === 'error' ? 'alert' : undefined}
              >
                {phase.kind === 'error' ? phase.message : 'Contacts are never included in shared reports.'}
              </span>
              <button
                type="button"
                onClick={() => void create()}
                disabled={brands.length === 0}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-sm-violet px-4 py-[11px] text-[14px] font-semibold text-white transition-colors hover:bg-sm-violet-deep disabled:cursor-not-allowed disabled:bg-[#CFC4F5]"
              >
                <FileText size={15} />
                Create PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
