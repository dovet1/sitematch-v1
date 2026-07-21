import { NextResponse } from 'next/server'
import { requirePlusAccess, directoryAdminClient, AGENT_CAP } from '@/lib/directory'
import type {
  DirectoryAgentSummary,
  DirectoryList,
} from '@/app/sitematcher-unified/types/unified-workspace'

export const dynamic = 'force-dynamic'

// Agents tab. brand_agents(count) gives the represented-brand count in the same round trip
// rather than one query per agent.
export async function GET() {
  try {
    const gate = await requirePlusAccess()
    if (gate.error) return gate.error

    const supabase = directoryAdminClient()
    const { data, error } = await supabase
      .from('directory_agents')
      .select(
        'id, name, title, email, phone, linkedin_url, region, focus, directory_agencies(id, name), brand_agents(count)'
      )
      .order('name', { ascending: true })
      .limit(AGENT_CAP + 1)
    if (error) throw error

    const rows = (data || []) as unknown as {
      id: string
      name: string
      title: string | null
      email: string | null
      phone: string | null
      linkedin_url: string | null
      region: string | null
      focus: string | null
      directory_agencies: { id: string; name: string } | null
      brand_agents: { count: number }[] | null
    }[]

    const truncated = rows.length > AGENT_CAP
    const items: DirectoryAgentSummary[] = rows.slice(0, AGENT_CAP).map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      firm: r.directory_agencies?.name ?? null,
      firmId: r.directory_agencies?.id ?? null,
      email: r.email,
      phone: r.phone,
      linkedinUrl: r.linkedin_url,
      region: r.region,
      focus: r.focus,
      brandCount: r.brand_agents?.[0]?.count ?? 0,
    }))

    const payload: DirectoryList<DirectoryAgentSummary> = { items, truncated }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error fetching directory agents:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
