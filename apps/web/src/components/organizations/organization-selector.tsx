'use client'

// Organizations are no longer used in this application
// This component is a stub to prevent build errors

interface OrganizationSelectorProps {
  onOrganizationChange?: (org: any) => void
  className?: string
}

export function OrganizationSelector({ onOrganizationChange, className }: OrganizationSelectorProps) {
  // Return null since organizations are no longer used
  return null
}