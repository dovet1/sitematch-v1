'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Building2, 
  FileText, 
  Link as LinkIcon, 
  ExternalLink, 
  Edit,
  Info,
  Loader2
} from 'lucide-react'
import { AgencyLinking } from '@/components/listings/agency-linking'
import { createClientClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

interface Listing {
  id: string
  company_name: string
  title?: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  created_at: string
  linked_agency_id?: string
  linked_agency?: {
    id: string
    name: string
    classification?: string
    logo_url?: string
    status: string
  }
}

export default function ListingsAgenciesPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchListings()
    }
  }, [user])

  const fetchListings = async () => {
    try {
      const supabase = createClientClient()
      const { data: listings, error } = await supabase
        .from('listings')
        .select(`
          id,
          company_name,
          title,
          status,
          created_at,
          linked_agency_id,
          agencies!linked_agency_id (
            id,
            name,
            classification,
            logo_url,
            status
          )
        `)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform the data to match our interface
      const transformedListings = (listings || []).map(listing => ({
        ...listing,
        linked_agency: Array.isArray(listing.agencies) && listing.agencies.length > 0 
          ? listing.agencies[0] 
          : null
      })) as Listing[]

      setListings(transformedListings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAgencyLinked = (listingId: string, agency: any) => {
    setListings(prev => 
      prev.map(listing => 
        listing.id === listingId 
          ? { ...listing, linked_agency: agency, linked_agency_id: agency?.id }
          : listing
      )
    )
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-b from-primary-50/30 to-background">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
              <Link href="/occupier/dashboard" className="hover:text-foreground">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-foreground">Agency Linking</span>
            </nav>
            
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Link Agencies to Your Listings
            </h1>
            <p className="text-muted-foreground">
              Connect your property listings to agencies for visibility and attribution
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {listings.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No listings found</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first listing to start linking agencies
                </p>
                <Button asChild>
                  <Link href="/occupier/create-listing-quick">
                    Create Your First Listing
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Info Alert */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Link your listings to agencies to give them visibility and attribution. 
                  You can link to approved agencies or your own agency profile.
                </AlertDescription>
              </Alert>

              {/* Listings */}
              <div className="grid gap-6">
                {listings.map((listing) => (
                  <Card key={listing.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {listing.title || listing.company_name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge 
                              variant="secondary"
                              className={getStatusBadgeColor(listing.status)}
                            >
                              {listing.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Created {new Date(listing.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/occupier/listing/${listing.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Listing
                            </Link>
                          </Button>
                          
                          {listing.status === 'approved' && (
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/occupier/listing/${listing.id}/preview`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Public
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <AgencyLinking
                        listingId={listing.id}
                        currentAgency={listing.linked_agency}
                        onAgencyLinked={(agency) => handleAgencyLinked(listing.id, agency)}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}