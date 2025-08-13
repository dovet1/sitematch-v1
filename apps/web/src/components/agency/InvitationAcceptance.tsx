'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  MapPin, 
  Users, 
  Shield,
  Loader2,
  ExternalLink
} from 'lucide-react'
import Image from 'next/image'

interface InvitationData {
  id: string
  agency_id: string
  email: string
  name: string
  role: 'admin' | 'member'
  status: string
  expires_at: string
  agencies: {
    id: string
    name: string
    logo_url: string | null
    status: string
    coverage_areas: string
  }
}

interface User {
  id: string
  email: string | null
}

interface ExistingMembership {
  agency_id: string
  role: string
  agencies: {
    name: string
    status: string
  }
}

interface InvitationAcceptanceProps {
  invitation: InvitationData
  token: string
  user: User
  emailMismatch?: boolean
  existingMembership?: ExistingMembership | null
}

export function InvitationAcceptance({ 
  invitation, 
  token, 
  user, 
  emailMismatch = false,
  existingMembership = null 
}: InvitationAcceptanceProps) {
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string>('')
  const router = useRouter()
  const { toast } = useToast()

  const getAgencyInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  const formatExpiryDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const acceptInvitation = async () => {
    setIsAccepting(true)
    setError('')

    try {
      const response = await fetch('/api/agencies/accept-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invitation')
      }

      toast({
        title: 'Welcome to the team! 🎉',
        description: result.data.message,
      })

      // Redirect to agency dashboard or success page
      router.push(`/agents/dashboard?joined=true&agency=${encodeURIComponent(invitation.agencies.name)}`)

    } catch (err) {
      console.error('Error accepting invitation:', err)
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setIsAccepting(false)
    }
  }

  // Show email mismatch warning
  if (emailMismatch) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Mismatch</h1>
          <p className="text-gray-600">
            This invitation was sent to <strong>{invitation.email}</strong>, but you're logged in as <strong>{user.email}</strong>.
          </p>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            For security reasons, you can only accept invitations sent to your current email address.
            Please log in with the correct account or ask the agency admin to send a new invitation.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Button 
            onClick={() => router.push('/auth/signout')}
            className="w-full"
            variant="outline"
          >
            Sign Out & Use Different Account
          </Button>
          <Button 
            onClick={() => router.push('/agents')}
            className="w-full"
            variant="ghost"
          >
            Browse Agencies Instead
          </Button>
        </div>
      </div>
    )
  }

  // Show existing membership warning
  if (existingMembership) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Part of an Agency</h1>
          <p className="text-gray-600">
            You're already a member of <strong>{existingMembership.agencies.name}</strong>.
          </p>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You can only be a member of one agency at a time. To join <strong>{invitation.agencies.name}</strong>, 
            you would need to leave your current agency first.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Button 
            onClick={() => router.push('/agents/dashboard')}
            className="w-full"
          >
            Go to My Agency Dashboard
          </Button>
          <Button 
            onClick={() => router.push('/agents')}
            className="w-full"
            variant="outline"
          >
            Browse Other Agencies
          </Button>
        </div>
      </div>
    )
  }

  // Main invitation acceptance UI
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-white/20 backdrop-blur flex items-center justify-center">
            {invitation.agencies.logo_url ? (
              <Image
                src={invitation.agencies.logo_url}
                alt={`${invitation.agencies.name} logo`}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold text-lg">
                {getAgencyInitials(invitation.agencies.name)}
              </span>
            )}
          </div>
          <div className="text-white">
            <h1 className="text-2xl font-bold">{invitation.agencies.name}</h1>
            <p className="text-blue-100">has invited you to join their team</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Welcome Message */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome, {invitation.name}!
          </h2>
          <p className="text-gray-600">
            You've been invited to join {invitation.agencies.name} as a{' '}
            <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'} className="mx-1">
              {invitation.role}
            </Badge>
            member.
          </p>
        </div>

        {/* Agency Details */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="font-medium text-gray-900 mb-4">About the Agency</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2 text-gray-400" />
              <span>{invitation.agencies.coverage_areas}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Badge 
                variant={invitation.agencies.status === 'approved' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {invitation.agencies.status === 'approved' ? 'Verified Agency' : 'Pending Approval'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Role Permissions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Your Role: {invitation.role}</h4>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                {invitation.role === 'admin' ? (
                  <>
                    <li>• Manage agency profile and settings</li>
                    <li>• Invite and manage team members</li>
                    <li>• Handle client inquiries and listings</li>
                    <li>• Full access to agency dashboard</li>
                  </>
                ) : (
                  <>
                    <li>• Access to agency profile and listings</li>
                    <li>• Collaborate with team members</li>
                    <li>• Handle assigned client inquiries</li>
                    <li>• Member access to agency dashboard</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Invitation Details */}
        <div className="border border-gray-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Invited to:</span>
              <p className="text-gray-600">{invitation.email}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Expires:</span>
              <p className="text-gray-600">{formatExpiryDate(invitation.expires_at)}</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={acceptInvitation}
            disabled={isAccepting}
            className="flex-1 min-h-[48px]"
          >
            {isAccepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting Invitation...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Accept Invitation
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => router.push('/agents')}
            disabled={isAccepting}
            className="flex-1 min-h-[48px]"
          >
            Browse Agencies Instead
          </Button>
        </div>

        {/* Footer Note */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <Mail className="w-4 h-4 mr-2" />
            <span>
              Having trouble? Contact the agency admin or{' '}
              <a href="/support" className="text-blue-600 hover:underline">
                get support
                <ExternalLink className="w-3 h-3 ml-1 inline" />
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}