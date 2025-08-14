import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Suspense } from 'react'
import { AgencyGrid } from '@/components/agency/AgencyGrid'
import { AgencyCard } from '@/components/agency/AgencyCard'
import { Button } from '@/components/ui/button'
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal'
import { Plus, Users } from 'lucide-react'
import Link from 'next/link'

interface Agency {
  id: string
  name: string
  description: string | null
  website: string | null
  logo_url: string | null
  coverage_areas: string | null
  specialisms: string[]
  status: 'approved' | 'pending' | 'draft' | 'rejected'
  created_at: string
}

interface AgencySearchProps {
  searchParams: { search?: string; page?: string }
}

async function getApprovedAgencies(searchTerm?: string, page = 1) {
  const supabase = createServerClient()
  const pageSize = 12
  const from = (page - 1) * pageSize
  
  // Get agencies with their latest approved versions
  let query = supabase
    .from('agency_versions')
    .select(`
      id,
      agency_id,
      data,
      reviewed_at,
      agencies!inner(
        id,
        status,
        created_at
      )
    `)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .range(from, from + pageSize - 1)

  const { data: versionResults, error } = await query

  if (error) {
    console.error('Error fetching approved versions:', error)
    return []
  }

  if (!versionResults) return []

  // Transform the version data to match the expected Agency interface
  const agencies = versionResults.map(version => {
    // Parse the JSON data if it's stored as a string
    const data = typeof version.data === 'string' ? JSON.parse(version.data) : version.data
    
    return {
      id: version.agency_id,
      name: data.name,
      description: data.description,
      website: data.website,
      logo_url: data.logo_url,
      coverage_areas: data.coverage_areas,
      specialisms: data.specialisms,
      status: 'approved' as const,
      created_at: version.agencies.created_at
    }
  })

  // Apply search filtering after transformation
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase()
    return agencies.filter(agency => 
      agency.name?.toLowerCase().includes(searchLower) ||
      agency.description?.toLowerCase().includes(searchLower) ||
      agency.coverage_areas?.toLowerCase().includes(searchLower)
    )
  }

  return agencies
}

function AgencyCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden animate-pulse">
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="h-6 bg-gray-200 rounded-full w-16"></div>
          <div className="h-6 bg-gray-200 rounded-full w-20"></div>
          <div className="h-6 bg-gray-200 rounded-full w-14"></div>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <AgencyGrid>
      {Array.from({ length: 12 }).map((_, i) => (
        <AgencyCardSkeleton key={i} />
      ))}
    </AgencyGrid>
  )
}

async function AgencyListing({ searchTerm, page }: { searchTerm?: string; page: number }) {
  const agencies = await getApprovedAgencies(searchTerm, page)

  if (agencies.length === 0) {
    return (
      <div className="space-y-8">
        {/* Show Add Agency CTA first, even when no agencies exist */}
        <div className="max-w-sm mx-auto">
          <AddAgencyCTA />
        </div>
        
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h6m-6 4h6m-6 4h6" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? "No agencies found" : "Be the first agency!"}
            </h3>
            <p className="text-gray-600">
              {searchTerm 
                ? `No agencies match "${searchTerm}". Try searching with different terms.`
                : "No real estate agencies are listed yet. Add your agency to be the first!"
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AgencyGrid>
      <AddAgencyCTA />
      {agencies.map((agency) => (
        <AgencyCard key={agency.id} agency={agency} />
      ))}
    </AgencyGrid>
  )
}

async function AddAgencyCTA() {
  const user = await getCurrentUser()
  
  if (!user) {
    return (
      <AuthChoiceModal
        redirectTo="/agents/add"
        title="Add Your Agency"
        description="Create your agency profile and showcase your expertise"
      >
        <div className="bg-white rounded-lg border-2 border-dashed border-blue-300 p-6 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Your Agency</h3>
            <p className="text-gray-600 text-sm">
              Showcase your expertise and connect with potential clients
            </p>
          </div>
        </div>
      </AuthChoiceModal>
    )
  }

  // Check if user is already part of an agency
  const supabase = createServerClient()
  const { data: existingMembership } = await supabase
    .from('agency_agents')
    .select('agency_id')
    .eq('user_id', user.id)
    .single()

  if (existingMembership) {
    return null // Don't show CTA if already part of an agency
  }

  return (
    <Link href="/agents/add">
      <div className="bg-white rounded-lg border-2 border-dashed border-blue-300 p-6 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Your Agency</h3>
          <p className="text-gray-600 text-sm">
            Showcase your expertise and connect with potential clients
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function AgentsPage({ searchParams }: AgencySearchProps) {
  const searchTerm = searchParams.search
  const currentPage = parseInt(searchParams.page || '1', 10)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Real Estate Agencies
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-8">
              Discover professional real estate agencies that serve your area and specialize in your property needs
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <form method="GET" className="relative">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    name="search"
                    defaultValue={searchTerm}
                    placeholder="Search agencies by name, location, or specialty..."
                    className="w-full h-14 pl-14 pr-4 text-gray-900 bg-white rounded-full border border-gray-300 shadow-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg placeholder-gray-500"
                  />
                </div>
                <button
                  type="submit"
                  className="absolute right-2 top-2 h-10 px-6 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {searchTerm && (
          <div className="mb-8">
            <p className="text-gray-600">
              Showing results for <span className="font-semibold">"{searchTerm}"</span>
            </p>
          </div>
        )}

        <Suspense fallback={<LoadingSkeleton />}>
          <AgencyListing searchTerm={searchTerm} page={currentPage} />
        </Suspense>
      </div>
    </div>
  )
}