'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Edit3, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface EditAgencyButtonProps {
  agencyId: string
  agencyStatus: 'draft' | 'pending' | 'approved' | 'rejected'
  isAdmin: boolean
}

export function EditAgencyButton({ agencyId, agencyStatus, isAdmin }: EditAgencyButtonProps) {
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check for pending draft changes
  useEffect(() => {
    const checkPendingChanges = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/agencies/${agencyId}/draft`)
        if (response.ok) {
          const data = await response.json()
          setHasPendingChanges(data.hasDraft || false)
        }
      } catch (error) {
        console.error('Error checking pending changes:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (agencyId && isAdmin) {
      checkPendingChanges()
    }
  }, [agencyId, isAdmin])

  // Don't show button if not admin
  if (!isAdmin) {
    return null
  }

  const isDisabled = agencyStatus === 'pending' && hasPendingChanges
  
  const tooltipContent = isDisabled 
    ? "Changes are currently under review. Please wait for approval before making new edits."
    : "Edit your agency listing details"

  const buttonContent = (
    <Button
      size="lg"
      disabled={isDisabled || isLoading}
      className={`
        bg-gradient-to-r from-violet-600 to-blue-600 
        hover:from-violet-700 hover:to-blue-700 
        text-white shadow-lg hover:shadow-xl 
        transition-all duration-200 transform hover:scale-105
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
      `}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          <Edit3 className="w-4 h-4 mr-2" />
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
            {buttonContent}
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
          <Link href={`/agents/settings/edit`}>
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