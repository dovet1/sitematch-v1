import { requireAdmin } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { AdminAgenciesDashboard } from '@/components/admin/AdminAgenciesDashboard'

export const metadata = {
  title: 'Agency Administration - SiteMatcher',
  description: 'Review and approve agency submissions and manage agency listings.',
}

interface AgencyStats {
  total: number
  pending: number
  approved: number
  rejected: number
  approvalRate: number
  avgReviewTime: number
}

interface AgencyWithStatus {
  id: string
  name: string
  logo_url: string | null
  coverage_areas: string | null
  specialisms: string[]
  status: 'pending' | 'draft' | 'approved' | 'rejected'
  created_at: string
  created_by: string
  creator_email: string
  agent_count: number
  listings_count: number
}

async function getAgencyStats(): Promise<AgencyStats> {
  const supabase = createServerClient()

  // Get agency counts by status
  const { data: agencies } = await supabase
    .from('agencies')
    .select('status, created_at, approved_at')

  // Get agencies with pending versions (the real pending count)
  const { data: pendingVersions } = await supabase
    .from('agency_versions')
    .select('agency_id')
    .eq('status', 'pending')

  if (!agencies) {
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      approvalRate: 0,
      avgReviewTime: 0
    }
  }

  const total = agencies.length
  const pending = pendingVersions?.length || 0  // Use pending versions count
  const approved = agencies.filter(a => a.status === 'approved').length
  const rejected = agencies.filter(a => a.status === 'rejected').length

  // Calculate approval rate
  const reviewed = approved + rejected
  const approvalRate = reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0

  // Calculate average review time (in hours) for agencies approved in last 30 days
  const recentlyApproved = agencies
    .filter(a => a.status === 'approved' && a.approved_at)
    .filter(a => {
      const approvedDate = new Date(a.approved_at!)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return approvedDate >= thirtyDaysAgo
    })

  let avgReviewTime = 0
  if (recentlyApproved.length > 0) {
    const totalReviewTime = recentlyApproved.reduce((sum, agency) => {
      const created = new Date(agency.created_at)
      const approved = new Date(agency.approved_at!)
      const reviewTimeHours = (approved.getTime() - created.getTime()) / (1000 * 60 * 60)
      return sum + reviewTimeHours
    }, 0)
    avgReviewTime = Math.round(totalReviewTime / recentlyApproved.length)
  }

  return {
    total,
    pending,
    approved,
    rejected,
    approvalRate,
    avgReviewTime
  }
}

async function getAllAgencies(): Promise<AgencyWithStatus[]> {
  const supabase = createServerClient()

  console.log('=== GETTING ALL AGENCIES ===')
  
  // Get all agencies
  const { data: allAgencies, error } = await supabase
    .from('agencies')
    .select(`
      id,
      name,
      logo_url,
      coverage_areas,
      specialisms,
      status,
      created_at,
      created_by,
      users!agencies_created_by_fkey(email)
    `)
    .order('created_at', { ascending: false })

  console.log('All agencies query result:', allAgencies)
  console.log('All agencies query error:', error)

  if (!allAgencies) {
    return []
  }

  // Get pending versions to mark agencies with pending changes
  const { data: pendingVersions } = await supabase
    .from('agency_versions')
    .select('agency_id')
    .eq('status', 'pending')

  const pendingAgencyIds = new Set(pendingVersions?.map(v => v.agency_id) || [])

  // Get agent counts for each agency
  const agencyIds = allAgencies.map(a => a.id)
  const { data: agentCounts } = await supabase
    .from('agency_agents')
    .select('agency_id')
    .in('agency_id', agencyIds)

  // Get listing associations (placeholder for when Story 18.4 is implemented)
  const agentCountMap = agentCounts?.reduce((acc, agent) => {
    acc[agent.agency_id] = (acc[agent.agency_id] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return allAgencies.map(agency => ({
    id: agency.id,
    name: agency.name,
    logo_url: agency.logo_url,
    coverage_areas: agency.coverage_areas || '',
    specialisms: agency.specialisms || [],
    status: (pendingAgencyIds.has(agency.id) ? 'pending' : agency.status) as 'pending' | 'draft' | 'approved' | 'rejected',
    created_at: agency.created_at,
    created_by: agency.created_by,
    creator_email: (agency.users as any)?.email || 'Unknown',
    agent_count: agentCountMap[agency.id] || 0,
    listings_count: 0 // Will be populated in Story 18.4
  }))
}

export default async function AdminAgenciesPage() {
  console.log('=== ADMIN AGENCIES PAGE START ===')
  
  try {
    console.log('Checking admin authentication...')
    await requireAdmin()
    console.log('Admin authentication passed')

    console.log('Fetching stats and all agencies...')
    const [stats, allAgencies] = await Promise.all([
      getAgencyStats(),
      getAllAgencies()
    ])
    console.log('Stats:', stats)
    console.log('All agencies result:', allAgencies)

    return (
      <AdminAgenciesDashboard
        stats={stats}
        pendingAgencies={allAgencies}
      />
    )
  } catch (error) {
    console.error('=== ADMIN AGENCIES PAGE ERROR ===', error)
    return <div>Error loading admin agencies page: {error instanceof Error ? error.message : 'Unknown error'}</div>
  }
}