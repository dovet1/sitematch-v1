'use client'

import { forwardRef, useState } from 'react'
import { ChevronDown, Inbox, Mail, Phone, UserRound } from 'lucide-react'
import { initialsFor } from '../directory/UDirectoryPrimitives'
import { CONTACT_CORRECTIONS_EMAIL } from '../../../lib/brand-matcher'
import type { BrandMatcherContact, BrandMatcherContacts } from '../../../types/brand-matcher'
import { Kicker, numberWord } from './BrandMatcherUi'

// Beyond this many, show primary + two and let the count chip open the full list (handoff).
const COMPACT_OTHERS = 2

function roleLine(c: BrandMatcherContact): string | null {
  if (c.title && c.area) return `${c.title} — ${c.area}`
  return c.title ?? c.area
}

function mailto(emails: string[], subject: string): string {
  return `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}`
}

export const BrandContactsPanel = forwardRef<
  HTMLDivElement,
  { brandName: string; contacts: BrandMatcherContacts; subject: string }
>(function BrandContactsPanel({ brandName, contacts, subject }, ref) {
  const [showAll, setShowAll] = useState(false)
  const { primary, others, total, coversRegion } = contacts

  if (!primary) {
    return (
      <div ref={ref} className="rounded-2xl border border-sm-border bg-sm-surface p-4">
        <div className="flex items-center justify-between">
          <Kicker>Who to contact</Kicker>
          <span className="rounded-full bg-sm-border-soft px-2 py-0.5 text-[10.5px] font-semibold text-sm-ink3">
            none on file
          </span>
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-sm-border-hard px-4 py-5 text-center">
          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sm-border-soft text-sm-ink3">
            <UserRound size={16} />
          </span>
          <div className="mt-2.5 text-[13.5px] font-semibold text-sm-ink">No named acquisitions contact</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-sm-ink3">
            We only list contacts we can verify.
          </p>
        </div>
        <a
          href={mailto([CONTACT_CORRECTIONS_EMAIL], `Contact request: ${brandName}`)}
          className="mt-4 flex w-full items-center justify-center rounded-xl border border-sm-violet py-2.5 text-[13.5px] font-semibold text-sm-violet-deep transition-colors hover:bg-sm-violet-tint-soft"
        >
          Request a contact
        </a>
      </div>
    )
  }

  const visibleOthers = showAll ? others : others.slice(0, COMPACT_OTHERS)
  const expandable = others.length > COMPACT_OTHERS
  const emails = Array.from(
    new Set([primary, ...others].map((c) => c.email).filter((e): e is string => !!e))
  )
  const primaryHref = primary.email
    ? mailto([primary.email], subject)
    : `tel:${primary.phone?.replace(/\s+/g, '')}`

  return (
    <div ref={ref} className="rounded-2xl border border-sm-border bg-sm-surface p-4">
      <div className="flex items-center justify-between">
        <Kicker>Who to contact</Kicker>
        {expandable ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="flex items-center gap-0.5 rounded-full bg-sm-violet-tint px-2 py-0.5 text-[10.5px] font-semibold text-sm-violet-deep hover:bg-sm-violet-tint-soft"
          >
            {total} on file
            <ChevronDown size={11} className={showAll ? 'rotate-180' : ''} />
          </button>
        ) : (
          <span className="rounded-full bg-sm-violet-tint px-2 py-0.5 text-[10.5px] font-semibold text-sm-violet-deep">
            {total} on file
          </span>
        )}
      </div>

      <div className="mt-3 rounded-xl border-[1.5px] border-sm-violet bg-sm-violet-tint-soft p-3.5">
        {coversRegion && (
          <span className="inline-block rounded-md bg-sm-violet-tint px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-sm-violet-deep">
            Covers your region
          </span>
        )}
        <div className={`flex items-start gap-3 ${coversRegion ? 'mt-2.5' : ''}`}>
          <Avatar contact={primary} primary />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-sm-ink">{primary.name ?? 'Property team'}</div>
            {roleLine(primary) && (
              <div className="text-[12px] leading-snug text-sm-ink3">{roleLine(primary)}</div>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {primary.email && (
            <a
              href={mailto([primary.email], subject)}
              className="flex items-center gap-1.5 break-all text-[12.5px] font-medium text-sm-violet-deep hover:underline"
            >
              <Mail size={12} className="flex-shrink-0" />
              {primary.email}
            </a>
          )}
          {primary.phone && (
            <a
              href={`tel:${primary.phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-sm-violet-deep hover:underline"
            >
              <Phone size={12} className="flex-shrink-0" />
              {primary.phone}
            </a>
          )}
        </div>
      </div>

      {visibleOthers.length > 0 && (
        <ul className="mt-2 space-y-2">
          {visibleOthers.map((c) => (
            <SecondaryRow key={c.id} contact={c} subject={subject} />
          ))}
        </ul>
      )}

      <a
        href={primaryHref}
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-sm-violet py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-sm-violet-deep"
      >
        {primary.name ? `Contact ${primary.name}` : `Contact ${brandName}`}
      </a>
      {emails.length > 1 && (
        <a
          href={mailto(emails, subject)}
          className="mt-2.5 block text-center text-[12px] text-sm-ink3 hover:text-sm-violet-deep hover:underline"
        >
          Or email all {numberWord(emails.length)} at once
        </a>
      )}
    </div>
  )
})

function Avatar({ contact, primary = false }: { contact: BrandMatcherContact; primary?: boolean }) {
  if (!contact.name) {
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sm-border-soft text-sm-ink3">
        <Inbox size={14} />
      </span>
    )
  }
  return (
    <span
      className={
        'flex flex-shrink-0 items-center justify-center rounded-full font-semibold ' +
        (primary
          ? 'h-10 w-10 bg-sm-violet-tint text-[14px] text-sm-violet-deep'
          : 'h-8 w-8 bg-sm-border-soft text-[11.5px] text-sm-ink2')
      }
    >
      {initialsFor(contact.name)}
    </span>
  )
}

function SecondaryRow({ contact, subject }: { contact: BrandMatcherContact; subject: string }) {
  const [open, setOpen] = useState(false)
  const label = contact.name ?? 'Property team inbox'
  const sub = contact.name ? roleLine(contact) : (contact.email ?? contact.phone)
  return (
    <li className="rounded-xl border border-sm-border px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar contact={contact} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-sm-ink">{label}</div>
          {sub && <div className="truncate text-[11.5px] text-sm-ink3" title={sub}>{sub}</div>}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex-shrink-0 text-[11.5px] font-semibold text-sm-violet-deep hover:underline"
        >
          {open ? 'Hide' : 'Details'}
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-1 pl-[42px]">
          {contact.email && (
            <a
              href={mailto([contact.email], subject)}
              className="flex items-center gap-1.5 break-all text-[12px] text-sm-violet-deep hover:underline"
            >
              <Mail size={11} className="flex-shrink-0" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-1.5 text-[12px] text-sm-violet-deep hover:underline"
            >
              <Phone size={11} className="flex-shrink-0" />
              {contact.phone}
            </a>
          )}
        </div>
      )}
    </li>
  )
}
