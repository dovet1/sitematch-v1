import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AgencySettingsClient } from '@/components/agency/AgencySettingsClient'

export const metadata = {
  title: 'Agency Settings - SiteMatcher',
  description: 'Manage your real estate agency profile, team members, and settings on SiteMatcher.',
}

interface AgencyData {
  id: string
  name: string
  logo_url: string | null
  coverage_areas: string
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
  id?: string
  user_id?: string
  email: string
  name: string
  role: 'admin' | 'member'
  is_registered: boolean
  joined_at: string | null
  headshot_url: string | null
}

interface PendingInvitation {
  id: string
  email: string
  name: string
  role: 'admin' | 'member'
  status: string
  expires_at: string
  invited_at: string
}

async function getAgencySettingsData(userId: string) {
  const supabase = createClient()

  // Get user's agency membership
  const { data: membership, error: membershipError } = await supabase
    .from('agency_agents')
    .select(`
      agency_id,
      role,
      joined_at,
      agencies!inner(
        id,
        name,
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

  if (membershipError || !membership) {
    return null
  }

  // Get all agency members
  const { data: members } = await supabase
    .from('agency_agents')
    .select('user_id, email, name, role, is_registered, joined_at, headshot_url')
    .eq('agency_id', membership.agency_id)
    .order('joined_at', { ascending: true })

  // Get pending invitations (only if user is admin)
  let invitations: PendingInvitation[] = []
  if (membership.role === 'admin') {
    const { data: pendingInvitations } = await supabase
      .from('agency_invitations')
      .select('id, email, name, role, status, expires_at, invited_at')
      .eq('agency_id', membership.agency_id)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })

    invitations = (pendingInvitations || []) as PendingInvitation[]
  }

  return {
    membership: membership as unknown as AgencyMembership,
    members: (members || []) as AgentMember[],
    invitations
  }
}

export default async function AgencySettingsPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin?redirectTo=/agents/settings')
  }

  const settingsData = await getAgencySettingsData(user.id)

  if (!settingsData) {
    redirect('/agents/dashboard')
  }

  const { membership, members, invitations } = settingsData

  if (membership.role !== 'admin') {
    redirect('/agents/dashboard?error=admin_required')
  }

  return (
    <AgencySettingsClient
      membership={membership}
      initialMembers={members}
      initialInvitations={invitations}
      currentUserId={user.id}
    />
  )
}