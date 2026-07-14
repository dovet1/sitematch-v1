// Helper B: transform a `requirements` row + its child rows into the RequirementDetail
// response shape the /sitematcher-unified modal renders. Reads the normalized requirement
// tables only — no listing_versions content. Used by
// /api/public/requirements/[id]/detailed.

import type {
  RequirementContact,
  RequirementDetail,
} from '@/app/sitematcher-unified/types/unified-workspace'

interface JoinedSector {
  sector: { name: string | null } | null
}
interface JoinedUseClass {
  use_class: { name: string | null; code: string | null } | null
}
interface JoinedContact {
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_org: string | null
  contact_kind: string | null
  is_primary_contact: boolean | null
}
interface JoinedLocation {
  place_name: string | null
  formatted_address: string | null
}

export interface RequirementDetailRow {
  id: string
  listing_type: string | null
  description: string | null
  verified_at: string | null
  company_name: string | null
  company_domain: string | null
  clearbit_logo: boolean | null
  brochure_url: string | null
  site_size_min: number | null
  site_size_max: number | null
  requirement_locations?: JoinedLocation[] | null
  requirement_contacts?: JoinedContact[] | null
  requirement_sectors?: JoinedSector[] | null
  requirement_use_classes?: JoinedUseClass[] | null
}

function logoDevUrl(domain: string | null, clearbitLogo: boolean | null): string | null {
  if (!clearbitLogo || !domain) return null
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN
  return token ? `https://img.logo.dev/${domain}?token=${token}` : null
}

function formatSiteSize(min: number | null, max: number | null): string {
  if (min != null && max != null) {
    return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`
  }
  return ''
}

export function requirementRowToDetail(row: RequirementDetailRow): RequirementDetail {
  const sectors = (row.requirement_sectors ?? [])
    .map((s) => s.sector?.name)
    .filter((n): n is string => Boolean(n))

  const useClasses = (row.requirement_use_classes ?? [])
    .map((uc) =>
      uc.use_class
        ? uc.use_class.code
          ? `${uc.use_class.code} - ${uc.use_class.name ?? ''}`.trim()
          : uc.use_class.name ?? ''
        : ''
    )
    .filter((s): s is string => Boolean(s))

  const rawContacts = row.requirement_contacts ?? []
  // Primary first, then the rest in their stored order — this ordering drives both the
  // single-card and multi-card list in the modal.
  const orderedContacts = [...rawContacts].sort(
    (a, b) => Number(Boolean(b.is_primary_contact)) - Number(Boolean(a.is_primary_contact))
  )
  const allContacts: RequirementContact[] = orderedContacts.map((c) => ({
    name: c.contact_name,
    title: c.contact_title,
    org: c.contact_org,
    email: c.contact_email,
    phone: c.contact_phone,
    kind:
      c.contact_kind === 'in-house' || c.contact_kind === 'agency'
        ? c.contact_kind
        : null,
  }))
  const primaryRaw = orderedContacts[0] ?? null
  const primary = primaryRaw
    ? {
        name: primaryRaw.contact_name,
        title: primaryRaw.contact_title,
        email: primaryRaw.contact_email,
        phone: primaryRaw.contact_phone,
      }
    : null

  const locations = (row.requirement_locations ?? []).map((l) => ({
    place_name: l.place_name,
    formatted_address: l.formatted_address,
  }))

  return {
    id: row.id,
    listing_type: row.listing_type,
    description: row.description,
    verified_at: row.verified_at,
    company: {
      name: row.company_name || 'Unnamed Company',
      logo_url: logoDevUrl(row.company_domain, row.clearbit_logo),
      sector: sectors[0] || '',
      use_class: useClasses[0] || '',
      sectors,
      use_classes: useClasses,
      site_size: formatSiteSize(row.site_size_min, row.site_size_max),
      brochure_url: row.brochure_url,
    },
    contacts: { primary, all: allContacts },
    locations: {
      all: locations,
      is_nationwide: locations.length === 0,
    },
  }
}
