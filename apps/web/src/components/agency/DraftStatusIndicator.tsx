'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Clock, 
  AlertCircle, 
  Eye, 
  Trash2, 
  Save, 
  CheckCircle2,
  FileText
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface DraftVersion {
  id: string
  version_number: number
  data: any
  status: string
  created_at: string
  updated_at?: string
}

interface DraftStatusIndicatorProps {
  agencyId: string
  isAdmin: boolean
  onDraftChange?: (hasDraft: boolean) => void
}

export function DraftStatusIndicator({ 
  agencyId, 
  isAdmin, 
  onDraftChange 
}: DraftStatusIndicatorProps) {
  const [draft, setDraft] = useState<DraftVersion | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      fetchDraft()
    } else {
      setIsLoading(false)
    }
  }, [agencyId, isAdmin])

  useEffect(() => {
    onDraftChange?.(!!draft)
  }, [draft, onDraftChange])

  const fetchDraft = async () => {
    try {
      const response = await fetch(`/api/agencies/${agencyId}/draft`)
      if (response.ok) {
        const data = await response.json()
        setDraft(data.draft)
      }
    } catch (error) {
      console.error('Error fetching draft:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const discardDraft = async () => {
    if (!draft || !window.confirm('Are you sure you want to discard all pending changes?')) {
      return
    }

    setIsDiscarding(true)
    try {
      const response = await fetch(`/api/agencies/${agencyId}/draft`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setDraft(null)
        // Optionally trigger a page refresh or callback
        window.location.reload()
      } else {
        throw new Error('Failed to discard draft')
      }
    } catch (error) {
      console.error('Error discarding draft:', error)
      alert('Failed to discard draft. Please try again.')
    } finally {
      setIsDiscarding(false)
    }
  }

  const getChangeSummary = (versionData: any) => {
    const changes = versionData._changes
    if (!changes || !changes.fields) return 'General updates'
    
    const fieldLabels: Record<string, string> = {
      name: 'Agency name',
      description: 'Description', 
      website: 'Website',
      logo_url: 'Logo',
      coverage_areas: 'Coverage areas',
      specialisms: 'Specialisms'
    }

    const changedFields = changes.fields.map((field: string) => 
      fieldLabels[field] || field
    )

    if (changedFields.length === 1) {
      return `${changedFields[0]} updated`
    } else if (changedFields.length === 2) {
      return `${changedFields[0]} and ${changedFields[1]} updated`
    } else {
      return `${changedFields[0]} and ${changedFields.length - 1} other field${changedFields.length > 2 ? 's' : ''} updated`
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-16 w-full" />
    )
  }

  if (!draft || !isAdmin) {
    return null
  }

  const lastUpdated = draft.updated_at || draft.created_at
  const timeAgo = formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })

  return (
    <>
      <Alert className="border-yellow-200 bg-yellow-50">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-yellow-900">
                Pending Changes
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-yellow-700 hover:text-yellow-900"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {showDetails ? 'Hide' : 'View'} Details
                </Button>
              </div>
            </div>
            
            <AlertDescription className="text-yellow-800">
              <div className="space-y-1">
                <p>{getChangeSummary(draft.data)}</p>
                <p className="text-sm">
                  Last saved {timeAgo} • Version {draft.version_number}
                </p>
              </div>
            </AlertDescription>

            {showDetails && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-yellow-200">
                <h5 className="font-medium text-gray-900 mb-2">Change Details:</h5>
                <div className="space-y-2 text-sm">
                  {draft.data._changes?.fields?.map((field: string) => {
                    const fieldLabels: Record<string, string> = {
                      name: 'Agency Name',
                      description: 'Description',
                      website: 'Website',
                      logo_url: 'Logo',
                      coverage_areas: 'Coverage Areas',
                      specialisms: 'Specialisms'
                    }
                    
                    const label = fieldLabels[field] || field
                    const currentValue = draft.data[field]
                    const previousValue = draft.data._changes?.previousValues?.[field]
                    
                    return (
                      <div key={field} className="border-l-2 border-blue-200 pl-3">
                        <div className="font-medium text-gray-700">{label}</div>
                        {previousValue !== undefined && (
                          <div className="text-gray-500 line-through text-xs">
                            Previous: {Array.isArray(previousValue) 
                              ? previousValue.join(', ') 
                              : String(previousValue || 'Not set')}
                          </div>
                        )}
                        <div className="text-gray-900 text-xs">
                          New: {Array.isArray(currentValue) 
                            ? currentValue.join(', ') 
                            : String(currentValue || 'Not set')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <div className="flex items-center text-sm text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                <AlertCircle className="w-3 h-3 mr-1" />
                Changes require admin approval
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={discardDraft}
                disabled={isDiscarding}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {isDiscarding ? 'Discarding...' : 'Discard'}
              </Button>
            </div>
          </div>
        </div>
      </Alert>
    </>
  )
}