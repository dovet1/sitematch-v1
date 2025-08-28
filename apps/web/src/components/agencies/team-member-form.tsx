'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ImageUpload } from '@/components/ui/image-upload'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface TeamMember {
  id?: string
  name: string
  title: string
  bio?: string
  email?: string
  phone?: string
  linkedin_url?: string
  headshot_url?: string
  display_order?: number
}

interface TeamMemberFormProps {
  agencyId: string
  member?: TeamMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface FormData {
  name: string
  title: string
  bio?: string
  email?: string
  phone?: string
  linkedin_url?: string
}

export function TeamMemberForm({
  agencyId,
  member,
  open,
  onOpenChange,
  onSuccess
}: TeamMemberFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [headshotUrl, setHeadshotUrl] = useState(member?.headshot_url || '')
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormData>({
    defaultValues: {
      name: member?.name || '',
      title: member?.title || '',
      bio: member?.bio || '',
      email: member?.email || '',
      phone: member?.phone || '',
      linkedin_url: member?.linkedin_url || '',
    }
  })

  // Reset form when member changes
  useEffect(() => {
    if (open) {
      reset({
        name: member?.name || '',
        title: member?.title || '',
        bio: member?.bio || '',
        email: member?.email || '',
        phone: member?.phone || '',
        linkedin_url: member?.linkedin_url || '',
      })
      setHeadshotUrl(member?.headshot_url || '')
    }
  }, [member, open, reset])

  const handleHeadshotUpload = async (file: File | null) => {
    if (!file) {
      setHeadshotUrl('')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'headshot') // Specify the file type for proper bucket routing

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Failed to upload headshot')
      }

      const result = await response.json()
      setHeadshotUrl(result.file.url) // Use the correct path from the response
      toast.success('Headshot uploaded successfully')
    } catch (err) {
      console.error('Headshot upload error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to upload headshot')
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    
    try {
      const payload = {
        ...data,
        headshot_url: headshotUrl || null,
      }

      const url = member 
        ? `/api/agencies/${agencyId}/team/${member.id}`
        : `/api/agencies/${agencyId}/team`
      
      const method = member ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save team member')
      }

      toast.success(member ? 'Team member updated successfully' : 'Team member added successfully')
      onSuccess()
      onOpenChange(false)
      reset()
      setHeadshotUrl('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    reset()
    setHeadshotUrl(member?.headshot_url || '')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {member ? 'Edit Team Member' : 'Add Team Member'}
          </DialogTitle>
          <DialogDescription>
            {member ? 'Update team member information.' : 'Add a new team member to your agency.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Headshot Upload */}
          <div className="space-y-2">
            <Label>Headshot</Label>
            <ImageUpload
              value={headshotUrl}
              onChange={handleHeadshotUpload}
              maxSize={5 * 1024 * 1024} // 5MB
              acceptedTypes={['image/png', 'image/jpeg', 'image/jpg']}
              placeholder="Upload team member headshot"
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              {...register('name', {
                required: 'Name is required',
                minLength: {
                  value: 2,
                  message: 'Name must be at least 2 characters'
                },
                maxLength: {
                  value: 100,
                  message: 'Name must be less than 100 characters'
                }
              })}
              placeholder="Enter full name"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title/Role *</Label>
            <Input
              id="title"
              {...register('title', {
                required: 'Title is required',
                maxLength: {
                  value: 100,
                  message: 'Title must be less than 100 characters'
                }
              })}
              placeholder="e.g., Senior Property Advisor"
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              {...register('bio', {
                maxLength: {
                  value: 1000,
                  message: 'Bio must be less than 1000 characters'
                }
              })}
              placeholder="Brief professional background and expertise..."
              className="min-h-[80px]"
              maxLength={1000}
            />
            {errors.bio && (
              <p className="text-sm text-red-500">{errors.bio.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email', {
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email format'
                }
              })}
              placeholder="professional@email.com"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              {...register('phone')}
              placeholder="+44 20 1234 5678"
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* LinkedIn */}
          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn URL</Label>
            <Input
              id="linkedin_url"
              type="url"
              {...register('linkedin_url', {
                pattern: {
                  value: /^https?:\/\/.+/,
                  message: 'Must be a valid URL starting with http:// or https://'
                }
              })}
              placeholder="https://linkedin.com/in/username"
            />
            {errors.linkedin_url && (
              <p className="text-sm text-red-500">{errors.linkedin_url.message}</p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {member ? 'Updating...' : 'Adding...'}
              </>
            ) : (
              member ? 'Update Member' : 'Add Member'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}