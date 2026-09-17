'use client'

import { useEffect, useRef, useState } from 'react'
import { Filter, Mail, MoreHorizontal, PenLine, BoxSelect, Trash2 } from 'lucide-react'
import type { PatchGeometry } from '@/lib/planning-monitor/geometry'
import { selectPatch, usePlanningMonitorStore, type LngLat } from '../../../lib/stores/planning-monitor-store'
import { useFocusTrap } from '../../../lib/hooks/useFocusTrap'
import { usePlanningMode } from './PlanningModeContext'
import { OutlineButton, Spinner, Toggle } from './PlanningUi'

/** The first outer ring of a patch, without its closing point: what boundary editing reshapes. */
export function editableRing(geometry: PatchGeometry): LngLat[] | null {
  // Multi-part patches (uploaded before the redesign) cannot be reshaped vertex by vertex.
  if (geometry.type !== 'Polygon') return null
  const ring = geometry.coordinates[0] as LngLat[]
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring
  // Hundreds of handles are unusable; a simplified display ring is what a user can edit.
  return open.length <= 300 ? open : null
}

/**
 * The patch's ⋯ menu, identical on the panel header and the map chip: rename, edit boundary,
 * edit filters, weekly email, delete.
 */
export function PlanningPatchMenu({ host, dark = false }: { host: 'panel' | 'map'; dark?: boolean }) {
  const menu = usePlanningMonitorStore((s) => s.menu)
  const setMenu = usePlanningMonitorStore((s) => s.setMenu)
  const patch = usePlanningMonitorStore(selectPatch)
  const drawing = usePlanningMonitorStore((s) => s.drawing)
  const { setEmail } = usePlanningMode()
  const [emailBusy, setEmailBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = menu === host
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setMenu])

  if (!patch) return null
  const ring = editableRing(patch.displayGeometry)
  const store = usePlanningMonitorStore.getState
  const emailOn = Boolean(patch.subscription?.emailEnabled)
  const item = 'flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-left text-[13.5px] font-semibold text-sm-ink hover:bg-[#F7F4FF] focus-visible:bg-[#F7F4FF] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Patch menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setMenu(open ? null : host)
        }}
        className={
          'flex h-7 w-7 items-center justify-center rounded-full transition-colors ' +
          (dark ? (open ? 'bg-sm-violet text-white' : 'bg-white/15 text-white hover:bg-sm-violet') : 'text-[#57534E] hover:bg-[#F5F4F2]')
        }
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className={'absolute z-40 mt-2 w-[250px] rounded-sm-menu bg-white p-1.5 shadow-[0_24px_50px_-14px_rgba(0,0,0,.5)] ' + (host === 'panel' ? 'right-0' : 'left-0')}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" role="menuitem" className={item} onClick={() => store().setRenaming(true)}>
            <PenLine size={16} className="text-[#57534E]" /> Rename patch
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!ring}
            title={ring ? undefined : 'This patch has too many points or parts to edit here. Delete it and draw a new one.'}
            className={item + (drawing?.mode === 'edit' ? ' bg-[#F7F4FF] text-sm-violet-deep' : '')}
            onClick={() => ring && store().startBoundaryEdit(ring)}
          >
            <BoxSelect size={16} /> Edit boundary
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => store().openFilters('patch')}>
            <Filter size={16} className="text-[#57534E]" /> Edit filters
          </button>
          <div className={item + ' cursor-default hover:bg-transparent'}>
            <Mail size={16} className="text-[#57534E]" />
            <span className="flex-1">Weekly email</span>
            {emailBusy && <Spinner className="text-[#8A857D]" />}
            <Toggle
              checked={emailOn}
              disabled={emailBusy}
              label="Weekly email"
              onChange={async (next) => {
                setEmailBusy(true)
                setError(null)
                try {
                  await setEmail(next)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not change the email setting')
                } finally {
                  setEmailBusy(false)
                }
              }}
            />
          </div>
          {error && <p role="alert" className="px-3 pb-1 text-[12px] text-[#C0453F]">{error}</p>}
          <div className="my-1 h-px bg-[#EDEBE7]" />
          <button type="button" role="menuitem" className={item + ' text-[#C0453F] hover:bg-[#FDECEB]'} onClick={() => store().setDeleteOpen(true)}>
            <Trash2 size={16} /> Delete patch
          </button>
        </div>
      )}
    </div>
  )
}

/** "Delete West Yorkshire?" — names what is lost, offers the lighter path, no typed confirmation. */
export function PlanningDeleteDialog() {
  const open = usePlanningMonitorStore((s) => s.deleteOpen)
  const setDeleteOpen = usePlanningMonitorStore((s) => s.setDeleteOpen)
  const patch = usePlanningMonitorStore(selectPatch)
  const { deletePatch, digest } = usePlanningMode()
  const ref = useRef<HTMLDivElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = () => !busy && setDeleteOpen(false)
  useFocusTrap(ref, open, close)
  if (!open || !patch) return null

  const weeks = digest.data?.history.filter((h) => h.kind === 'scheduled').length ?? 0
  const ring = editableRing(patch.displayGeometry)
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-[rgba(20,16,10,.45)] p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="pm-delete-title" className="w-[min(420px,100%)] rounded-sm-card bg-white p-6 shadow-[0_26px_60px_-18px_rgba(0,0,0,.6)]">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FDECEB] text-[#C0453F]"><Trash2 size={18} /></span>
        <h2 id="pm-delete-title" className="mt-4 text-[19px] font-bold tracking-[-0.01em] text-sm-ink">Delete {patch.name}?</h2>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[#57534E]">
          You’ll lose the boundary, its filters and <strong className="text-sm-ink">{weeks} weekly {weeks === 1 ? 'summary' : 'summaries'}</strong>.
          {patch.subscription?.emailEnabled ? ' The weekly email stops.' : ''} Applications themselves are unaffected — you can still browse the whole UK.
        </p>
        {ring && (
          <p className="mt-4 rounded-[12px] border border-[#EDEBE7] bg-sm-bg px-3.5 py-3 text-[12.5px] leading-[1.5] text-[#57534E]">
            Only want a different area?{' '}
            <button type="button" className="font-bold text-sm-ink underline-offset-2 hover:underline" onClick={() => usePlanningMonitorStore.getState().startBoundaryEdit(ring)}>
              Edit the boundary
            </button>{' '}
            instead and keep your history.
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-[12.5px] text-[#C0453F]">{error}</p>}
        <div className="mt-5 flex gap-2.5">
          <OutlineButton className="flex-1" onClick={close} data-autofocus disabled={busy}>Keep patch</OutlineButton>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await deletePatch()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'The patch could not be deleted')
              } finally {
                setBusy(false)
              }
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm-btn bg-[#C0453F] px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#A63A35] disabled:opacity-60"
          >
            {busy && <Spinner />} Delete patch
          </button>
        </div>
      </div>
    </div>
  )
}
