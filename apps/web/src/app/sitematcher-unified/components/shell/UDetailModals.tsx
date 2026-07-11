'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, FileText, Users, MapPin } from 'lucide-react'
import { fetchRequirementDetail } from '../../lib/services/requirements-service'
import type {
  MissingFascia,
  RequirementDetail,
  RequirementLocation,
} from '../../types/unified-workspace'
import { Avatar, Kicker } from './UInspector'

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(23,20,25,0.45)] p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-[min(440px,100%)] flex-col gap-3 overflow-auto rounded-2xl bg-sm-surface p-6 shadow-[0_30px_80px_-20px_rgba(20,10,40,0.4)]"
      >
        {children}
      </div>
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      title="Close"
      className="shrink-0 rounded-lg border border-sm-border bg-sm-surface p-1.5 text-sm-ink3 hover:text-sm-ink2"
    >
      <X size={14} />
    </button>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-ink3">
        {k}
      </span>
      <span className="mt-0.5 block truncate text-[13px] font-medium text-sm-ink2">
        {v}
      </span>
    </div>
  )
}

function LocTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-sm-border-soft bg-sm-bg px-2 py-1 text-[11.5px] font-medium text-sm-ink2">
      {children}
    </span>
  )
}

function ContactCard({
  name,
  role,
  email,
  phone,
}: {
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
}) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase()
  const contactLine = [email, phone].filter(Boolean).join(' · ')
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sm-border-soft bg-sm-bg p-3.5">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sm-violet font-semibold text-white">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-sm-ink">{name ?? '—'}</div>
        {role && <div className="text-[12px] text-sm-ink3">{role}</div>}
        {contactLine && (
          <div className="mt-1 truncate font-mono text-[10.5px] text-sm-ink2">
            {contactLine}
          </div>
        )}
      </div>
    </div>
  )
}

