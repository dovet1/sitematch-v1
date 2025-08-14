'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, Loader2, Info, AlertTriangle } from 'lucide-react'

interface ValidationChecklist {
  hasName: boolean
  hasDescription: boolean
  hasLogo: boolean
  hasCoverageAreas: boolean
  hasSpecialisms: boolean
  hasTeamMembers: boolean
}

interface SubmitReviewModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: () => void
  agencyName: string
  isLoading: boolean
  validationChecklist: ValidationChecklist
}

export function SubmitReviewModal({
  isOpen,
  onClose,
  onSubmit,
  agencyName,
  isLoading,
  validationChecklist
}: SubmitReviewModalProps) {
  const checklistItems = [
    { label: 'Agency name provided', valid: validationChecklist.hasName },
    { label: 'Description added', valid: validationChecklist.hasDescription },
    { label: 'Logo uploaded', valid: validationChecklist.hasLogo },
    { label: 'Coverage areas defined', valid: validationChecklist.hasCoverageAreas },
    { label: 'Specialisms selected', valid: validationChecklist.hasSpecialisms },
    { label: 'Team members added', valid: validationChecklist.hasTeamMembers }
  ]

  const allValid = checklistItems.every(item => item.valid)
  const validCount = checklistItems.filter(item => item.valid).length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Submit Changes for Review?
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Agency Name */}
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">{agencyName}</p>
            <p className="text-sm text-gray-600 mt-1">
              {validCount} of {checklistItems.length} requirements completed
            </p>
          </div>

          {/* Pre-submission Checklist */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Pre-submission Checklist</h3>
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  {item.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm ${item.valid ? 'text-gray-900' : 'text-red-600'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Information Alert */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Your current listing remains live while changes are reviewed. 
              Typical review time is 24-48 hours.
            </AlertDescription>
          </Alert>

          {/* Warning if incomplete */}
          {!allValid && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please complete all required fields before submitting for review.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={onSubmit}
              disabled={!allValid || isLoading}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit for Review'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}