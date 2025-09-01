'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Building2 } from 'lucide-react'

interface LinkedCompany {
  id: string
  company_name: string
  logo_url?: string
  logo_bucket?: string
  clearbit_logo?: boolean
  company_domain?: string
}

interface CompanyListingLinkProps {
  company: LinkedCompany
  agencyId: string
  getCompanyLogo: (company: LinkedCompany) => string | null
  onListingClick?: (listingId: string) => void
}

export function CompanyListingLink({ company, agencyId, getCompanyLogo, onListingClick }: CompanyListingLinkProps) {
  const [listingId, setListingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchListingId() {
      try {
        const url = `/api/public/listings?companyName=${encodeURIComponent(company.company_name)}&limit=1`
        console.log('🔍 Fetching listing for:', company.company_name, 'URL:', url)
        
        const response = await fetch(url)
        const result = await response.json()
        
        console.log('API response:', result)
        
        if (response.ok && result.results && result.results.length > 0) {
          const listingId = result.results[0].id
          setListingId(listingId)
          console.log('Found listing ID:', listingId)
        } else {
          console.log('No listing found for company:', company.company_name)
          setListingId(null)
        }
      } catch (error) {
        console.error('Error fetching listing ID:', error)
        setListingId(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchListingId()
  }, [agencyId, company.company_name])

  const handleClick = (e: React.MouseEvent) => {
    if (listingId && onListingClick) {
      e.preventDefault()
      onListingClick(listingId)
    }
    // If no onListingClick callback or no listingId, let the Link handle navigation
  }

  const href = listingId 
    ? `/search?listingId=${listingId}`
    : `/search?viewAll=true&companyName=${encodeURIComponent(company.company_name)}`

  const title = listingId
    ? `View ${company.company_name}'s property listing`
    : `View all listings from ${company.company_name}`

  return (
    <Link
      href={href}
      title={title}
      onClick={handleClick}
      className="group block hover:scale-105 transition-transform duration-200"
    >
      <div className="aspect-square bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-center group-hover:border-blue-300 group-hover:shadow-sm transition-colors">
        {getCompanyLogo(company) ? (
          <Image
            src={getCompanyLogo(company)!}
            alt={`${company.company_name} logo`}
            width={256}
            height={256}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
        )}
      </div>
      <p className="text-xs text-center text-slate-600 mt-2 line-clamp-2 group-hover:text-slate-900 transition-colors">
        {company.company_name}
      </p>
    </Link>
  )
}