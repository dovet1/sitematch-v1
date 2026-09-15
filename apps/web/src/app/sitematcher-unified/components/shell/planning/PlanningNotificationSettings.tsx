'use client'

import { useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { MonitorPatch } from '@/lib/planning-monitor/types'
import { useFocusTrap } from '../../../lib/hooks/useFocusTrap'
import { formatShortDate } from '../../../lib/planning-monitor-ui'
import { archivePatch, updateNotifications } from '../../../lib/services/planning-monitor-service'

/** Weekly email preference for one patch, and removing the patch. Neither deletes past reports. */
export function PlanningNotificationSettings({
  patch,
  onClose,
  onUpdated,
  onArchived,
}: {
  patch: MonitorPatch
  onClose: () => void
  onUpdated: (patch: MonitorPatch) => void
  onArchived: (patchId: string) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useFocusTrap(ref, true, onClose)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sub = patch.subscription

  const change = async (changes: { emailEnabled?: boolean; skipQuietWeeks?: boolean }) => {
    setBusy('save')
    setError(null)
    try {
      const res = await updateNotifications(patch.id, changes)
      onUpdated(res.patch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-[rgba(14,21,34,0.45)] p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="pm-notify-title" className="w-[min(440px,100%)] rounded-[18px] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="pm-notify-title" className="text-[18px] font-bold text-sm-ink">{patch.name}: notifications</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-sm-ink3 hover:bg-sm-bg" data-autofocus><X size={18} /></button>
        </div>
        <label className="mt-4 flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#6C47FF]" checked={Boolean(sub?.emailEnabled)} disabled={busy != null} onChange={(e) => change({ emailEnabled: e.target.checked })} />
          <span>
            <span className="block text-[14.5px] font-semibold text-sm-ink">Weekly email briefing</span>
            <span className="block text-[12.5px] text-sm-ink3">
              Mondays at 08:00 UK time.{sub?.emailEnabled && sub.nextDueAt ? ` Next: ${formatShortDate(sub.nextDueAt)}.` : ''}
              {sub?.unsubscribedAt && !sub.emailEnabled ? ` You unsubscribed on ${formatShortDate(sub.unsubscribedAt)}.` : ''}
            </span>
          </span>
        </label>
        {sub?.emailEnabled && (
          <label className="mt-3 flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#6C47FF]" checked={sub.skipQuietWeeks} disabled={busy != null} onChange={(e) => change({ skipQuietWeeks: e.target.checked })} />
            <span className="text-[14px] text-sm-ink2">Skip weeks with no matching changes</span>
          </label>
        )}
        {error && <p role="alert" className="mt-3 text-[13px] text-[#8A2A1F]">{error}</p>}
        <div className="mt-6 flex items-center justify-between border-t border-[#EEECF5] pt-4">
          <button
            type="button"
            disabled={busy != null}
            onClick={async () => {
              if (!window.confirm(`Remove “${patch.name}”? Weekly emails stop. Past reports are kept.`)) return
              setBusy('archive')
              try {
                await archivePatch(patch.id)
                onArchived(patch.id)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not remove patch')
                setBusy(null)
              }
            }}
            className="text-[13px] font-semibold text-[#8A2A1F] hover:underline disabled:opacity-50"
          >
            Remove patch
          </button>
          {busy && <Loader2 size={15} className="animate-spin text-sm-ink3" aria-hidden />}
        </div>
      </div>
    </div>
  )
}
