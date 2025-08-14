import { requireAdmin } from '@/lib/auth'
import { createServerClient, createAdminClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { AgencyReviewActions } from '@/components/admin/AgencyReviewActions'

interface AgencyReviewPageProps {
  params: { id: string }
}

interface AgencyData {
  id: string
  name: string
  logo_url: string | null
  coverage_areas: string | null
  specialisms: string[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  approved_at: string | null
  created_by: string
  creator_email: string
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

interface AgencyVersion {
  id: string
  version_number: number
  data: any
  status: 'pending' | 'approved' | 'rejected' | 'draft'
  admin_notes: string | null
  created_at: string
  created_by: string
  reviewed_at: string | null
  reviewed_by: string | null
}

interface AgencyReviewData {
  agency: AgencyData
  members: AgentMember[]
  versions: AgencyVersion[]
  currentVersion: AgencyVersion | null
}

async function getAgencyReviewData(id: string): Promise<AgencyReviewData | null> {
  const supabase = createAdminClient()

  // Get agency data
  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select(`
      id,
      name,
      logo_url,
      coverage_areas,
      specialisms,
      status,
      admin_notes,
      created_at,
      approved_at,
      created_by,
      users!agencies_created_by_fkey(email)
    `)
    .eq('id', id)
    .single()

  if (agencyError || !agency) {
    return null
  }

  // Get agency members
  const { data: members } = await supabase
    .from('agency_agents')
    .select('user_id, email, name, phone, coverage_area, headshot_url, role, is_registered, joined_at')
    .eq('agency_id', id)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true })

  // Get version history
  const { data: versions } = await supabase
    .from('agency_versions')
    .select(`
      id,
      version_number,
      data,
      status,
      admin_notes,
      created_at,
      created_by,
      reviewed_at,
      reviewed_by
    `)
    .eq('agency_id', id)
    .order('version_number', { ascending: false })

  // Get current pending version if exists
  const currentVersion = versions?.find(v => v.status === 'pending') || null

  return {
    agency: {
      ...agency,
      creator_email: (agency.users as any)?.email || 'Unknown'
    } as AgencyData,
    members: (members || []) as AgentMember[],
    versions: (versions || []) as AgencyVersion[],
    currentVersion
  }
}

export async function generateMetadata({ params }: AgencyReviewPageProps) {
  const data = await getAgencyReviewData(params.id)
  
  if (!data) {
    return {
      title: 'Agency Not Found - Admin Review'
    }
  }

  return {
    title: `Review ${data.agency.name} - Admin`,
    description: `Administrative review for ${data.agency.name} agency submission.`
  }
}

export default async function AgencyReviewPage({ params }: AgencyReviewPageProps) {
  await requireAdmin()

  const data = await getAgencyReviewData(params.id)

  if (!data) {
    notFound()
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Review Agency: {data.agency.name}</h1>
        <p className="text-muted-foreground">
          Review and approve or reject this agency submission
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agency Preview */}
        <div className="space-y-6">
          <div className="border rounded-lg p-6 bg-white">
            <h2 className="text-xl font-semibold mb-4">Agency Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Name</label>
                <p className="text-lg font-semibold">{data.agency.name}</p>
              </div>
              
              {data.agency.coverage_areas && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Coverage Areas</label>
                  <p>{data.agency.coverage_areas}</p>
                </div>
              )}
              
              {data.agency.specialisms && data.agency.specialisms.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Specialisms</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {data.agency.specialisms.map((specialism, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm"
                      >
                        {specialism}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className="capitalize">{data.agency.status}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Created By</label>
                <p>{data.agency.creator_email}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Created</label>
                <p>{new Date(data.agency.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Team Members */}
          {data.members && data.members.length > 0 && (
            <div className="border rounded-lg p-6 bg-white">
              <h3 className="text-lg font-semibold mb-4">Team Members ({data.members.length})</h3>
              <div className="space-y-3">
                {data.members.map((member, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      <p className="text-xs text-gray-500">Role: {member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Admin Actions */}
        <div className="space-y-6">
          <AgencyReviewActions 
            agencyId={data.agency.id}
            agencyName={data.agency.name}
            currentNotes={data.agency.admin_notes}
          />

          {/* Quality Indicators */}
          <div className="border rounded-lg p-6 bg-white">
            <h3 className="text-lg font-semibold mb-4">Quality Indicators</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Has Logo</span>
                <span className={data.agency.logo_url ? 'text-green-600' : 'text-red-600'}>
                  {data.agency.logo_url ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Coverage Areas Set</span>
                <span className={data.agency.coverage_areas ? 'text-green-600' : 'text-red-600'}>
                  {data.agency.coverage_areas ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Has Specialisms</span>
                <span className={data.agency.specialisms?.length ? 'text-green-600' : 'text-red-600'}>
                  {data.agency.specialisms?.length ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Has Team Members</span>
                <span className={data.members?.length ? 'text-green-600' : 'text-red-600'}>
                  {data.members?.length ? '✓' : '✗'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}