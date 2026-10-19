'use client'

import { Inbox } from 'lucide-react'
import { initialsFor } from '../directory/UDirectoryPrimitives'
import { CONTACT_CORRECTIONS_EMAIL } from '../../../lib/brand-matcher'
import type { BrandMatcherContact, BrandMatcherContacts } from '../../../types/brand-matcher'
import { EmptyPanel, Footnote, numberWord, PANEL_LINK, plural } from './BrandMatcherUi'

// Every contact for the brand, best match for the site's region first (handoff #2bcontacts).

export function roleLine(c: BrandMatcherContact): string | null {
  if (c.title && c.area) return `${c.title} · ${c.area}`
  return c.title ?? c.area
}

export function mailto(emails: string[], subject: string): string {
  return `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}`
}

export function contactHref(c: BrandMatcherContact, subject: string): string {
  return c.email ? mailto([c.email], subject) : `tel:${c.phone?.replace(/\s+/g, '') ?? ''}`
}

export function requestContactHref(brandName: string): string {
  return mailto([CONTACT_CORRECTIONS_EMAIL], `Contact request: ${brandName}`)
}

export function ContactAvatar({ contact, primary = false }: { contact: BrandMatcherContact | null; primary?: boolean }) {
  const base = 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold'
  if (!contact) return <span className={`${base} bg-[#F4F3F9] text-[#B7B5C2]`}>–</span>
  if (!contact.name) {
    return (
      <span className={`${base} bg-[#F1F0F6] text-[#6B6B78]`}>
        <Inbox size={15} />
      </span>
    )
  }
  return (
    <span className={`${base} ${primary ? 'bg-[#EDE7FF] text-[#6C47FF]' : 'bg-[#F1F0F6] text-[#6B6B78]'}`}>
      {initialsFor(contact.name)}
    </span>
  )
}

export function BrandContactsPanel({
  brandName,
  contacts,
  registeredOffice,
  subject,
}: {
  brandName: string
  contacts: BrandMatcherContacts
  // From Companies House, for the no-contact state.
  registeredOffice: string | null
  subject: string
}) {
  const { primary, others, total, coversRegion } = contacts

  if (!primary) {
    return (
      <EmptyPanel
        kicker="Contacts · none verified"
        title="No verified contacts"
        action={
          <a href={requestContactHref(brandName)} className={`mt-0.5 ${PANEL_LINK}`}>
            Request a contact
          </a>
        }
      >
        We only list contacts we can verify.
        {registeredOffice && ` For this brand we hold the registered office only: ${registeredOffice}.`}
      </EmptyPanel>
    )
  }

  const all = [primary, ...others]
  const emails = Array.from(new Set(all.map((c) => c.email).filter((e): e is string => !!e)))

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[18px] font-bold text-[#1C1B22]">
          {total} {plural(total, 'contact')}
        </h4>
        {emails.length > 1 && (
          <a href={mailto(emails, subject)} className={PANEL_LINK}>
            Email all {numberWord(emails.length)}
          </a>
        )}
      </div>
      <ul className="flex flex-col">
        {all.map((c, i) => {
          const isPrimary = c === primary
          const role = c.name ? roleLine(c) : (roleLine(c) ?? 'General enquiries')
          return (
            <li
              key={c.id}
              className={
                'grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-[#F2F0F7] py-3.5 ' +
                (i === all.length - 1 ? 'border-b' : '')
              }
            >
              <ContactAvatar contact={c} primary={isPrimary} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-bold text-[#1C1B22]">{c.name ?? 'Property team inbox'}</span>
                  {isPrimary && coversRegion && (
                    <span className="rounded-full bg-[#EDE7FF] px-2 py-[3px] text-[11px] font-bold text-[#4B23C9]">
                      Covers your region
                    </span>
                  )}
                </div>
                {role && <div className="mt-[3px] text-[13px] text-[#8A8895]">{role}</div>}
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
                  {c.email && (
                    <a href={mailto([c.email], subject)} className="break-all text-[#6C47FF] hover:text-[#4B23C9]">
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="text-[#6C47FF] hover:text-[#4B23C9]">
                      {c.phone}
                    </a>
                  )}
                </div>
              </div>
              <a
                href={contactHref(c, subject)}
                className={
                  'rounded-[10px] px-3.5 py-[9px] text-[13px] font-bold transition-colors ' +
                  (isPrimary
                    ? 'bg-[#6C47FF] text-white hover:bg-[#4B23C9]'
                    : 'bg-[#F1EEFA] text-[#4B23C9] hover:bg-[#E6E0FA]')
                }
              >
                Contact
              </a>
            </li>
          )
        })}
      </ul>
      <Footnote>Ordered by relevance to your site&apos;s region. Only contacts we can verify are listed.</Footnote>
    </div>
  )
}
