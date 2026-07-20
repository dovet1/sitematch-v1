'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X,
  Loader2,
  FileText,
  Users,
  MapPin,
  Store,
  Globe,
  Mail,
  Phone,
  Search,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import {
  fetchRequirementDetail,
  fetchStoreEstate,
  fetchBrandInfo,
} from '../../lib/services/requirements-service'
import type {
  BrandInfo,
  MissingFascia,
  PlanningApplication,
  RequirementContact,
  RequirementDetail,
  RequirementLocation,
  StoreEstate,
} from '../../types/unified-workspace'
import { Avatar, Kicker, planningStateBadgeClass } from './UInspector'
import { UStoreEstateMap } from './UStoreEstateMap'

// When a requirement names more than this many towns, switch the target-area list from
// flat wrapping tags to a searchable, bounded-scroll box (design states A vs B).
const MANY_AREAS_THRESHOLD = 24

function Overlay({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(23,20,25,0.45)] p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-full flex-col gap-3 overflow-auto rounded-2xl bg-sm-surface p-6 shadow-[0_30px_80px_-20px_rgba(20,10,40,0.4)] ${
          wide ? 'w-[min(840px,100%)]' : 'w-[min(440px,100%)]'
        }`}
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

// Full "12 Feb 2026" date for the estate's latest-store opened line.
function formatFullDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initialsOf(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '—'
}

// Shared body for a fetched requirement detail — used ONLY by the brand modal's
// "live requirement" block (the requirement modal has its own dedicated layout below).
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

// Fetch wrapper used by the requirement modal and the brand modal's live-requirement block.
function useRequirementDetail(requirementId: string | null) {
  const [detail, setDetail] = useState<RequirementDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!requirementId) {
      setDetail(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchRequirementDetail(requirementId, controller.signal)
      .then(setDetail)
      .catch((err) => {
        if (err?.name !== 'AbortError') setError('Could not load this requirement.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [requirementId])

  return { detail, loading, error }
}

// Fetches the brand's store estate for a requirement. Same AbortController pattern.
function useStoreEstate(requirementId: string | null) {
  const [estate, setEstate] = useState<StoreEstate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!requirementId) {
      setEstate(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    fetchStoreEstate(requirementId, controller.signal)
      .then(setEstate)
      .catch((err) => {
        if (err?.name !== 'AbortError') setEstate(null)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [requirementId])

  return { estate, loading }
}

/* ============================================================================
 * Requirement modal — redesigned two-column layout (design_handoff_requirement_modal)
 * ==========================================================================*/

// Left column: brand identity, estate stats, and a full-bleed store map.
function EstateColumn({
  detail,
  requirementId,
}: {
  detail: RequirementDetail
  requirementId: string
}) {
  const { estate, loading } = useStoreEstate(requirementId)
  const { name, logo_url, sector } = detail.company
  const isNationwide = detail.locations.is_nationwide

  const latest = estate?.latestStore
  const latestUnit =
    latest && (latest.name || latest.town)
      ? [latest.name, latest.town].filter(Boolean).join(' · ')
      : '—'
  const openedDate = latest && !latest.dateIsProxy ? formatFullDate(latest.date) : null

  return (
    <div className="flex min-h-0 flex-col border-b border-sm-border-soft bg-sm-bg md:border-b-0 md:border-r">
      {/* Brand identity */}
      <div className="px-[26px] pb-[18px] pt-[26px]">
        <div className="flex items-center gap-3">
          {logo_url ? (
            <img
              src={logo_url}
              alt=""
              className="h-[52px] w-[52px] shrink-0 rounded-[13px] border border-sm-violet-tint object-contain"
            />
          ) : (
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[13px] bg-sm-violet-tint text-[19px] font-bold tracking-[-0.5px] text-sm-violet-deep">
              {initialsOf(name)}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[22px] font-bold leading-tight tracking-[-0.5px] text-sm-ink">
                {name}
              </span>
              {isNationwide && (
                <span className="inline-flex items-center gap-1 rounded-full border border-sm-violet-tint bg-sm-violet-tint-soft px-[9px] py-[3px] text-[10.5px] font-semibold text-sm-violet-deep">
                  <Globe size={11} /> Nationwide
                </span>
              )}
            </div>
            {sector && <div className="mt-[5px]"><Kicker>{sector}</Kicker></div>}
          </div>
        </div>

        <div className="mt-[22px] flex items-center gap-1.5">
          <Store size={15} className="text-sm-violet-deep" strokeWidth={1.5} />
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-sm-violet-deep">
            Store estate
          </span>
        </div>
      </div>

      {/* Estate stats */}
      <div className="grid grid-cols-[auto_1fr] gap-x-[22px] gap-y-1 px-[26px] pb-[18px] pt-0">
        <div>
          <Kicker>UK stores</Kicker>
          <div className="mt-1 text-[17px] font-semibold text-sm-ink">
            {loading ? '—' : (estate?.storeCount ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="min-w-0">
          <Kicker>Latest store</Kicker>
          <div className="mt-1 truncate text-[14.5px] font-medium text-sm-ink">
            {loading ? '—' : latestUnit}
          </div>
          {openedDate && (
            <div className="mt-1 font-mono text-[10.5px] text-sm-ink3">
              Opened {openedDate}
            </div>
          )}
        </div>
      </div>

      {/* Full-bleed map */}
      <div className="min-h-[200px] flex-1">
        <UStoreEstateMap
          stores={estate?.stores ?? []}
          count={estate?.storeCount ?? 0}
        />
      </div>
    </div>
  )
}

// Flat wrapping tag list, or (for many areas) a searchable bounded-scroll box.
function TargetAreas({ locations }: { locations: string[] }) {
  const [query, setQuery] = useState('')
  const many = locations.length > MANY_AREAS_THRESHOLD

  const sorted = many
    ? [...locations].sort((a, b) => a.localeCompare(b))
    : locations
  const filtered = query.trim()
    ? sorted.filter((l) => l.toLowerCase().includes(query.trim().toLowerCase()))
    : sorted

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Kicker>Wants to be in</Kicker>
        <span className="rounded-full border border-sm-border-soft bg-sm-bg px-[9px] py-[3px] font-mono text-[10.5px] font-medium text-sm-ink2">
          {locations.length} {locations.length === 1 ? 'town' : 'towns'}
        </span>
      </div>

      {many && (
        <div className="mb-2.5 flex items-center gap-2 rounded-[10px] border border-sm-border bg-sm-bg px-3 py-2.5">
          <Search size={14} className="shrink-0 text-sm-ink3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search towns…"
            className="w-full bg-transparent text-[13.5px] text-sm-ink placeholder:text-sm-ink3 focus:outline-none"
          />
        </div>
      )}

      <div className={many ? 'max-h-[250px] overflow-auto pr-1' : ''}>
        {filtered.length === 0 ? (
          <div className="py-3 text-[13px] text-sm-ink3">
            No towns match “{query.trim()}”.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((l, i) => (
              <span
                key={`${l}-${i}`}
                className="rounded-full border border-sm-border bg-sm-surface px-3.5 py-2 text-[13.5px] font-medium text-sm-ink2 hover:border-sm-border-hard hover:text-sm-ink"
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NationwidePanel() {
  return (
    <div>
      <div className="mb-2"><Kicker>Target area</Kicker></div>
      <div className="flex gap-3.5 rounded-[14px] border border-sm-violet-tint bg-[linear-gradient(135deg,#F5F1FF,#FBFAF7)] p-[18px]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-sm-violet-tint bg-sm-surface text-sm-violet-deep">
          <Globe size={18} />
        </span>
        <div>
          <div className="text-[15.5px] font-semibold text-sm-ink">
            Open to sites nationwide
          </div>
          <p className="mt-1 text-[13px] leading-[1.55] text-sm-ink2">
            No specific towns named — will consider suitable opportunities across the UK.
            Match on size, use class and catchment rather than location.
          </p>
        </div>
      </div>
    </div>
  )
}

function contactRole(c: RequirementContact): string | null {
  const parts = [c.title, c.org].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function contactCopyText(c: RequirementContact): string {
  return [c.name, contactRole(c), c.email, c.phone].filter(Boolean).join('\n')
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          },
          () => {}
        )
      }}
      className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-sm-border bg-sm-surface px-[11px] py-1.5 text-[12px] font-medium text-sm-ink2 hover:border-sm-border-hard hover:text-sm-ink"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ContactRow({ contact, showChip }: { contact: RequirementContact; showChip: boolean }) {
  const role = contactRole(contact)
  const inHouse = contact.kind === 'in-house'
  return (
    <div className="flex gap-3.5 rounded-[14px] border border-sm-border-soft bg-sm-bg px-[15px] py-3.5">
      <span
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[16px] font-semibold text-white"
        style={{ background: inHouse ? '#7033FF' : '#4A4451' }}
      >
        {initialsOf(contact.name ?? '?')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14.5px] font-semibold text-sm-ink">
            {contact.name ?? '—'}
          </span>
          {showChip && contact.kind && (
            <span className="rounded-[5px] border border-sm-border-soft bg-sm-surface px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.6px] text-sm-ink3">
              {inHouse ? 'In-house' : 'Agency'}
            </span>
          )}
        </div>
        {role && <div className="text-[12.5px] text-sm-ink3">{role}</div>}
        {contact.email && (
          <div className="mt-0.5 truncate font-mono text-[11px] text-sm-ink2">
            {contact.email}
          </div>
        )}
        {contact.phone && (
          <div className="mt-0.5 font-mono text-[11px] text-sm-ink3">{contact.phone}</div>
        )}
      </div>
      <CopyButton text={contactCopyText(contact)} />
    </div>
  )
}

function ContactSection({ contacts }: { contacts: RequirementContact[] }) {
  if (contacts.length === 0) return null
  const multi = contacts.length > 1
  return (
    <div>
      {multi && (
        <div className="mb-2.5 flex items-center gap-2">
          <Kicker>Contacts</Kicker>
          <span className="rounded-full border border-sm-border-soft bg-sm-bg px-[9px] py-[3px] font-mono text-[10.5px] font-medium text-sm-ink2">
            {contacts.length}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {contacts.map((c, i) => (
          <ContactRow key={i} contact={c} showChip={multi} />
        ))}
      </div>
    </div>
  )
}

// The "who / how" chooser opened by the footer Contact button.
function ContactChooser({
  contacts,
  onClose,
}: {
  contacts: RequirementContact[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const multi = contacts.length > 1

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute bottom-[84px] right-[30px] z-30 w-[360px] rounded-2xl border border-sm-border bg-sm-surface p-2 shadow-[0_26px_64px_-22px_rgba(20,10,40,0.55)]"
    >
      <div className="px-2 py-2">
        <Kicker>{multi ? 'Who would you like to contact?' : 'Get in touch'}</Kicker>
      </div>
      <div className="flex flex-col">
        {contacts.map((c, i) => {
          const role = contactRole(c)
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-sm-bg"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-sm-ink">
                  {c.name ?? '—'}
                </div>
                {role && <div className="text-[11.5px] text-sm-ink3">{role}</div>}
              </div>
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  className="inline-flex items-center gap-1.5 rounded-[9px] border border-sm-violet-tint bg-sm-violet-tint-soft px-[11px] py-[7px] text-[12.5px] font-semibold text-sm-violet-deep"
                >
                  <Mail size={13} /> Email
                </a>
              )}
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-[9px] border border-sm-border bg-sm-surface px-[11px] py-[7px] text-[12.5px] font-semibold text-sm-ink2"
                >
                  <Phone size={13} /> Call
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Right column: eyebrow + facts + target areas + contacts, with a pinned action footer.
function DetailColumn({
  detail,
  onClose,
}: {
  detail: RequirementDetail
  onClose: () => void
}) {
  const [chooserOpen, setChooserOpen] = useState(false)
  const sizeWanted = detail.company.site_size || '—'
  const useClass =
    detail.company.use_class || detail.company.use_classes?.join(', ') || '—'
  const contacts = detail.contacts.all
  const brochure = detail.company.brochure_url
  const verified = detail.verified_at ? formatVerified(detail.verified_at) : null

  const locations = detail.locations.all
    .map((l) => l.place_name || l.formatted_address)
    .filter((x): x is string => Boolean(x))

  return (
    <div className="relative flex min-h-0 flex-col">
      <button
        type="button"
        onClick={onClose}
        title="Close"
        className="absolute right-5 top-5 z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full border border-sm-border bg-sm-surface text-sm-ink3 hover:border-sm-border-hard hover:bg-sm-bg hover:text-sm-ink"
      >
        <X size={15} />
      </button>

      <div className="min-h-0 flex-1 overflow-auto px-[30px] pb-5 pt-[26px]">
        <div className="mb-[22px] flex items-center gap-2.5">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-sm-ink2">
            Requirement
          </span>
          {verified && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sm-violet-tint bg-sm-violet-tint-soft px-[11px] py-1 text-[11px] font-semibold text-sm-violet-deep">
              <span className="h-1.5 w-1.5 rounded-full bg-sm-violet" />
              Verified {verified}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <div className="min-w-0">
            <Kicker>Size wanted</Kicker>
            <div className="mt-1 text-[19px] font-semibold tracking-[-0.3px] text-sm-ink">
              {sizeWanted}
            </div>
          </div>
          <div className="min-w-0">
            <Kicker>Use class</Kicker>
            <div className="mt-1 text-[19px] font-semibold tracking-[-0.3px] text-sm-ink">
              {useClass}
            </div>
          </div>
        </div>

        <div className="my-6 border-t border-sm-border-soft" />

        {detail.locations.is_nationwide || locations.length === 0 ? (
          <NationwidePanel />
        ) : (
          <TargetAreas locations={locations} />
        )}

        {contacts.length > 0 && (
          <div className="mt-6">
            <ContactSection contacts={contacts} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-3 border-t border-sm-border-soft bg-sm-surface px-[30px] py-4">
        {brochure && (
          <a
            href={brochure}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[50px] flex-1 items-center justify-center gap-2.5 rounded-[13px] border border-sm-border bg-sm-surface text-[15px] font-semibold text-sm-ink hover:border-sm-border-hard hover:bg-sm-bg"
          >
            <FileText size={16} /> Brochure
          </a>
        )}
        <button
          type="button"
          disabled={contacts.length === 0}
          onClick={() => setChooserOpen((o) => !o)}
          className="inline-flex h-[50px] flex-1 items-center justify-center gap-2.5 rounded-[13px] border border-sm-violet bg-sm-violet text-[15px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(112,51,255,0.6)] hover:bg-sm-violet-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Users size={16} />
          {contacts.length > 1 ? `Contact (${contacts.length})` : 'Contact'}
        </button>
      </div>

      {chooserOpen && contacts.length > 0 && (
        <ContactChooser contacts={contacts} onClose={() => setChooserOpen(false)} />
      )}
    </div>
  )
}

export function URequirementModal({
  requirementId,
  onClose,
}: {
  requirementId: string
  onClose: () => void
}) {
  const { detail, loading, error } = useRequirementDetail(requirementId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 [background:radial-gradient(120%_90%_at_50%_0%,rgba(112,51,255,0.10),transparent_60%),rgba(23,20,25,0.55)] [backdrop-filter:blur(2px)]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-[min(960px,100%)] flex-col overflow-hidden rounded-[22px] bg-sm-surface shadow-[0_40px_120px_-30px_rgba(20,10,40,0.65)] md:h-[632px] md:max-h-[90vh]"
      >
        {loading && (
          <div className="flex flex-1 items-center justify-center gap-2 py-20 text-[13px] text-sm-ink3">
            <Loader2 size={16} className="animate-spin" /> Loading requirement…
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
            <div className="text-[13px] text-[#B23A2C]">{error}</div>
            <CloseButton onClose={onClose} />
          </div>
        )}
        {detail && !loading && (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[372px_1fr]">
            <EstateColumn detail={detail} requirementId={requirementId} />
            <DetailColumn detail={detail} onClose={onClose} />
          </div>
        )}
      </div>
    </div>
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
    liveRequirement?.requirementId ?? null
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

/* ============================================================================
 * Brand info modal — the "no active requirement" sibling of the requirement modal
 * (design_handoff_brand_info_modal). Same two-column shell; left = brand identity +
 * category + store estate + map, right = in-house contacts only.
 * ==========================================================================*/

function useBrandInfo(brandId: string | null) {
  const [data, setData] = useState<BrandInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!brandId) {
      setData(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchBrandInfo(brandId, controller.signal)
      .then(setData)
      .catch((err) => {
        if (err?.name !== 'AbortError') setError('Could not load this brand.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [brandId])

  return { data, loading, error }
}

// Left column: brand identity, category kicker, estate stats, and a full-bleed store map.
function BrandEstateColumn({ brand }: { brand: BrandInfo['brand'] }) {
  const latest = brand.latestStore
  const latestUnit =
    latest && (latest.name || latest.town)
      ? [latest.name, latest.town].filter(Boolean).join(' · ')
      : '—'
  const openedDate = latest ? formatFullDate(latest.openedDate) : null

  // The map component expects StoreEstateStore[]; brand locations carry only coordinates.
  const mapStores = brand.locations.map((l, i) => ({
    id: String(i),
    name: null,
    town: null,
    lat: l.lat,
    lon: l.lon,
  }))

  return (
    <div className="flex min-h-0 flex-col border-b border-sm-border-soft bg-sm-bg md:border-b-0 md:border-r">
      {/* Brand identity */}
      <div className="px-[26px] pb-[18px] pt-[26px]">
        <div className="flex items-center gap-3">
          {brand.logo_url ? (
            <img
              src={brand.logo_url}
              alt=""
              className="h-[52px] w-[52px] shrink-0 rounded-[13px] border border-sm-violet-tint object-contain"
            />
          ) : (
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[13px] bg-sm-violet-tint text-[19px] font-bold tracking-[-0.5px] text-sm-violet-deep">
              {initialsOf(brand.name)}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-[22px] font-bold leading-tight tracking-[-0.5px] text-sm-ink">
              {brand.name}
            </div>
            {brand.category && (
              <div className="mt-[5px]"><Kicker>{brand.category}</Kicker></div>
            )}
          </div>
        </div>

        <div className="mt-[22px] flex items-center gap-1.5">
          <Store size={15} className="text-sm-violet-deep" strokeWidth={1.5} />
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-sm-violet-deep">
            Store estate
          </span>
        </div>
      </div>

      {/* Estate stats */}
      <div className="grid grid-cols-[auto_1fr] gap-x-[22px] gap-y-1 px-[26px] pb-[18px] pt-0">
        <div>
          <Kicker>UK stores</Kicker>
          <div className="mt-1 text-[17px] font-semibold text-sm-ink">
            {brand.storeCount.toLocaleString()}
          </div>
        </div>
        <div className="min-w-0">
          <Kicker>Latest store</Kicker>
          <div className="mt-1 truncate text-[14.5px] font-medium text-sm-ink">
            {latestUnit}
          </div>
          {openedDate && (
            <div className="mt-1 font-mono text-[10.5px] text-sm-ink3">
              Opened {openedDate}
            </div>
          )}
        </div>
      </div>

      {/* Full-bleed map */}
      <div className="min-h-[200px] flex-1">
        <UStoreEstateMap stores={mapStores} count={brand.storeCount} />
      </div>
    </div>
  )
}

// Right column: in-house contacts only, with the balancing rule and empty state.
function BrandContactColumn({
  contacts,
  onClose,
}: {
  contacts: RequirementContact[]
  onClose: () => void
}) {
  const [chooserOpen, setChooserOpen] = useState(false)
  const [centered, setCentered] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const empty = contacts.length === 0
  const multi = contacts.length > 1

  // Balancing rule: if the scroll body doesn't overflow, vertically centre it so a short
  // list balances the dense left column. Empty state is always centred. Re-check via rAF.
  useEffect(() => {
    if (empty) {
      setCentered(true)
      return
    }
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) setCentered(el.scrollHeight <= el.clientHeight)
    })
    return () => cancelAnimationFrame(raf)
  }, [contacts, empty])

  return (
    <div className="relative flex min-h-0 flex-col">
      <button
        type="button"
        onClick={onClose}
        title="Close"
        className="absolute right-5 top-5 z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full border border-sm-border bg-sm-surface text-sm-ink3 hover:border-sm-border-hard hover:bg-sm-bg hover:text-sm-ink"
      >
        <X size={15} />
      </button>

      <div
        ref={scrollRef}
        className={`flex min-h-0 flex-1 flex-col overflow-auto px-[30px] pb-5 pt-[26px] ${
          centered ? 'justify-center' : ''
        }`}
      >
        {empty ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] border border-sm-border-soft bg-sm-bg text-sm-ink4">
              <Users size={22} />
            </span>
            <div className="text-[15.5px] font-semibold text-sm-ink">No contacts listed</div>
            <p className="max-w-[260px] text-[13px] leading-[1.55] text-sm-ink3">
              This brand hasn&apos;t shared in-house property contacts yet.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <Kicker>{multi ? 'In-house contacts' : 'In-house contact'}</Kicker>
              {multi && (
                <span className="rounded-full border border-sm-border-soft bg-sm-bg px-[9px] py-[3px] font-mono text-[10.5px] font-medium text-sm-ink2">
                  {contacts.length}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              {contacts.map((c, i) => (
                <ContactRow key={i} contact={c} showChip={multi} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-3 border-t border-sm-border-soft bg-sm-surface px-[30px] py-4">
        <button
          type="button"
          disabled={empty}
          onClick={() => setChooserOpen((o) => !o)}
          className="inline-flex h-[50px] flex-1 items-center justify-center gap-2.5 rounded-[13px] border border-sm-violet bg-sm-violet text-[15px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(112,51,255,0.6)] hover:bg-sm-violet-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Users size={16} />
          {empty ? 'No contacts' : multi ? `Contact (${contacts.length})` : 'Contact'}
        </button>
      </div>

      {chooserOpen && !empty && (
        <ContactChooser contacts={contacts} onClose={() => setChooserOpen(false)} />
      )}
    </div>
  )
}

/* ============================================================================
 * Planning application modal — opened from the Planning tab list or a map pin.
 * All text comes from PlanIt (third-party councils) and is rendered strictly as
 * React children, never as HTML.
 * ==========================================================================*/

export function UPlanningModal({
  application,
  onClose,
}: {
  application: PlanningApplication
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const validated = formatFullDate(application.dateValidated)
  const decided = formatFullDate(application.decidedDate)

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start gap-3.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={
                'rounded-full px-2 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-wider text-white ' +
                planningStateBadgeClass(application.appState)
              }
            >
              {application.appState}
            </span>
            <Kicker>Planning application</Kicker>
          </div>
          <div className="text-[17px] font-semibold leading-snug tracking-[-0.2px] text-sm-ink">
            {application.address || application.name}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-sm-ink3">
            {application.name}
          </div>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 border-y border-sm-border-soft py-3.5">
        <KV k="Type" v={application.appType || '—'} />
        <KV k="Size" v={application.appSize || '—'} />
        <KV k="Validated" v={validated ?? '—'} />
        <KV k="Decided" v={decided ?? '—'} />
        {application.nDwellings != null && (
          <KV k="Dwellings" v={application.nDwellings.toLocaleString('en-GB')} />
        )}
      </div>

      {application.description && (
        <div>
          <Kicker>Description</Kicker>
          <p className="mt-1.5 max-h-[180px] overflow-auto text-[13px] leading-relaxed text-sm-ink2">
            {application.description}
          </p>
        </div>
      )}

      {(application.applicantAddress || application.agentAddress) && (
        <div className="flex flex-col gap-2.5">
          {application.applicantAddress && (
            <KV k="Applicant address" v={application.applicantAddress} />
          )}
          {application.agentAddress && (
            <KV k="Agent address" v={application.agentAddress} />
          )}
        </div>
      )}

      {application.url && (
        <a
          href={application.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sm-violet px-3 py-2 text-[12.5px] font-medium text-white hover:bg-sm-violet-deep"
        >
          <ExternalLink size={13} /> View application
        </a>
      )}
    </Overlay>
  )
}

export function UBrandInfoModal({
  brandId,
  onClose,
  onActiveRequirement,
}: {
  brandId: string
  onClose: () => void
  // Server-resolved: if this brand actually has a visible active requirement, defer to the
  // requirement modal instead of showing brand info (covers requirements with no map pin).
  onActiveRequirement: (requirementId: string) => void
}) {
  const { data, loading, error } = useBrandInfo(brandId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (data?.activeRequirementId) onActiveRequirement(data.activeRequirementId)
  }, [data?.activeRequirementId, onActiveRequirement])

  const showBrand = data && !data.activeRequirementId

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 [background:radial-gradient(120%_90%_at_50%_0%,rgba(112,51,255,0.10),transparent_60%),rgba(23,20,25,0.55)] [backdrop-filter:blur(2px)]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-[min(960px,100%)] flex-col overflow-hidden rounded-[22px] bg-sm-surface shadow-[0_40px_120px_-30px_rgba(20,10,40,0.65)] md:h-[632px] md:max-h-[90vh]"
      >
        {(loading || (data && data.activeRequirementId)) && (
          <div className="flex flex-1 items-center justify-center gap-2 py-20 text-[13px] text-sm-ink3">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
            <div className="text-[13px] text-[#B23A2C]">{error}</div>
            <CloseButton onClose={onClose} />
          </div>
        )}
        {showBrand && (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[372px_1fr]">
            <BrandEstateColumn brand={data.brand} />
            <BrandContactColumn contacts={data.contacts} onClose={onClose} />
          </div>
        )}
      </div>
    </div>
  )
}
