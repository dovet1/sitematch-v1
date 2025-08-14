import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DraftStatusIndicator } from '@/components/agency/DraftStatusIndicator'
import { RejectedStatusIndicator } from '@/components/agency/RejectedStatusIndicator'
import { 
  Users, 
  Mail, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus,
  Building2,
  MapPin,
  Calendar
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Agency Dashboard - SiteMatcher',
  description: 'Manage your real estate agency profile, team members, and settings.',
}

interface AgencyMembership {
  agency_id: string
  role: 'admin' | 'member'
  joined_at: string
  agencies: {
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
}

interface AgentMember {
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

async function getAgencyDashboardData(userId: string) {
  const supabase = createServerClient()

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
    .select('email, name, role, is_registered, joined_at, headshot_url')
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

function getAgencyInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800'
    case 'pending': return 'bg-yellow-100 text-yellow-800'
    case 'draft': return 'bg-gray-100 text-gray-800'
    case 'rejected': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export default async function AgencyDashboardPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin?redirectTo=/agents/dashboard')
  }

  const dashboardData = await getAgencyDashboardData(user.id)

  if (!dashboardData) {
    // User is not part of any agency
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-12 h-12 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              No Agency Yet
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              You're not currently a member of any agency. Create your own agency or accept an invitation to join one.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/agents/add">
                <Button size="lg" className="flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your Agency
                </Button>
              </Link>
              <Link href="/agents">
                <Button variant="outline" size="lg" className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Browse Agencies
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { membership, members, invitations } = dashboardData

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                {membership.agencies.logo_url ? (
                  <Image
                    src={membership.agencies.logo_url}
                    alt={`${membership.agencies.name} logo`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-semibold text-lg">
                    {getAgencyInitials(membership.agencies.name)}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {membership.agencies.name}
                </h1>
                <div className="flex items-center space-x-3 mt-1">
                  <Badge variant="secondary">
                    {membership.role}
                  </Badge>
                </div>
              </div>
            </div>
            
            {membership.role === 'admin' && (
              <div className="flex space-x-3">
                <Link href="/agents/invite">
                  <Button variant="outline" className="flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Invite Members
                  </Button>
                </Link>
                <Link href="/agents/settings/edit">
                  <Button className="flex items-center">
                    <Building2 className="w-4 h-4 mr-2" />
                    Edit Agency Listing
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Status Alert */}
        {membership.agencies.status === 'pending' && (
          <Alert className="mb-6">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Pending Approval:</strong> Your agency is currently being reviewed by our team. 
              You'll receive an email once it's approved.
            </AlertDescription>
          </Alert>
        )}

        {membership.agencies.status === 'rejected' && membership.agencies.admin_notes && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Approval Declined:</strong> {membership.agencies.admin_notes}
              <br />
              <Link href="/agents/settings/edit" className="underline mt-2 inline-block">
                Edit your agency details and resubmit
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Draft Status Indicator */}
        <DraftStatusIndicator 
          agencyId={membership.agency_id}
          isAdmin={membership.role === 'admin'}
        />

        {/* Rejected Status Indicator */}
        <RejectedStatusIndicator 
          agencyId={membership.agency_id}
          isAdmin={membership.role === 'admin'}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Agency Overview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Agency Overview</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-700">Coverage Areas</p>
                    <p className="text-gray-600">{membership.agencies.coverage_areas}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-700">Specialisms</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {membership.agencies.specialisms.map((specialism, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {specialism}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-700">Created</p>
                    <p className="text-gray-600">{formatDate(membership.agencies.created_at)}</p>
                    {membership.agencies.approved_at && (
                      <p className="text-sm text-green-600">
                        Approved {formatDate(membership.agencies.approved_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Team Members ({members.length})
                </h2>
                {membership.role === 'admin' && (
                  <Link href="/agents/invite">
                    <Button size="sm" variant="outline" className="flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Member
                    </Button>
                  </Link>
                )}
              </div>

              <div className="space-y-3">
                {members.map((member, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center">
                        {member.headshot_url ? (
                          <Image
                            src={member.headshot_url}
                            alt={member.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                        {member.role}
                      </Badge>
                      {member.is_registered ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pending Invitations */}
            {membership.role === 'admin' && invitations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Pending Invitations ({invitations.length})
                </h3>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{invitation.name}</p>
                          <p className="text-xs text-gray-500">{invitation.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Expires {formatDate(invitation.expires_at)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {invitation.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link href="/agents" className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Building2 className="w-4 h-4 mr-2" />
                    View Public Profile
                  </Button>
                </Link>
                {membership.role === 'admin' && (
                  <>
                    <Link href="/agents/invite" className="block">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Mail className="w-4 h-4 mr-2" />
                        Send Invitations
                      </Button>
                    </Link>
                    <Link href="/agents/settings/edit" className="block">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Building2 className="w-4 h-4 mr-2" />
                        Edit Agency Listing
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}