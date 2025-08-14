'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface AgencyReviewActionsProps {
  agencyId: string
  agencyName: string
  currentNotes?: string | null
}

const rejectionReasons = [
  'Incomplete information',
  'Invalid business credentials',
  'Inappropriate content',
  'Duplicate submission',
  'Does not meet platform standards',
  'Other (specify in notes)'
]

export function AgencyReviewActions({ agencyId, agencyName, currentNotes }: AgencyReviewActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [adminNotes, setAdminNotes] = useState(currentNotes || '')
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const router = useRouter()

  const handleApprove = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/agencies/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agencyId,
          adminNotes: adminNotes.trim() || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve agency')
      }

      // Show success message
      alert(`✅ ${agencyName} has been approved successfully!`)
      
      // Redirect back to admin agencies page
      router.push('/admin/agencies')
      router.refresh()

    } catch (error) {
      console.error('Error approving agency:', error)
      alert(`❌ Error approving agency: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason) {
      alert('Please select a rejection reason')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/agencies/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agencyId,
          reason: rejectionReason,
          adminNotes: adminNotes.trim() || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject agency')
      }

      // Show success message
      alert(`❌ ${agencyName} has been rejected.`)
      
      // Redirect back to admin agencies page
      router.push('/admin/agencies')
      router.refresh()

    } catch (error) {
      console.error('Error rejecting agency:', error)
      alert(`❌ Error rejecting agency: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      setShowRejectForm(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showRejectForm ? (
            <>
              <Button 
                onClick={handleApprove}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Approve Agency
              </Button>
              
              <Button 
                onClick={() => setShowRejectForm(true)}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Agency
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason *
                </label>
                <Select value={rejectionReason} onValueChange={setRejectionReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rejectionReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleReject}
                  disabled={isLoading || !rejectionReason}
                  variant="destructive"
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Confirm Reject
                </Button>
                
                <Button 
                  onClick={() => setShowRejectForm(false)}
                  disabled={isLoading}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Notes
            </label>
            <Textarea 
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this review..."
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}