'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Building2, Loader2, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AgencyFormData {
  name: string
  contact_email: string
  contact_phone: string
}

interface AgencyCreationModalProps {
  children?: React.ReactNode
  isOpen?: boolean
  onClose?: () => void
  onSuccess?: () => void
}

export function AgencyCreationModal({ children, isOpen, onClose, onSuccess }: AgencyCreationModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onClose !== undefined ? (value: boolean) => !value && onClose() : setInternalOpen
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<AgencyFormData>()

  const onSubmit = async (data: AgencyFormData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/agencies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create agency')
      }

      // Success - close modal
      setOpen(false)
      reset()

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess()
      } else {
        // Default behavior: navigate to edit view
        router.push(`/agencies/${result.data.agency.id}/edit`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      reset()
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create Agency
          </DialogTitle>
          <DialogDescription>
            Start by creating your agency with the essential details. You can enhance your profile later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agency-name">Agency Name</Label>
            <Input
              id="agency-name"
              type="text"
              placeholder="Enter your agency name"
              {...register('name', {
                required: 'Agency name is required',
                minLength: {
                  value: 2,
                  message: 'Agency name must be at least 2 characters'
                },
                maxLength: {
                  value: 100,
                  message: 'Agency name must be less than 100 characters'
                }
              })}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="agency-email">Contact Email</Label>
            <Input
              id="agency-email"
              type="email"
              placeholder="contact@youragency.com"
              {...register('contact_email', {
                required: 'Contact email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Please enter a valid email address'
                }
              })}
              disabled={isLoading}
            />
            {errors.contact_email && (
              <p className="text-sm text-red-500">{errors.contact_email.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="agency-phone">Contact Phone</Label>
            <Input
              id="agency-phone"
              type="tel"
              placeholder="+44 20 1234 5678"
              {...register('contact_phone', {
                required: 'Contact phone is required',
                pattern: {
                  value: /^[\+]?[1-9][\d]{0,15}$/,
                  message: 'Please enter a valid phone number'
                }
              })}
              disabled={isLoading}
            />
            {errors.contact_phone && (
              <p className="text-sm text-red-500">{errors.contact_phone.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +44 for UK, +1 for US)
            </p>
          </div>
          
          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating agency...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Agency
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            After creation, you'll be able to enhance your profile with additional details, 
            team members, and submit for approval.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}