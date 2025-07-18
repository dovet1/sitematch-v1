'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, User, Building2, Users, Wrench, Home, TreePine, Calculator, Globe, MoreHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { UserType } from '@/types/auth'
import { useAuth } from '@/contexts/auth-context'
import { createClientClient } from '@/lib/supabase'

interface UserTypeFormData {
  userType: UserType
}

const userTypes: { value: UserType; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    value: 'Commercial Occupier', 
    label: 'Commercial Occupier', 
    description: 'Looking for office or retail space',
    icon: <Building2 className="h-4 w-4" />
  },
  { 
    value: 'Landlord/Vendor', 
    label: 'Landlord/Vendor', 
    description: 'Property owner or seller',
    icon: <Home className="h-4 w-4" />
  },
  { 
    value: 'Developer', 
    label: 'Developer', 
    description: 'Property developer',
    icon: <Wrench className="h-4 w-4" />
  },
  { 
    value: 'Housebuilder', 
    label: 'Housebuilder', 
    description: 'Residential developer',
    icon: <TreePine className="h-4 w-4" />
  },
  { 
    value: 'Consultant', 
    label: 'Consultant', 
    description: 'Property consultant or advisor',
    icon: <Calculator className="h-4 w-4" />
  },
  { 
    value: 'Government', 
    label: 'Government', 
    description: 'Government or public sector',
    icon: <Globe className="h-4 w-4" />
  },
  { 
    value: 'Other', 
    label: 'Other', 
    description: 'Other type of user',
    icon: <MoreHorizontal className="h-4 w-4" />
  },
]

export function UserTypeModal() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, profile, refresh } = useAuth()
  const supabase = createClientClient()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    clearErrors
  } = useForm<UserTypeFormData>()

  const selectedUserType = watch('userType')
  const selectedUserTypeData = userTypes.find(type => type.value === selectedUserType)

  // Check if user needs to select type
  useEffect(() => {
    const checkUserType = async () => {
      if (user && profile && !profile.user_type) {
        setOpen(true)
      }
      
      // Also check for pending user type from signup
      if (user && typeof window !== 'undefined') {
        const pendingUserType = sessionStorage.getItem('pendingUserType') as UserType
        if (pendingUserType) {
          // Auto-submit the user type
          await updateUserType(pendingUserType)
          sessionStorage.removeItem('pendingUserType')
        }
      }
    }
    
    checkUserType()
  }, [user, profile])

  const updateUserType = async (userType: UserType) => {
    if (!user) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ user_type: userType })
        .eq('id', user.id)
      
      if (updateError) throw updateError
      
      // Refresh the profile
      await refresh()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user type')
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: UserTypeFormData) => {
    await updateUserType(data.userType)
  }

  // Don't render if user already has a type
  if (profile?.user_type) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[500px]" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Help us personalize your experience
          </DialogTitle>
          <DialogDescription>
            This one-time selection helps us show you relevant properties and features
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="modal-user-type-select" className="text-base">Which best describes you?</Label>
            <Select
              value={selectedUserType}
              onValueChange={(value) => {
                setValue('userType', value as UserType)
                // Clear any existing error when user makes a selection
                if (errors.userType) {
                  clearErrors('userType')
                }
              }}
            >
              <SelectTrigger 
                id="modal-user-type-select"
                className="w-full h-12"
                aria-label="Select your user type"
              >
                <SelectValue placeholder="Choose your user type">
                  {selectedUserTypeData && (
                    <div className="flex items-center gap-2">
                      {selectedUserTypeData.icon}
                      <span>{selectedUserTypeData.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent 
                className="z-[10000] max-h-[300px]" 
                position="popper"
                side="bottom"
                align="start"
                sideOffset={4}
              >
                {userTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {type.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{type.label}</span>
                        <span className="text-sm text-muted-foreground">{type.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.userType && (
              <p className="text-sm text-red-500" role="alert">{errors.userType.message}</p>
            )}
          </div>
          
          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md" role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={isLoading || !selectedUserType}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}