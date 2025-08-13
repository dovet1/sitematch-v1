import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SendInvitationsForm } from '@/components/agency/SendInvitationsForm'

export const metadata = {
  title: 'Invite Team Members - SiteMatcher',
  description: 'Send invitations to team members to join your real estate agency on SiteMatcher.',
}

interface AgencyMembership {
  agency_id: string
  role: 'admin' | 'member'
  agencies: {
    id: string
    name: string
    status: 'draft' | 'pending' | 'approved' | 'rejected'
  }
}

export default async function InviteTeamPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin?redirectTo=/agents/invite')
  }

  const supabase = createClient()
  
  // Get user's agency membership and verify admin role
  const { data: membership, error } = await supabase
    .from('agency_agents')
    .select(`
      agency_id,
      role,
      agencies!inner(
        id,
        name,
        status
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (error || !membership) {
    redirect('/agents/dashboard')
  }

  const typedMembership = membership as unknown as AgencyMembership

  if (typedMembership.role !== 'admin') {
    redirect('/agents/dashboard?error=admin_required')
  }

  // Get existing pending invitations
  const { data: pendingInvitations } = await supabase
    .from('agency_invitations')
    .select(`
      id,
      email,
      name,
      role,
      status,
      expires_at,
      invited_at
    `)
    .eq('agency_id', typedMembership.agency_id)
    .eq('status', 'pending')
    .order('invited_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Invite Team Members
              </h1>
              <p className="text-gray-600 mt-2">
                Send invitations to team members to join {typedMembership.agencies.name}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Agency: <span className="font-medium">{typedMembership.agencies.name}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Send Invitations</h2>
              <SendInvitationsForm 
                agencyId={typedMembership.agency_id}
                agencyName={typedMembership.agencies.name}
              />
            </div>
          </div>

          {/* Pending Invitations Sidebar */}
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Pending Invitations ({pendingInvitations?.length || 0})
              </h3>
              
              {pendingInvitations && pendingInvitations.length > 0 ? (
                <div className="space-y-3">
                  {pendingInvitations.map((invitation) => (
                    <div key={invitation.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{invitation.name}</p>
                          <p className="text-xs text-gray-500 truncate">{invitation.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Role: {invitation.role}
                          </p>
                          <p className="text-xs text-gray-500">
                            Expires {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No pending invitations</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}