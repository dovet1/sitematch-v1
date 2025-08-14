'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AgencySettingsForm } from './AgencySettingsForm'
import { MemberManagement } from './MemberManagement'
import { InvitationManagement } from './InvitationManagement'
import { DraftStatusIndicator } from './DraftStatusIndicator'
import { VersionHistory } from './VersionHistory'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Users, Settings, ArrowLeft, Plus, History } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

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

interface AgencySettingsClientProps {
  membership: AgencyMembership
  initialMembers: AgentMember[]
  initialInvitations: PendingInvitation[]
  currentUserId: string
}

export function AgencySettingsClient({ 
  membership, 
  initialMembers, 
  initialInvitations, 
  currentUserId 
}: AgencySettingsClientProps) {
  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const router = useRouter()

  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // Refresh the page to get updated data
      router.refresh()
    } finally {
      setIsRefreshing(false)
    }
  }, [router])

  function getAgencyInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
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

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/agents/dashboard">
              <Button variant="outline" size="sm" className="flex items-center">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
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
                Agency Settings
              </h1>
              <div className="flex items-center space-x-3 mt-1">
                <span className="text-lg text-gray-600">{membership.agencies.name}</span>
                <Badge className={getStatusColor(membership.agencies.status)}>
                  {membership.agencies.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Status Alert */}
        {membership.agencies.status === 'rejected' && membership.agencies.admin_notes && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              <strong>Approval Declined:</strong> {membership.agencies.admin_notes}
              <br />
              Please update your agency details below and resubmit for approval.
            </AlertDescription>
          </Alert>
        )}

        {/* Draft Status Indicator */}
        <DraftStatusIndicator 
          agencyId={membership.agency_id}
          isAdmin={membership.role === 'admin'}
          onDraftChange={setHasDraft}
        />

        <Tabs defaultValue="agency-info" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agency-info" className="flex items-center">
              <Building2 className="w-4 h-4 mr-2" />
              Agency Info
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Team Management
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center">
              <History className="w-4 h-4 mr-2" />
              Version History
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              General Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agency-info">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Agency Profile</h2>
                <p className="text-gray-600 mt-1">
                  Update your agency information, branding, and service areas.
                </p>
              </div>
              <AgencySettingsForm agency={membership.agencies} />
            </div>
          </TabsContent>

          <TabsContent value="team">
            <div className="space-y-6">
              {/* Team Members */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Team Members ({members.length})</h2>
                    <p className="text-gray-600 mt-1">Manage your agency team members and their roles.</p>
                  </div>
                  <Link href="/agents/invite">
                    <Button className="flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Invite Members
                    </Button>
                  </Link>
                </div>

                <MemberManagement
                  agencyId={membership.agency_id}
                  members={members}
                  currentUserId={currentUserId}
                  onMemberUpdated={refreshData}
                />
              </div>

              {/* Pending Invitations */}
              {invitations.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Pending Invitations ({invitations.length})
                    </h3>
                    <p className="text-gray-600 mt-1">Manage outstanding invitations to join your agency.</p>
                  </div>
                  
                  <InvitationManagement
                    agencyId={membership.agency_id}
                    invitations={invitations}
                    onInvitationsUpdated={refreshData}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Version History</h2>
                <p className="text-gray-600 mt-1">
                  Track changes to your agency profile and see approval status.
                </p>
              </div>
              <VersionHistory 
                agencyId={membership.agency_id}
                isAdmin={membership.role === 'admin'}
              />
            </div>
          </TabsContent>

          <TabsContent value="general">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">General Settings</h2>
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Account Status</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600">Your agency status</p>
                      <Badge className={getStatusColor(membership.agencies.status)}>
                        {membership.agencies.status}
                      </Badge>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>Created: {formatDate(membership.agencies.created_at)}</p>
                      {membership.agencies.approved_at && (
                        <p>Approved: {formatDate(membership.agencies.approved_at)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Danger Zone</h3>
                  <p className="text-gray-600 mb-4">
                    These actions cannot be undone. Please proceed with caution.
                  </p>
                  <Button variant="destructive" disabled>
                    Delete Agency
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}