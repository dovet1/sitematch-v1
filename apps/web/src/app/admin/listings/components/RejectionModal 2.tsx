'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { rejectListingAction } from '@/lib/actions/submit-listing-for-review'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface RejectionModalProps {
  isOpen: boolean
  onClose: () => void
  listingId: string
  companyName: string
  versionId?: string
}

const rejectionReasons = [
  { value: 'incomplete_company_info', label: 'Incomplete Company Information' },
  { value: 'missing_contact_details', label: 'Missing Contact Details' },
  { value: 'unclear_requirements', label: 'Unclear Requirements' },
  { value: 'invalid_brochure', label: 'Invalid or Missing Brochure' },
  { value: 'duplicate_listing', label: 'Duplicate Listing' },
  { value: 'requirements_too_vague', label: 'Requirements Too Vague' },
  { value: 'suspected_spam', label: 'Suspected Spam' },
  { value: 'other', label: 'Other (please specify)' },
]

export function RejectionModal({
  isOpen,
  onClose,
  listingId,
  companyName,
  versionId
}: RejectionModalProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleReject = async () => {
    console.log('handleReject called', { selectedReason, customReason, versionId })
    
    if (!selectedReason) {
      toast.error('Please select a rejection reason')
      return
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      toast.error('Please provide a custom reason')
      return
    }

    setIsSubmitting(true)

    try {
      // Build the rejection reason string
      const reason = selectedReason === 'other' 
        ? customReason 
        : rejectionReasons.find(r => r.value === selectedReason)?.label || selectedReason

      console.log('Rejection details:', { listingId, versionId, reason })

      // We need to get the version ID if not provided
      let targetVersionId = versionId
      
      if (!targetVersionId) {
        console.log('No version ID provided, attempting to fetch...')
        // Get the latest pending_review version for this listing using client-side Supabase
        const { createClientClient } = await import('@/lib/supabase')
        const supabase = createClientClient()
        
        const { data: version, error } = await supabase
          .from('listing_versions')
          .select('id')
          .eq('listing_id', listingId)
          .eq('status', 'pending_review')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        console.log('Version query result:', { version, error })
        
        if (version) {
          targetVersionId = version.id
        } else {
          throw new Error('No pending review version found')
        }
      }

      console.log('Calling rejectListingAction with:', { listingId, targetVersionId, reason })
      
      // Ensure we have a version ID before proceeding
      if (!targetVersionId) {
        throw new Error('No version ID available for rejection')
      }
      
      // Use the proper rejection action that updates versions
      const result = await rejectListingAction(listingId, targetVersionId, reason)
      
      console.log('rejectListingAction result:', result)

      if (result.success) {
        toast.success('Listing rejected successfully')
        router.refresh()
        onClose()
      } else {
        console.error('Rejection failed:', result.error)
        toast.error(result.error || 'Failed to reject listing')
      }
    } catch (error) {
      console.error('Error rejecting listing:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reject listing')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Reject Listing</DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting the listing from <strong>{companyName}</strong>.
            The occupier will receive this feedback via email.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Rejection Reason</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a rejection reason" />
              </SelectTrigger>
              <SelectContent>
                {rejectionReasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="customReason">Custom Reason</Label>
              <Textarea
                id="customReason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please provide specific details about why this listing is being rejected..."
                className="min-h-[100px]"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              console.log('Reject button clicked')
              handleReject()
            }}
            disabled={isSubmitting || !selectedReason}
          >
            {isSubmitting ? 'Rejecting...' : 'Reject Listing'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}