'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { 
  Building2, 
  Link, 
  Search, 
  Check, 
  ChevronsUpDown, 
  X,
  ExternalLink,
  Loader2
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Agency {
  id: string
  name: string
  classification?: string
  geographic_patch?: string
  logo_url?: string
  status: string
}

interface LinkedAgency extends Agency {
  // Any additional fields for linked agencies
}

interface AgencyLinkingProps {
  listingId: string
  currentAgency?: LinkedAgency | null
  onAgencyLinked?: (agency: LinkedAgency | null) => void
}

export function AgencyLinking({ listingId, currentAgency, onAgencyLinked }: AgencyLinkingProps) {
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(currentAgency || null)

  const searchAgencies = async (query: string) => {
    if (!query.trim()) {
      setAgencies([])
      return
    }

    setIsSearching(true)
    try {
      const params = new URLSearchParams({ q: query })
      const response = await fetch(`/api/agencies/search?${params}`)
      
      if (response.ok) {
        const result = await response.json()
        setAgencies(result.data || [])
      } else {
        setAgencies([])
      }
    } catch (error) {
      console.error('Error searching agencies:', error)
      setAgencies([])
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      searchAgencies(searchQuery)
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchQuery])

  const linkAgency = async (agency: Agency | null) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/listings/${listingId}/agency`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkedAgencyId: agency?.id || null,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to update agency link')
      }

      setSelectedAgency(agency)
      onAgencyLinked?.(agency as LinkedAgency | null)
      toast.success(agency ? 'Agency linked successfully' : 'Agency link removed')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update agency link')
    } finally {
      setIsLoading(false)
    }
  }

  const getClassificationBadgeColor = (classification?: string) => {
    switch (classification) {
      case 'Commercial':
        return 'bg-blue-100 text-blue-800'
      case 'Residential':
        return 'bg-green-100 text-green-800'
      case 'Both':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Linked Agency
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedAgency ? (
          <div className="space-y-4">
            {/* Current Agency Display */}
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
              {selectedAgency.logo_url ? (
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <Image
                    src={selectedAgency.logo_url}
                    alt={`${selectedAgency.name} logo`}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-primary/70" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground truncate">
                  {selectedAgency.name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  {selectedAgency.classification && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getClassificationBadgeColor(selectedAgency.classification)}`}
                    >
                      {selectedAgency.classification}
                    </Badge>
                  )}
                  {selectedAgency.geographic_patch && (
                    <span className="text-xs text-muted-foreground truncate">
                      {selectedAgency.geographic_patch}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <a
                    href={`/agencies/${selectedAgency.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => linkAgency(null)}
                  disabled={isLoading}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setOpen(true)}
              disabled={isLoading}
              className="w-full"
            >
              Change Agency
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Link this listing to an agency to give them visibility and attribution
            </p>
            <Button onClick={() => setOpen(true)}>
              <Link className="h-4 w-4 mr-2" />
              Link Agency
            </Button>
          </div>
        )}
      </CardContent>

      {/* Agency Selection Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Link Agency</DialogTitle>
            <DialogDescription>
              Search and select an agency to link to this listing. You can link to approved agencies or your own agency.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Input */}
            <div className="space-y-2">
              <Label>Search Agencies</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search agency by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
                )}
              </div>
            </div>
            
            {/* Results */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {agencies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No agencies found' : 'Start typing to search agencies'}
                </div>
              ) : (
                agencies.map((agency) => (
                  <button
                    key={agency.id}
                    onClick={() => linkAgency(agency)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors text-left disabled:opacity-50"
                  >
                    {agency.logo_url ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <Image
                          src={agency.logo_url}
                          alt={`${agency.name} logo`}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-primary/70" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">
                        {agency.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        {agency.classification && (
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getClassificationBadgeColor(agency.classification)}`}
                          >
                            {agency.classification}
                          </Badge>
                        )}
                        {agency.status === 'draft' && (
                          <Badge variant="secondary" className="text-xs">
                            Your Agency
                          </Badge>
                        )}
                        {agency.geographic_patch && (
                          <span className="text-xs text-muted-foreground truncate">
                            {agency.geographic_patch}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isLoading && (
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}