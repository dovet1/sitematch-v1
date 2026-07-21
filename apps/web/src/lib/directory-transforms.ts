// Pure transforms for the Company Directory payloads.
//
// Deliberately free of any `next/server` import so they can be unit-tested without a
// Next.js request environment (importing NextResponse at module load needs a global
// Request, which jsdom/node test envs do not provide).

import { normalizeRequirementCoordinates } from '@/lib/requirement-map-data'
import type {
  DirectoryContact,
  DirectoryTarget,
} from '@/app/sitematcher-unified/types/unified-workspace'

// "PARENT · CHILD", or just the child when there is no parent. Mirrors how
// brand_primary_category's two columns are rendered elsewhere.
export function formatCategory(child: string | null, parent: string | null): string | null {
  if (!child) return null
  return parent ? `${parent} · ${child}` : child
}

interface ContactRow {
  id: string
  contact_name: string | null
  contact_title: string | null
  contact_org: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_kind: string | null
  linkedin_url: string | null
}

// In-house contacts only. Agency-kind rows are excluded here: the directory reads its
// agents from brand_agents, so including them would double-render a promoted contact.
export function toInHouseContacts(rows: ContactRow[] | null): DirectoryContact[] {
  return (rows || [])
    .filter((r) => r.contact_kind === null || r.contact_kind === 'in-house')
    .map((r) => ({
      id: r.id,
      name: r.contact_name,
      title: r.contact_title,
      org: r.contact_org,
      email: r.contact_email,
      phone: r.contact_phone,
      linkedinUrl: r.linkedin_url,
      kind: 'in-house' as const,
    }))
}

interface AgentJoinRow {
  role_note: string | null
  display_order: number
  directory_agents: {
    id: string
    name: string
    title: string | null
    email: string | null
    phone: string | null
    linkedin_url: string | null
    directory_agencies: { id: string; name: string } | null
  } | null
}

export function toAgentContacts(rows: AgentJoinRow[] | null, brandName: string): DirectoryContact[] {
  return (rows || [])
    .filter((r) => r.directory_agents !== null)
    .sort((a, b) => a.display_order - b.display_order)
    .map((r) => {
      const a = r.directory_agents!
      return {
        id: a.id,
        agentId: a.id,
        name: a.name,
        // The role line reads "<title> · acting for <brand>" unless an explicit
        // per-brand role_note overrides it.
        title: r.role_note || (a.title ? `${a.title} · acting for ${brandName}` : null),
        org: a.directory_agencies?.name ?? null,
        email: a.email,
        phone: a.phone,
        linkedinUrl: a.linkedin_url,
        kind: 'agent' as const,
      }
    })
}

interface LocationRow {
  id: string
  place_name: string | null
  formatted_address: string | null
  coordinates: unknown
}

// requirement_locations.coordinates is untyped jsonb holding either [lng, lat] or
// {lat, lng} (sometimes JSON-encoded as a string). Handing it raw to the map plots
// targets in the sea, so normalise here and drop anything that fails validation.
// The count pill counts what this returns, so it never overstates the plotted total.
export function toTargets(rows: LocationRow[] | null): DirectoryTarget[] {
  const out: DirectoryTarget[] = []
  for (const r of rows || []) {
    const c = normalizeRequirementCoordinates(r.coordinates)
    if (!c) continue
    out.push({
      id: r.id,
      name: r.place_name || r.formatted_address,
      lat: c.lat,
      lon: c.lng,
    })
  }
  return out
}

export function toTargetNames(rows: LocationRow[] | null): string[] {
  return (rows || [])
    .map((r) => r.place_name || r.formatted_address)
    .filter((n): n is string => Boolean(n))
}
