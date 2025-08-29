import { useState, useEffect, useCallback } from 'react'

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

  return {
    agency,
    isLoading,
    error,
    formatAddress,
    getClassificationBadgeColor
  }
}

export type { Agency, TeamMember, LinkedCompany }