import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AgencyEditFormFixed } from '@/components/agency/AgencyEditFormFixed'

export const metadata = {
  title: 'Edit Agency Listing - SiteMatcher',
  description: 'Edit your real estate agency profile, team members, and service details.',
}

interface AgencyData {
  id: string
  name: string
  description: string | null
  website: string | null
  logo_url: string | null
  coverage_areas: string | null
  specialisms: string[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  approved_at: string | null
}

interface AgencyMembership {
  agency_id: string
  role: 'admin' | 'member'
  joined_at: string
  agencies: AgencyData
}

interface AgentMember {
  user_id?: string
  email: string
  name: string
  phone: string
  role: 'admin' | 'member'
  coverage_area: string
  is_registered: boolean
  joined_at: string | null
  headshot_url: string | null
}

async function getAgencyEditData(userId: string) {
  const supabase = createServerClient()

  // Get user's agency membership with full agency data
  const { data: membership, error: membershipError } = await supabase
    .from('agency_agents')
    .select(`
      agency_id,
      role,
      joined_at,
      agencies!inner(
        id,
        name,
        description,
        website,
        logo_url,
        coverage_areas,
        specialisms,
        status,
        admin_notes,
        created_at,
        approved_at
      )
    `)
    .eq('user_id', userId)
    .single()

  console.log('Debug - membership query:', { membership, membershipError })

  if (membershipError || !membership) {
    return null
  }

  // Get all agency members for team management
  const { data: members } = await supabase
    .from('agency_agents')
    .select('user_id, email, name, phone, role, coverage_area, is_registered, joined_at, headshot_url')
    .eq('agency_id', membership.agency_id)
    .order('joined_at', { ascending: true })

  return {
    membership: membership as unknown as AgencyMembership,
    members: (members || []) as AgentMember[]
  }
}

export default async function AgencyEditPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin?redirectTo=/agents/settings/edit')
  }

  const editData = await getAgencyEditData(user.id)

  if (!editData) {
    console.log('No edit data found for user:', user.id)
    redirect('/agents/dashboard?error=no_agency')
  }

  const { membership, members } = editData

  // Only admin can edit agency
  if (membership.role !== 'admin') {
    redirect('/agents/settings?error=admin_required')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/30 via-white to-blue-50/30">
      {/* Background Pattern - consistent with creation flow */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgb(99, 102, 241) 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }} 
        />
      </div>
      
      {/* Content */}
      <div className="relative">
        <AgencyEditFormFixed 
          agency={membership.agencies}
          members={members}
          currentUserId={user.id}
        />
      </div>
    </div>
  )
}