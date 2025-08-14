'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { XCircle, Edit3 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface RejectedVersion {
  id: string
  version_number: number
  status: string
  reviewed_at: string
  admin_notes: string
}

interface RejectedStatusIndicatorProps {
  agencyId: string
  isAdmin: boolean
}

export function RejectedStatusIndicator({ 
  agencyId, 
  isAdmin
}: RejectedStatusIndicatorProps) {
  const [rejectedVersion, setRejectedVersion] = useState<RejectedVersion | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isAdmin) {
      fetchRejectedVersions()
    } else {
      setIsLoading(false)
    }
  }, [agencyId, isAdmin])

  const fetchRejectedVersions = async () => {
    try {
      // Get all versions to determine the latest one
      const allVersionsResponse = await fetch(`/api/agencies/${agencyId}/versions`)
      if (allVersionsResponse.ok) {
        const allData = await allVersionsResponse.json()
        const versions = allData.versions || []
        
        // Find the latest version by version_number
        const latestVersion = versions.reduce((latest: any, current: any) => {
          return current.version_number > (latest?.version_number || 0) ? current : latest
        }, null)
        
        // Only show rejected status if the latest version is rejected
        if (latestVersion && latestVersion.status === 'rejected') {
          setRejectedVersion(latestVersion)
        } else {
          setRejectedVersion(null)
        }
      }
    } catch (error) {
      console.error('Error fetching rejected versions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-16 w-full" />
    )
  }

  if (!rejectedVersion || !isAdmin) {
    return null
  }

  const reviewedAt = new Date(rejectedVersion.reviewed_at)
  const timeAgo = formatDistanceToNow(reviewedAt, { addSuffix: true })

  return (
    <Alert className="border-red-200 bg-red-50 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
        </div>
        
        <div className="flex-1">
          <h4 className="font-semibold text-red-900 mb-1">
            Changes Rejected
          </h4>
          
          <AlertDescription className="text-red-800">
            <p className="text-sm mb-2">
              Rejected {timeAgo}
            </p>
            <div className="bg-red-100 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-sm font-medium text-red-900 mb-1">
                Feedback from admin:
              </p>
              <p className="text-sm text-red-800">
                {rejectedVersion.admin_notes}
              </p>
            </div>
            <p className="text-sm text-red-700 mb-3">
              Please address the feedback above and resubmit your changes.
            </p>
          </AlertDescription>

          <div className="flex items-center gap-2">
            <Link href="/agents/settings/edit">
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                <Edit3 className="w-4 h-4 mr-2" />
                Edit & Resubmit
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Alert>
  )
}