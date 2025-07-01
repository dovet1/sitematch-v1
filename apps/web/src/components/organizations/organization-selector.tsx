'use client'

import { useState, useEffect } from 'react'
import { Building2, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/auth-context'
import { DbOrganisation } from '@/types/auth'
import { createOrganizationService } from '@/lib/organizations'

interface OrganizationSelectorProps {
  onOrganizationChange?: (org: DbOrganisation | null) => void
  className?: string
}

export function OrganizationSelector({ onOrganizationChange, className }: OrganizationSelectorProps) {
  const { profile, refresh } = useAuth()
  const [organizations, setOrganizations] = useState<DbOrganisation[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    if (!profile?.org_id) return

    setLoading(true)
    try {
      const orgService = createOrganizationService()
      const userOrgs = await orgService.getUserOrganizations(profile.id)
      setOrganizations(userOrgs)
    } catch (error) {
      console.error('Error loading organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOrganizationSelect = async (org: DbOrganisation) => {
    try {
      const orgService = createOrganizationService()
      await orgService.assignUserToOrganization(profile!.id, org.id)
      await refresh()
      onOrganizationChange?.(org)
      setOpen(false)
    } catch (error) {
      console.error('Error switching organization:', error)
    }
  }

  if (!profile?.organisation) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Building2 className="h-4 w-4 mr-2" />
          {profile.organisation.name}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Switch Organization</DialogTitle>
          <DialogDescription>
            Select the organization you want to work with.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2">
          {organizations.map((org) => (
            <Button
              key={org.id}
              variant={org.id === profile.organisation?.id ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleOrganizationSelect(org)}
              disabled={loading}
            >
              <Building2 className="h-4 w-4 mr-2" />
              <div className="flex-1 text-left">
                <div className="font-medium">{org.name}</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {org.type}
                </div>
              </div>
              {org.id === profile.organisation?.id && (
                <Check className="h-4 w-4 ml-2" />
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}