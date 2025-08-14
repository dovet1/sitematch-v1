import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { AgencyDetail } from '@/components/agency/AgencyDetail'
import type { Metadata } from 'next'

interface AgencyPageProps {
  params: { id: string }
}

interface AgencyData {
  id: string
  name: string
  description: string | null
  website: string | null
  logo_url: string | null
  coverage_areas: string
  specialisms: string[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  created_at: string
  approved_at: string | null
}

interface AgentMember {
  user_id: string | null
  email: string
  name: string
  phone: string | null
  coverage_area: string | null
  headshot_url: string | null
  role: 'admin' | 'member'
  is_registered: boolean
  joined_at: string | null
}

interface AgencyWithMembers {
  agency: AgencyData
  members: AgentMember[]
  isUserMember: boolean
  userRole?: 'admin' | 'member'
}

async function getAgencyData(id: string): Promise<AgencyWithMembers | null> {
  const supabase = createServerClient()
  const user = await getCurrentUser()

  // Get the latest approved version of the agency
  const { data: approvedVersion, error: versionError } = await supabase
    .from('agency_versions')
    .select(`
      id,
      data,
      reviewed_at,
      agencies!inner(
        id,
        status,
        created_at
      )
    `)
    .eq('agency_id', id)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .single()

  if (versionError || !approvedVersion) {
    return null
  }

  // Parse the JSON data if it's stored as a string
  const data = typeof approvedVersion.data === 'string' ? JSON.parse(approvedVersion.data) : approvedVersion.data

  // Transform version data to agency format
  const agency: AgencyData = {
    id: id,
    name: data.name,
    description: data.description,
    website: data.website,
    logo_url: data.logo_url,
    coverage_areas: data.coverage_areas,
    specialisms: data.specialisms,
    status: 'approved',
    created_at: approvedVersion.agencies.created_at,
    approved_at: approvedVersion.reviewed_at
  }

  // Get agency members
  const { data: members, error: membersError } = await supabase
    .from('agency_agents')
    .select('user_id, email, name, phone, coverage_area, headshot_url, role, is_registered, joined_at')
    .eq('agency_id', id)
    .order('role', { ascending: true }) // admins first
    .order('joined_at', { ascending: true })

  if (membersError) {
    console.error('Error fetching members:', membersError)
  }

  // Check if current user is a member
  let isUserMember = false
  let userRole: 'admin' | 'member' | undefined

  if (user) {
    const userMembership = (members || []).find(
      member => member.user_id === user.id
    )
    if (userMembership) {
      isUserMember = true
      userRole = userMembership.role
    }
  }

  return {
    agency: agency as AgencyData,
    members: (members || []) as AgentMember[],
    isUserMember,
    userRole
  }
}

export async function generateMetadata({ params }: AgencyPageProps): Promise<Metadata> {
  const data = await getAgencyData(params.id)
  
  if (!data) {
    return {
      title: 'Agency Not Found - SiteMatcher',
      description: 'The requested agency could not be found.'
    }
  }

  const { agency } = data
  
  return {
    title: `${agency.name} - Real Estate Agency | SiteMatcher`,
    description: agency.description || `${agency.name} specializes in ${agency.specialisms.join(', ')} across ${agency.coverage_areas}. Contact us for professional real estate services.`,
    openGraph: {
      title: agency.name,
      description: agency.description || `Professional real estate services in ${agency.coverage_areas}`,
      images: agency.logo_url ? [agency.logo_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: agency.name,
      description: agency.description || `Professional real estate services in ${agency.coverage_areas}`,
      images: agency.logo_url ? [agency.logo_url] : [],
    }
  }
}

export default async function AgencyPage({ params }: AgencyPageProps) {
  const data = await getAgencyData(params.id)

  if (!data) {
    notFound()
  }

  const { agency, members, isUserMember, userRole } = data

  return (
    <AgencyDetail
      agency={agency}
      members={members}
      isUserMember={isUserMember}
      userRole={userRole}
    />
  )
}