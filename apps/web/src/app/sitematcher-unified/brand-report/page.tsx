'use client'

import { useEffect, useRef, useState } from 'react'
import { BrandReportDocument } from '../components/shell/brand-matcher/report/BrandReportDocument'
import { fetchBrandReport } from '../lib/services/brand-matcher-service'
import { readReportJob, REPORT_MESSAGE, type BrandReportJob, type BrandReportMessage } from '../lib/brand-report-job'
import { reportFileName } from '../lib/brand-report'
import type { BrandReportResponse } from '../types/brand-matcher'

// The brand report as a printable page (docs/design_handoff_brand_report_export). The Brand
// Matcher dialog loads it in a hidden frame (?embed=1) and prints it once it says it is ready;
// opened directly it shows the last report built in this browser with a Download PDF button.

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; job: BrandReportJob; report: BrandReportResponse }

// Logos come from other hosts; wait for them (or give up on them) before printing.
async function settled(root: HTMLElement, timeoutMs = 5000): Promise<void> {
  const images = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete)
  const loads = images.map(
    (img) =>
      new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
  )
  await Promise.race([
    Promise.all([document.fonts?.ready, ...loads]),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

export default function BrandReportPage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [embedded, setEmbedded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const tell = (msg: { status: 'ready'; title: string } | { status: 'error'; message: string }) => {
    const message: BrandReportMessage = { type: REPORT_MESSAGE, ...msg }
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin)
  }

  useEffect(() => {
    setEmbedded(new URLSearchParams(window.location.search).get('embed') === '1')
    const job = readReportJob()
    if (!job || job.brandIds.length === 0) {
      const message = 'There is no report to show. Create one from your Brand Matcher results.'
      setState({ status: 'error', message })
      tell({ status: 'error', message })
      return
    }
    const ctrl = new AbortController()
    fetchBrandReport({ query: job.query, brandIds: job.brandIds }, ctrl.signal)
      .then((report) => {
        if (report.brands.length === 0)
          throw new Error('None of these brands match the site any more. Run the search again.')
        setState({ status: 'ready', job, report })
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        const message = e instanceof Error ? e.message : 'Could not build the report'
        setState({ status: 'error', message })
        tell({ status: 'error', message })
      })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state.status !== 'ready' || !rootRef.current) return
    // The browser offers the title as the PDF's file name.
    const title = reportFileName(state.job.meta.preparedFor, state.report.site.postcode)
    document.title = title
    let live = true
    void settled(rootRef.current).then(() => {
      if (live) tell({ status: 'ready', title })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <div ref={rootRef} className="min-h-screen bg-[#EFEDF2] font-sans">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .bmr, .bmr * { visibility: visible !important; }
          .bmr-toolbar { display: none !important; }
          main, body { padding: 0 !important; margin: 0 !important; background: #fff !important; }
        }
      `}</style>
      {state.status === 'ready' && !embedded && (
        <div className="bmr-toolbar fixed right-4 top-3.5 z-[100] flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#7033FF] px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-[0_6px_18px_-10px_rgba(20,10,40,.3)] hover:bg-[#5421CC]"
          >
            Download PDF
          </button>
        </div>
      )}
      {state.status === 'loading' && (
        <p className="p-10 text-center text-[14px] text-[#7C7588]">Building your report…</p>
      )}
      {state.status === 'error' && <p className="p-10 text-center text-[14px] text-[#B42323]">{state.message}</p>}
      {state.status === 'ready' && (
        <BrandReportDocument
          site={state.report.site}
          query={state.report.query}
          brands={state.report.brands}
          meta={state.job.meta}
          date={new Date(state.job.createdAt)}
        />
      )}
    </div>
  )
}
