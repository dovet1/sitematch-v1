import { createClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { CreateAgencyWizard } from '@/components/agency/CreateAgencyWizard'

export const metadata = {
  title: 'Add Your Agency - SiteMatcher',
  description: 'Create your real estate agency profile and invite your team members to join SiteMatcher\'s Agent Directory.',
}

export default async function AddAgencyPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin?redirectTo=/agents/add')
  }

  // Check if user is already part of an agency
  const supabase = createClient()
  const { data: existingMembership } = await supabase
    .from('agency_agents')
    .select(`
      agency_id,
      role,
      agencies!inner(name, status)
    `)
    .eq('user_id', user.id)
    .single()

  if (existingMembership) {
    redirect(`/agents/dashboard?already_member=true`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/30 via-white to-blue-50/30">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgb(99, 102, 241) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }} />
      </div>
      
      {/* Content */}
      <div className="relative">
        <CreateAgencyWizard />
      </div>
    </div>
  )
}