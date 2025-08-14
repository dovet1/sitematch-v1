'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Edit3, Loader2, Building2 } from 'lucide-react'
import Link from 'next/link'

interface EditAgencyButtonProps {
  agencyId: string
  agencyStatus: 'draft' | 'pending' | 'approved' | 'rejected'
  isAdmin: boolean
  size?: 'sm' | 'lg'
  variant?: 'default' | 'outline'
  className?: string
}

export function EditAgencyButton({ 
  agencyId, 
  agencyStatus, 
  isAdmin, 
  size = 'lg', 
  variant = 'default',
  className = ''
}: EditAgencyButtonProps) {
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check for pending agency version
  useEffect(() => {
    const checkPendingVersion = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/agencies/${agencyId}/versions?status=pending`)
        if (response.ok) {
          const data = await response.json()
          setHasPendingChanges(data.versions && data.versions.length > 0)
        }
      } catch (error) {
        console.error('Error checking pending version:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (agencyId && isAdmin) {
      checkPendingVersion()
    }
  }, [agencyId, isAdmin])

  // Don't show button if not admin
  if (!isAdmin) {
    return null
  }

  const isDisabled = hasPendingChanges
  
  const tooltipContent = isDisabled 
    ? "Changes are currently under review. Please wait for approval before making new edits."
    : "Edit your agency listing details"

  const buttonContent = (
    <Button
      size={size}
      variant={variant}
      disabled={isDisabled || isLoading}
      className={variant === 'default' ? `
        bg-gradient-to-r from-violet-600 to-blue-600 
        hover:from-violet-700 hover:to-blue-700 
        text-white shadow-lg hover:shadow-xl 
        transition-all duration-200 transform hover:scale-105
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${className}
      ` : `w-full justify-start disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          {variant === 'outline' ? (
            <Building2 className="w-4 h-4 mr-2" />
          ) : (
            <Edit3 className="w-4 h-4 mr-2" />
          )}
          Edit Agency Listing
        </>
      )}
    </Button>
  )

  if (isDisabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              {buttonContent}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={`/agents/settings/edit`} className="inline-block">
            {buttonContent}
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}