function formatVerified(iso: string | null): string {
  if (!iso) return 'Unverified'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unverified'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Shared body for a fetched requirement detail — used by the requirement modal
// and the brand modal's "live requirement" block.
function RequirementDetailBody({ detail }: { detail: RequirementDetail }) {
  const sizeWanted = detail.company.site_size || '—'
  const useClass =
    detail.company.use_class ||
    detail.company.use_classes?.join(', ') ||
    '—'
  const locationTags = detail.locations.is_nationwide
    ? ['Nationwide']
    : detail.locations.all
        .map((l) => l.place_name || l.formatted_address)
        .filter((x): x is string => Boolean(x))

  return (
    <>
      {detail.description && (
        <div className="text-[13.5px] leading-relaxed text-sm-ink2">
          {detail.description}
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 border-y border-sm-border-soft py-3.5">
        <KV k="Size wanted" v={sizeWanted} />
        <KV k="Use class" v={useClass} />
        <KV k="Listing" v={detail.listing_type || '—'} />
        <KV k="Verified" v={formatVerified(detail.verified_at)} />
      </div>
      {locationTags.length > 0 && (
        <div>
          <Kicker>Wants to be in</Kicker>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {locationTags.map((l, i) => (
              <LocTag key={i}>{l}</LocTag>
            ))}
          </div>
        </div>
      )}
      {detail.contacts.primary && (
        <ContactCard
          name={detail.contacts.primary.name}
          role={detail.contacts.primary.title}
          email={detail.contacts.primary.email}
          phone={detail.contacts.primary.phone}
        />
      )}
      <div className="flex gap-2">
        {detail.company.brochure_url && (
          <a
            href={detail.company.brochure_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sm-border bg-sm-surface px-3 py-2 text-[12.5px] font-medium text-sm-ink2 hover:bg-sm-bg"
          >
            <FileText size={13} /> Brochure
          </a>
        )}
        {detail.contacts.primary?.email && (
          <a
            href={`mailto:${detail.contacts.primary.email}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sm-violet px-3 py-2 text-[12.5px] font-medium text-white hover:bg-sm-violet-deep"
          >
            <Users size={13} /> Contact
          </a>
        )}
      </div>
    </>
  )
}

// Fetch wrapper used by both the requirement modal and the brand modal's
// live-requirement block. Returns detail | loading | error.
function useRequirementDetail(listingId: string | null) {
  const [detail, setDetail] = useState<RequirementDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!listingId) {
      setDetail(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchRequirementDetail(listingId, controller.signal)
      .then(setDetail)
      .catch((err) => {
        if (err?.name !== 'AbortError') setError('Could not load this requirement.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [listingId])

  return { detail, loading, error }
}

export function URequirementModal({
  listingId,
  onClose,
}: {
  listingId: string
  onClose: () => void
}) {
  const { detail, loading, error } = useRequirementDetail(listingId)

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-3.5">
        <Avatar label={detail?.company.name ?? '…'} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[19px] font-semibold tracking-[-0.3px] text-sm-ink">
              {detail?.company.name ?? 'Requirement'}
            </div>
            {detail?.locations.is_nationwide && (
              <span className="rounded-full bg-sm-violet-tint px-2 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-violet-deep">
                Nationwide
              </span>
            )}
          </div>
          {detail?.company.sector && (
            <span className="mt-0.5 block font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-violet-deep">
              {detail.company.sector}
            </span>
          )}
        </div>
        <CloseButton onClose={onClose} />
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 text-[12.5px] text-sm-ink3">
          <Loader2 size={14} className="animate-spin" /> Loading requirement…
        </div>
      )}
      {error && (
        <div className="py-6 text-center text-[12.5px] text-[#B23A2C]">{error}</div>
      )}
      {detail && <RequirementDetailBody detail={detail} />}
    </Overlay>
  )
}

export function UBrandModal({
  missing,
  areaName,
  liveRequirement,
  onClose,
}: {
  missing: MissingFascia
  areaName: string
  // A live requirement whose companyName matches this brand, if any.
  liveRequirement: RequirementLocation | undefined
  onClose: () => void
}) {
  const { detail, loading } = useRequirementDetail(
    liveRequirement?.listingId ?? null
  )
  const nearest =
    missing.nearestStoreName || missing.nearestStoreTown
      ? [missing.nearestStoreName, missing.nearestStoreTown]
          .filter(Boolean)
          .join(' · ')
      : '—'
  const nearestDist =
    missing.nearestStoreDistance != null
      ? `${(missing.nearestStoreDistance / 1000).toFixed(1)} km`
      : '—'

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-3.5">
        <Avatar label={missing.brandName || missing.fasciaName} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold tracking-[-0.2px] text-sm-ink">
            {missing.brandName}
          </div>
          {missing.categoryName && (
            <span className="mt-0.5 block font-mono text-[9.5px] font-semibold uppercase tracking-wider text-sm-violet-deep">
              {missing.categoryName}
            </span>
          )}
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 border-y border-sm-border-soft py-3.5">
        <KV k="UK stores" v="—" />
        <KV k="Nearest unit" v={nearest} />
        <KV k="Nearest distance" v={nearestDist} />
        <KV k="Latest UK opening" v="—" />
        <KV k={`In ${areaName}`} v="None" />
        <KV k="Demand" v="—" />
      </div>

      {liveRequirement && (
        <div className="overflow-hidden rounded-xl border border-sm-violet-tint">
          <div className="flex items-center gap-2 border-b border-sm-violet-tint bg-sm-violet-tint-soft px-3.5 py-2.5">
            <MapPin size={13} className="text-sm-violet-deep" />
            <span className="flex-1 text-[12.5px] font-semibold text-sm-ink">
              Live requirement
            </span>
            {detail?.locations.is_nationwide && (
              <span className="rounded-full bg-sm-violet-tint px-2 py-[3px] font-mono text-[9px] font-semibold uppercase tracking-wider text-sm-violet-deep">
                Nationwide
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 p-3.5">
            {loading && (
              <div className="flex items-center gap-2 text-[12.5px] text-sm-ink3">
                <Loader2 size={13} className="animate-spin" /> Loading…
              </div>
            )}
            {detail && <RequirementDetailBody detail={detail} />}
          </div>
        </div>
      )}
    </Overlay>
  )
}
