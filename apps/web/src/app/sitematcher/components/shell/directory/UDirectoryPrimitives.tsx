'use client'

import { Mail, Phone, Linkedin, ChevronRight } from 'lucide-react'
import { getClearbitLogoUrl } from '@/lib/clearbit-logo'
import type { DirectoryContact } from '../../../types/unified-workspace'

// Deterministic avatar hue. There is no brand_color column and the design's coloured
// initial squares need one, so derive it from the id — stable across sessions and users,
// and never two different colours for the same brand.
const AVATAR_HUES = [
  '#C4161C', '#3B2A1A', '#C8102E', '#7A1F2E', '#E30613',
  '#C24A6B', '#1A1A1A', '#E4002B', '#1F1A14', '#111827',
  '#1F3A5F', '#0B6E4F', '#8A1538', '#C2410C', '#4B2E83', '#0F766E',
]

export function hueForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_HUES[h % AVATAR_HUES.length]
}

export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Brand avatar: real logo when we have one, else the logo.dev URL from `domain`, else
// initials on the derived hue.
export function UBrandAvatar({
  id,
  name,
  logoUrl,
  domain,
  size = 40,
  radius = 12,
}: {
  id: string
  name: string
  logoUrl?: string | null
  domain?: string | null
  size?: number
  radius?: number
}) {
  // Uploaded logo wins; otherwise fall back to logo.dev via the shared helper (which owns
  // domain validation and the NEXT_PUBLIC_LOGO_DEV_TOKEN lookup) and finally to initials.
  const src = logoUrl || (domain ? getClearbitLogoUrl(domain, 128) : null)

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius }}
        className="flex-shrink-0 border border-sm-border-soft bg-white object-contain"
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: hueForId(id),
        fontSize: size * 0.36,
      }}
      className="inline-flex flex-shrink-0 items-center justify-center font-semibold text-white"
    >
      {initialsFor(name)}
    </span>
  )
}

// Round person avatar (contacts, agents).
export function UPersonAvatar({
  id,
  name,
  size = 34,
}: {
  id: string
  name: string
  size?: number
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, background: hueForId(id), fontSize: size * 0.36 }}
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
    >
      {initialsFor(name)}
    </span>
  )
}

// Mono uppercase kicker used above panels and as micro-labels.
export function UKicker({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={
        'font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-sm-ink3 ' + className
      }
    >
      {children}
    </span>
  )
}

// Panel header: violet kicker + hairline rule + optional right-hand slot.
export function UPanelHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-3.5">
      <UKicker className="!text-sm-violet-deep">{title}</UKicker>
      <span className="h-px flex-1 bg-sm-border-soft" />
      {right}
    </div>
  )
}

export function UPanel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={
        'rounded-[15px] border border-sm-border bg-sm-surface shadow-[0_1px_2px_rgba(23,20,25,.03)] ' +
        className
      }
    >
      {children}
    </section>
  )
}

// Contact tile. Agent tiles are visually distinct (violet tag) and their name + last row
// navigate to the agent profile — the Brand -> Agent leg of the directory graph.
export function UOcContact({
  contact,
  onOpenAgent,
}: {
  contact: DirectoryContact
  onOpenAgent?: (agentId: string) => void
}) {
  const isAgent = contact.kind === 'agent'
  const name = contact.name || 'Unnamed contact'
  const clickable = isAgent && contact.agentId && onOpenAgent

  return (
    <div className="rounded-[11px] border border-sm-border-soft bg-sm-bg p-3.5">
      <div className="flex items-center gap-2">
        {clickable ? (
          <button
            type="button"
            onClick={() => onOpenAgent!(contact.agentId!)}
            className="text-left text-[13px] font-semibold text-sm-ink transition-colors hover:text-sm-violet"
          >
            {name}
          </button>
        ) : (
          <span className="text-[13px] font-semibold text-sm-ink">{name}</span>
        )}
        <span
          className={
            'rounded px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.08em] ' +
            (isAgent
              ? 'bg-sm-violet-tint text-sm-violet-deep'
              : 'bg-sm-border-soft text-sm-ink3')
          }
        >
          {isAgent ? `Agent${contact.org ? ` · ${contact.org}` : ''}` : 'In-house'}
        </span>
      </div>

      {contact.title && (
        <p className="mt-1 text-[12px] leading-snug text-sm-ink2">{contact.title}</p>
      )}

      <div className="mt-2.5 flex flex-col gap-1.5">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex w-fit items-center gap-2 font-mono text-[11px] text-sm-ink2 transition-colors hover:text-sm-violet"
          >
            <Mail size={13} className="flex-shrink-0 text-sm-ink4" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="inline-flex w-fit items-center gap-2 font-mono text-[11px] text-sm-ink2 transition-colors hover:text-sm-violet"
          >
            <Phone size={13} className="flex-shrink-0 text-sm-ink4" />
            {contact.phone}
          </a>
        )}
        {contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 text-[12px] text-sm-ink2 transition-colors hover:text-sm-violet"
          >
            <Linkedin size={13} className="flex-shrink-0 text-sm-ink4" />
            LinkedIn profile
          </a>
        )}
        {clickable && (
          <button
            type="button"
            onClick={() => onOpenAgent!(contact.agentId!)}
            className="inline-flex w-fit items-center gap-1.5 text-[12px] text-sm-ink2 transition-colors hover:text-sm-violet"
          >
            <ChevronRight size={13} className="flex-shrink-0 text-sm-ink4" />
            View agent profile
          </button>
        )}
      </div>
    </div>
  )
}
