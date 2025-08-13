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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, Settings, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import Image from 'next/image'

interface AgentMember {
  user_id?: string
  email: string
  name: string
  role: 'admin' | 'member'
  is_registered: boolean
  joined_at: string | null
  headshot_url: string | null
}

interface MemberManagementProps {
  agencyId: string
  members: AgentMember[]
  currentUserId: string
  onMemberUpdated: () => void
}

export function MemberManagement({ agencyId, members, currentUserId, onMemberUpdated }: MemberManagementProps) {
  const [selectedMember, setSelectedMember] = useState<AgentMember | null>(null)
  const [actionType, setActionType] = useState<'role' | 'remove' | null>(null)
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const openRoleDialog = (member: AgentMember) => {
    setSelectedMember(member)
    setNewRole(member.role === 'admin' ? 'member' : 'admin')
    setActionType('role')
    setMessage(null)
  }

  const openRemoveDialog = (member: AgentMember) => {
    setSelectedMember(member)
    setActionType('remove')
    setMessage(null)
  }

  const closeDialog = () => {
    setSelectedMember(null)
    setActionType(null)
    setMessage(null)
    setIsSubmitting(false)
  }

  const handleRoleChange = async () => {
    if (!selectedMember?.user_id) return

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/agencies/${agencyId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedMember.user_id,
          role: newRole
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update member role')
      }

      setMessage({ type: 'success', text: result.data.message })
      setTimeout(() => {
        closeDialog()
        onMemberUpdated()
      }, 1500)

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update member role' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedMember?.user_id) return

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/agencies/${agencyId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedMember.user_id
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove member')
      }

      setMessage({ type: 'success', text: result.data.message })
      setTimeout(() => {
        closeDialog()
        onMemberUpdated()
      }, 1500)

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to remove member' 
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

  return (
    <>
      <div className="space-y-3">
        {members.map((member, index) => (
          <div key={member.user_id || index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center">
                {member.headshot_url ? (
                  <Image
                    src={member.headshot_url}
                    alt={member.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{member.name}</p>
                <p className="text-sm text-gray-500">{member.email}</p>
                {member.joined_at && (
                  <p className="text-xs text-gray-400">
                    Joined {formatDate(member.joined_at)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                {member.role}
              </Badge>
              <Badge variant={member.is_registered ? 'default' : 'outline'}>
                {member.is_registered ? 'Active' : 'Pending'}
              </Badge>
              {member.user_id !== currentUserId && member.user_id && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openRoleDialog(member)}
                    className="flex items-center"
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Role
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openRemoveDialog(member)}
                    className="flex items-center text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Role Change Dialog */}
      <Dialog open={actionType === 'role'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
          </DialogHeader>
          
          {selectedMember && (
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

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedMember.name}</p>
                    <p className="text-sm text-gray-500">{selectedMember.email}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">New Role</label>
                <Select value={newRole} onValueChange={(value: 'admin' | 'member') => setNewRole(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {newRole === 'admin' 
                    ? 'Admins can manage agency settings, invite members, and manage the team.'
                    : 'Members have standard access to the agency dashboard and profile.'
                  }
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleRoleChange} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={actionType === 'remove'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
          </DialogHeader>
          
          {selectedMember && (
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
                    <p className="font-medium text-red-900">Remove {selectedMember.name}</p>
                    <p className="text-sm text-red-700 mt-1">
                      This will permanently remove {selectedMember.name} from your agency. 
                      They will no longer have access to the agency dashboard or be listed as part of your team.
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      <strong>This action cannot be undone.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={isSubmitting}>
              {isSubmitting ? 'Removing...' : 'Remove Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}