'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  ExternalLink,
  GripVertical,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { TeamMemberForm } from './team-member-form'
import { TeamMemberCard } from './TeamMemberCard'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface TeamMember {
  id: string
  name: string
  title: string
  bio?: string
  email?: string
  phone?: string
  linkedin_url?: string
  headshot_url?: string
  display_order: number
}

interface TeamManagementProps {
  agencyId: string
  initialTeamMembers?: TeamMember[]
}

function SortableTeamMemberCard({ member, onEdit, onDelete, isMobile, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  member: TeamMember
  onEdit: () => void
  onDelete: () => void
  isMobile: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      <Card className={`${isDragging ? 'shadow-lg' : ''} transition-shadow`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Drag Handle (Desktop) */}
            {!isMobile && (
              <div 
                {...listeners} 
                {...attributes}
                className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing mt-2"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}

            {/* Headshot */}
            <div className="flex-shrink-0">
              {member.headshot_url ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={member.headshot_url}
                    alt={`${member.name} headshot`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Member Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">
                {member.name}
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                {member.title}
              </p>
              
              {member.bio && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {member.bio}
                </p>
              )}
              
              {/* Contact Info */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="hover:text-primary transition-colors"
                    title="Send email"
                  >
                    <Mail className="h-3 w-3" />
                  </a>
                )}
                {member.phone && (
                  <a
                    href={`tel:${member.phone}`}
                    className="hover:text-primary transition-colors"
                    title="Call"
                  >
                    <Phone className="h-3 w-3" />
                  </a>
                )}
                {member.linkedin_url && (
                  <a
                    href={member.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                    title="View LinkedIn"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Mobile reorder buttons */}
              {isMobile && (
                <div className="flex flex-col gap-1 mr-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={onMoveUp}
                    disabled={!canMoveUp}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={onMoveDown}
                    disabled={!canMoveDown}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function TeamManagement({ agencyId, initialTeamMembers = [] }: TeamManagementProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch(`/api/agencies/${agencyId}/team`)
      if (response.ok) {
        const result = await response.json()
        setTeamMembers(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    // Work with the sorted array that's being displayed
    const sortedMembers = [...teamMembers].sort((a, b) => a.display_order - b.display_order)
    const oldIndex = sortedMembers.findIndex(member => member.id === active.id)
    const newIndex = sortedMembers.findIndex(member => member.id === over.id)

    // Reorder the array
    const newTeamMembers = arrayMove(sortedMembers, oldIndex, newIndex)
    
    // Update display_order for all members based on new positions
    const updatedMembers = newTeamMembers.map((member, index) => ({
      ...member,
      display_order: index
    }))
    
    // Update state immediately for instant UI feedback
    setTeamMembers(updatedMembers)

    // Update server
    try {
      const reorderedIds = updatedMembers.map(member => member.id)
      const response = await fetch(`/api/agencies/${agencyId}/team/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teamMemberIds: reorderedIds }),
      })

      if (!response.ok) {
        throw new Error('Failed to update order')
      }

      toast.success('Team member order updated')
    } catch (error) {
      toast.error('Failed to update order')
      // Revert the change
      fetchTeamMembers()
    }
  }

  const updateOrder = async (newTeamMembers: TeamMember[]) => {
    try {
      const reorderedIds = newTeamMembers.map(member => member.id)
      const response = await fetch(`/api/agencies/${agencyId}/team/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teamMemberIds: reorderedIds }),
      })
      if (!response.ok) {
        throw new Error('Failed to update order')
      }
      toast.success('Team member order updated')
    } catch (error) {
      toast.error('Failed to update order')
      // Revert the change
      fetchTeamMembers()
    }
  }

  const handleMoveUp = async (memberId: string) => {
    const currentMembers = [...teamMembers].sort((a, b) => a.display_order - b.display_order)
    const memberIndex = currentMembers.findIndex(m => m.id === memberId)
    if (memberIndex <= 0) return // Can't move up if already at top
    
    // Swap with previous member
    const newTeamMembers = [...currentMembers]
    const temp = newTeamMembers[memberIndex]
    newTeamMembers[memberIndex] = newTeamMembers[memberIndex - 1]
    newTeamMembers[memberIndex - 1] = temp
    
    // Update display_order for all members
    const updatedMembers = newTeamMembers.map((member, index) => ({
      ...member,
      display_order: index
    }))
    
    setTeamMembers(updatedMembers)
    await updateOrder(updatedMembers)
  }

  const handleMoveDown = async (memberId: string) => {
    const currentMembers = [...teamMembers].sort((a, b) => a.display_order - b.display_order)
    const memberIndex = currentMembers.findIndex(m => m.id === memberId)
    if (memberIndex >= currentMembers.length - 1) return // Can't move down if already at bottom
    
    // Swap with next member
    const newTeamMembers = [...currentMembers]
    const temp = newTeamMembers[memberIndex]
    newTeamMembers[memberIndex] = newTeamMembers[memberIndex + 1]
    newTeamMembers[memberIndex + 1] = temp
    
    // Update display_order for all members
    const updatedMembers = newTeamMembers.map((member, index) => ({
      ...member,
      display_order: index
    }))
    
    setTeamMembers(updatedMembers)
    await updateOrder(updatedMembers)
  }

  const handleDelete = async (member: TeamMember) => {
    if (!member) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/agencies/${agencyId}/team/${member.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete team member')
      }

      toast.success('Team member deleted successfully')
      fetchTeamMembers()
    } catch (error) {
      toast.error('Failed to delete team member')
    } finally {
      setIsLoading(false)
      setDeletingMember(null)
    }
  }

  const handleFormSuccess = () => {
    fetchTeamMembers()
    setEditingMember(null)
  }

  const sortedTeamMembers = [...teamMembers].sort((a, b) => a.display_order - b.display_order)

  return (
    <>
      <div>
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Our Team ({teamMembers.length})
            </h3>
            <Button onClick={() => setIsFormOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>
        <div>
          {sortedTeamMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No team members yet</h3>
              <p className="text-muted-foreground mb-4">
                Add team members to showcase your agency&apos;s expertise
              </p>
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Team Member
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {isMobile ? (
                // Mobile: Simple list without drag-drop using new design
                <div className="space-y-4">
                  {sortedTeamMembers.map((member, index) => (
                    <TeamMemberCard
                      key={member.id}
                      member={member}
                      isMobile={true}
                      onMoveUp={() => handleMoveUp(member.id)}
                      onMoveDown={() => handleMoveDown(member.id)}
                      canMoveUp={index > 0}
                      canMoveDown={index < sortedTeamMembers.length - 1}
                      isEdit={true}
                      onEdit={() => setEditingMember(member)}
                      onDelete={() => setDeletingMember(member)}
                    />
                  ))}
                </div>
              ) : (
                // Desktop: Draggable list
                <DndContext
                  sensors={sensors}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sortedTeamMembers.map(m => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {sortedTeamMembers.map((member) => (
                        <SortableTeamMemberCard
                          key={member.id}
                          member={member}
                          onEdit={() => setEditingMember(member)}
                          onDelete={() => setDeletingMember(member)}
                          isMobile={false}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      <TeamMemberForm
        agencyId={agencyId}
        member={editingMember}
        open={isFormOpen || !!editingMember}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) setEditingMember(null)
        }}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMember} onOpenChange={() => setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingMember?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMember && handleDelete(deletingMember)}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}