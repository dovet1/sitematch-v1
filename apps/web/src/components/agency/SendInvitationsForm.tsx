'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, X, Mail, CheckCircle2, AlertCircle } from 'lucide-react'

interface InvitationData {
  email: string
  name: string
  role: 'admin' | 'member'
}

interface SendInvitationsFormProps {
  agencyId: string
  agencyName: string
}

export function SendInvitationsForm({ agencyId, agencyName }: SendInvitationsFormProps) {
  const [invitations, setInvitations] = useState<InvitationData[]>([
    { email: '', name: '', role: 'member' }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const addInvitationRow = () => {
    if (invitations.length < 10) {
      setInvitations([...invitations, { email: '', name: '', role: 'member' }])
    }
  }

  const removeInvitationRow = (index: number) => {
    if (invitations.length > 1) {
      setInvitations(invitations.filter((_, i) => i !== index))
    }
  }

  const updateInvitation = (index: number, field: keyof InvitationData, value: string) => {
    const updated = [...invitations]
    updated[index] = { ...updated[index], [field]: value }
    setInvitations(updated)
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    // Validate all invitations
    const validInvitations = invitations.filter(inv => 
      inv.email.trim() && inv.name.trim() && validateEmail(inv.email.trim())
    )

    if (validInvitations.length === 0) {
      setMessage({ 
        type: 'error', 
        text: 'Please add at least one valid invitation with email and name.' 
      })
      return
    }

    // Check for duplicate emails in the form
    const emails = validInvitations.map(inv => inv.email.toLowerCase())
    const uniqueEmails = new Set(emails)
    if (emails.length !== uniqueEmails.size) {
      setMessage({ 
        type: 'error', 
        text: 'Duplicate email addresses are not allowed.' 
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/agencies/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agencyId,
          invitations: validInvitations
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitations')
      }

      const { successful, failed, duplicates } = result.data

      let successMessage = ''
      if (successful > 0) {
        successMessage += `${successful} invitation${successful > 1 ? 's' : ''} sent successfully. `
      }
      if (failed > 0) {
        successMessage += `${failed} invitation${failed > 1 ? 's' : ''} failed to send. `
      }
      if (duplicates > 0) {
        successMessage += `${duplicates} duplicate${duplicates > 1 ? 's' : ''} skipped. `
      }

      setMessage({ 
        type: successful > 0 ? 'success' : 'error', 
        text: successMessage.trim()
      })

      if (successful > 0) {
        // Reset form on success
        setInvitations([{ email: '', name: '', role: 'member' }])
      }

    } catch (error) {
      console.error('Error sending invitations:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to send invitations' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-medium">Team Member Invitations</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInvitationRow}
            disabled={invitations.length >= 10}
            className="flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </div>

        {invitations.map((invitation, index) => (
          <Card key={index} className="p-4">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <Label htmlFor={`name-${index}`} className="text-sm font-medium">
                    Full Name *
                  </Label>
                  <Input
                    id={`name-${index}`}
                    placeholder="John Smith"
                    value={invitation.name}
                    onChange={(e) => updateInvitation(index, 'name', e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-4">
                  <Label htmlFor={`email-${index}`} className="text-sm font-medium">
                    Email Address *
                  </Label>
                  <Input
                    id={`email-${index}`}
                    type="email"
                    placeholder="john@example.com"
                    value={invitation.email}
                    onChange={(e) => updateInvitation(index, 'email', e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-3">
                  <Label htmlFor={`role-${index}`} className="text-sm font-medium">
                    Role
                  </Label>
                  <Select
                    value={invitation.role}
                    onValueChange={(value) => updateInvitation(index, 'role', value as 'admin' | 'member')}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-1 flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeInvitationRow(index)}
                    disabled={invitations.length <= 1 || isSubmitting}
                    className="w-full md:w-auto"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Invitation Details
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Invitations will be sent via email with a secure link to join <strong>{agencyName}</strong>. 
              Invitations expire after 7 days and can be resent if needed.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setInvitations([{ email: '', name: '', role: 'member' }])}
          disabled={isSubmitting}
        >
          Clear All
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !invitations.some(inv => inv.email && inv.name)}
          className="flex items-center"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Mail className="w-4 h-4 mr-2" />
          )}
          {isSubmitting ? 'Sending...' : 'Send Invitations'}
        </Button>
      </div>
    </form>
  )
}