'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Mail, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'

interface PendingInvitation {
  id: string
  email: string
  name: string
  role: 'admin' | 'member'
  status: string
  expires_at: string
  invited_at: string
}

interface InvitationManagementProps {
  agencyId: string
  invitations: PendingInvitation[]
  onInvitationsUpdated: () => void
}

export function InvitationManagement({ agencyId, invitations, onInvitationsUpdated }: InvitationManagementProps) {
  const [selectedInvitation, setSelectedInvitation] = useState<PendingInvitation | null>(null)
  const [actionType, setActionType] = useState<'resend' | 'cancel' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const openResendDialog = (invitation: PendingInvitation) => {
    setSelectedInvitation(invitation)
    setActionType('resend')
    setMessage(null)
  }

  const openCancelDialog = (invitation: PendingInvitation) => {
    setSelectedInvitation(invitation)
    setActionType('cancel')
    setMessage(null)
  }

  const closeDialog = () => {
    setSelectedInvitation(null)
    setActionType(null)
    setMessage(null)
    setIsSubmitting(false)
  }

  const handleResendInvitation = async () => {
    if (!selectedInvitation) return

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/agencies/${agencyId}/invitations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: selectedInvitation.id
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend invitation')
      }

      setMessage({ type: 'success', text: result.data.message })
      setTimeout(() => {
        closeDialog()
        onInvitationsUpdated()
      }, 1500)

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to resend invitation' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelInvitation = async () => {
    if (!selectedInvitation) return

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/agencies/${agencyId}/invitations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: selectedInvitation.id
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel invitation')
      }

      setMessage({ type: 'success', text: result.data.message })
      setTimeout(() => {
        closeDialog()
        onInvitationsUpdated()
      }, 1500)

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to cancel invitation' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const isExpiringSoon = (expiresAt: string): boolean => {
    const expirationDate = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiration = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntilExpiration <= 1
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No pending invitations</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {invitations.map((invitation) => (
          <div key={invitation.id} className={`flex items-center justify-between p-4 border rounded-lg ${
            isExpiringSoon(invitation.expires_at) 
              ? 'bg-red-50 border-red-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div>
              <p className="font-medium text-gray-900">{invitation.name}</p>
              <p className="text-sm text-gray-600">{invitation.email}</p>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-xs text-gray-500">
                  Invited {formatDate(invitation.invited_at)}
                </p>
                <span className="text-xs text-gray-400">•</span>
                <p className={`text-xs ${
                  isExpiringSoon(invitation.expires_at) 
                    ? 'text-red-600 font-medium' 
                    : 'text-gray-500'
                }`}>
                  Expires {formatDate(invitation.expires_at)}
                  {isExpiringSoon(invitation.expires_at) && ' (Soon)'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary">{invitation.role}</Badge>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openResendDialog(invitation)}
                  className="flex items-center"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Resend
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCancelDialog(invitation)}
                  className="flex items-center text-red-600 hover:text-red-700"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Resend Invitation Dialog */}
      <Dialog open={actionType === 'resend'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend Invitation</DialogTitle>
          </DialogHeader>
          
          {selectedInvitation && (
            <div className="space-y-4">
              {message && (
                <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                  {message.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Mail className="w-6 h-6 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Resend invitation to {selectedInvitation.name}</p>
                    <p className="text-sm text-blue-700 mt-1">
                      This will generate a new invitation link and extend the expiration by 7 days. 
                      A new email will be sent to <strong>{selectedInvitation.email}</strong>.
                    </p>
                    <div className="mt-2 text-xs text-blue-600">
                      <p>Current expiration: {formatDate(selectedInvitation.expires_at)}</p>
                      <p>New expiration: {formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleResendInvitation} disabled={isSubmitting} className="flex items-center">
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? 'Sending...' : 'Resend Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Invitation Dialog */}
      <Dialog open={actionType === 'cancel'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Invitation</DialogTitle>
          </DialogHeader>
          
          {selectedInvitation && (
            <div className="space-y-4">
              {message && (
                <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                  {message.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Cancel invitation for {selectedInvitation.name}</p>
                    <p className="text-sm text-red-700 mt-1">
                      This will permanently cancel the invitation sent to <strong>{selectedInvitation.email}</strong>. 
                      The invitation link will no longer work and they won't be able to join your agency with this invitation.
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      <strong>You can send a new invitation later if needed.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Keep Invitation
            </Button>
            <Button variant="destructive" onClick={handleCancelInvitation} disabled={isSubmitting}>
              {isSubmitting ? 'Cancelling...' : 'Cancel Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}