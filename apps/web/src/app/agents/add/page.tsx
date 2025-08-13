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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Add Your Agency
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Create your agency profile, showcase your expertise, and invite your team members to join SiteMatcher's Agent Directory.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <CreateAgencyWizard />
        </div>
      </div>
    </div>
  )
}