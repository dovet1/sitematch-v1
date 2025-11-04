import { useState, useEffect, useCallback } from 'react'
import { createClientClient } from '@/lib/supabase'

interface TeamMember {
  id: string
  name: string
  title: string
  bio?: string
  email: string
  phone?: string
  linkedin_url?: string
  headshot_url?: string
  display_order: number
}

interface LinkedCompany {
  id: string
  company_name: string
  logo_url?: string
  logo_bucket?: string
  clearbit_logo?: boolean
  company_domain?: string
}

interface Agency {
  id: string
  name: string
  description?: string
  classification?: 'Commercial' | 'Residential' | 'Both'
  geographic_patch?: string
  website?: string
  logo_url?: string
  contact_email: string
  contact_phone: string
  office_address?: string
  created_at: string
  updated_at: string
  agency_team_members?: TeamMember[]
  linked_companies?: LinkedCompany[]
}

export function useAgencyModal(agencyId: string | null, isOpen: boolean) {
  const [agency, setAgency] = useState<Agency | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAgency = useCallback(async () => {
    if (!agencyId) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/agencies/${agencyId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch agency')
      }
      const result = await response.json()
      setAgency(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agency')
    } finally {
      setIsLoading(false)
    }
  }, [agencyId])

  useEffect(() => {
    if (isOpen && agencyId) {
      fetchAgency()
    } else {
      setAgency(null)
      setError(null)
    }
  }, [isOpen, agencyId, fetchAgency])

  const formatAddress = (agency: Agency) => {
    return agency.office_address || null
  }

  const getClassificationBadgeColor = (classification?: string) => {
    switch (classification) {
      case 'Commercial':
        return 'bg-blue-100 text-blue-800'
      case 'Residential':
        return 'bg-green-100 text-green-800'
      case 'Both':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCompanyLogo = (company: LinkedCompany) => {
    if (company.logo_url) {
      // If it's already a full URL, use as-is
      if (company.logo_url.startsWith('http')) {
        return company.logo_url
      }
      
      // If it's a file path, convert to Supabase storage URL using the correct bucket
      const supabase = createClientClient()
      const bucket = company.logo_bucket || 'listings' // fallback to listings if no bucket specified
      const { data } = supabase.storage.from(bucket).getPublicUrl(company.logo_url)
      return data.publicUrl
    } else if (company.clearbit_logo && company.company_domain) {
      const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN
      return token ? `https://img.logo.dev/${company.company_domain}?token=${token}` : null
    }
    return null
  }

  return {
    agency,
    isLoading,
    error,
    formatAddress,
    getClassificationBadgeColor,
    getCompanyLogo
  }
}

export type { Agency, TeamMember, LinkedCompany }