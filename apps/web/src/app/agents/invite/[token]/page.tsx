import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { InvitationAcceptance } from '@/components/agency/InvitationAcceptance'

interface InvitePageProps {
  params: {
    token: string
  }
}

export const metadata = {
  title: 'Join Agency - SiteMatcher',
  description: 'Accept your invitation to join a real estate agency on SiteMatcher.',
}

export default async function InviteAcceptancePage({ params }: InvitePageProps) {
  const { token } = params
  
  if (!token) {
    notFound()
  }

  const supabase = createClient()
  
  // Get invitation details
  const { data: invitation, error } = await supabase
    .from('agency_invitations')
    .select(`
      id,
      agency_id,
      email,
      name,
      role,
      status,
      expires_at,
      agencies!inner(
        id,
        name,
        logo_url,
        status,
        coverage_areas
      )
    `)
    .eq('token', token)
    .single()

  if (error || !invitation) {
    notFound()
  }

  // Check if invitation has expired
  const now = new Date()
  const expiresAt = new Date(invitation.expires_at)
  
  if (now > expiresAt && invitation.status === 'pending') {
    // Mark as expired
    await supabase
      .from('agency_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id)
    
    return <InvitationExpired invitation={invitation} />
  }

  if (invitation.status !== 'pending') {
    return <InvitationNotPending invitation={invitation} />
  }

  const user = await getCurrentUser()

  // If user is not logged in, redirect to auth with return URL
  if (!user) {
    redirect(`/auth/signin?redirectTo=${encodeURIComponent(`/agents/invite/${token}`)}`)
  }

  // Check if user email matches invitation email
  const emailMismatch = user.email && 
    invitation.email.toLowerCase() !== user.email.toLowerCase()

  // Check if user is already part of an agency
  const { data: existingMembership } = await supabase
    .from('agency_agents')
    .select(`
      agency_id,
      role,
      agencies!inner(
        name,
        status
      )
    `)
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <InvitationAcceptance 
          invitation={invitation as any}
          token={token}
          user={user}
          emailMismatch={!!emailMismatch}
          existingMembership={existingMembership as any}
        />
      </div>
    </div>
  )
}

function InvitationExpired({ invitation }: { invitation: any }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center py-8">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Invitation Expired
          </h1>
          
          <p className="text-gray-600 mb-6">
            Your invitation to join <strong>{invitation.agencies.name}</strong> has expired.
            Please contact the agency admin for a new invitation.
          </p>
          
          <div className="space-y-3">
            <a 
              href="/agents"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors inline-block"
            >
              Browse Agencies
            </a>
            <a 
              href="/"
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors inline-block"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function InvitationNotPending({ invitation }: { invitation: any }) {
  const statusMessages = {
    accepted: 'You have already accepted this invitation.',
    expired: 'This invitation has expired.',
    cancelled: 'This invitation has been cancelled.'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center py-8">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
            invitation.status === 'accepted' 
              ? 'bg-green-100' 
              : 'bg-gray-100'
          }`}>
            <svg className={`w-8 h-8 ${
              invitation.status === 'accepted' 
                ? 'text-green-600' 
                : 'text-gray-600'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {invitation.status === 'accepted' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {invitation.status === 'accepted' ? 'Already Accepted' : 'Invitation Unavailable'}
          </h1>
          
          <p className="text-gray-600 mb-6">
            {statusMessages[invitation.status as keyof typeof statusMessages]}
          </p>
          
          <div className="space-y-3">
            {invitation.status === 'accepted' ? (
              <a 
                href="/agents/dashboard"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Go to Dashboard
              </a>
            ) : (
              <a 
                href="/agents"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Browse Agencies
              </a>
            )}
            <a 
              href="/"
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors inline-block"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}