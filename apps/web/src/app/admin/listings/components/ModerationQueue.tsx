'use client'

import { useState } from 'react'
import { ListingWithDetails, ListingStatus } from '@/types/listings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Eye, Edit, Archive, Trash2, Clock, CheckCircle, XCircle, ArchiveIcon, RefreshCw, Info } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ImmersiveListingModal } from '@/components/listings/ImmersiveListingModal'
import { RejectionModal } from './RejectionModal'
import { toast } from 'sonner'

interface ModerationQueueProps {
  listings: any[] // Using any for now until we have the full type
}

export function ModerationQueue({ listings: initialListings }: ModerationQueueProps) {
  const listings = initialListings // Store in local variable for use in callbacks
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [previewListingId, setPreviewListingId] = useState<string | null>(null)
  const [rejectionModal, setRejectionModal] = useState<{ listingId: string; companyName: string; versionId?: string } | null>(null)
  const router = useRouter()

  const handleStatusUpdate = async (listingId: string, status: 'approved' | 'rejected' | 'archived') => {
    setIsLoading(listingId)
    try {
      if (status === 'approved') {
        // Use the versioning system for approval
        const { approveListingAction } = await import('@/lib/actions/submit-listing-for-review')
        
        // Find the listing and get its latest pending review version
        const listing = listings.find(l => l.id === listingId)
        
        // Try to get version ID from the listing data first
        let versionId = listing?.pending_version_id || listing?.latest_version_id
        
        // If no version ID, we need to fetch the latest pending_review version
        if (!versionId) {
          try {
            const response = await fetch(`/api/listings/${listingId}/versions?status=pending_review&limit=1`)
            if (response.ok) {
              const versionsData = await response.json()
              if (versionsData.versions && versionsData.versions.length > 0) {
                versionId = versionsData.versions[0].id
              }
            }
          } catch (err) {
            console.error('Failed to fetch version:', err)
          }
        }
        
        if (versionId) {
          const result = await approveListingAction(listingId, versionId)
          if (result.success) {
            toast.success('Listing approved successfully')
            router.refresh()
          } else {
            toast.error(result.error || 'Failed to approve listing')
          }
        } else {
          toast.error('No pending review version found')
        }
      } else {
        // For archived status, use the existing API
        const requestBody: any = { status }
        
        const response = await fetch(`/api/listings/${listingId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (response.ok) {
          toast.success('Listing archived successfully')
          router.refresh()
        } else {
          toast.error('Failed to update listing status')
        }
      }
    } catch (error) {
      console.error('Error updating listing status:', error)
    } finally {
      setIsLoading(null)
    }
  }

  // Filter and sort listings
  const filteredAndSortedListings = listings
    .filter(listing => {
      let matchesStatus = false;
      
      if (filterStatus === 'all') {
        matchesStatus = true;
      } else if (filterStatus === 'rejected') {
        // Show recently rejected listings (status is 'draft' but has recent rejection)
        matchesStatus = listing.status === 'draft' && listing.is_recently_rejected;
      } else {
        matchesStatus = listing.status === filterStatus;
      }
      
      const matchesSearch = searchTerm === '' || 
        listing.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })
    .sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]
      
      if (sortField === 'created_at') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected (Last 7 days)</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={`${sortField}-${sortOrder}`} onValueChange={(value: string) => {
            const [field, order] = value.split('-')
            setSortField(field)
            setSortOrder(order as 'asc' | 'desc')
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Newest First</SelectItem>
              <SelectItem value="created_at-asc">Oldest First</SelectItem>
              <SelectItem value="company_name-asc">Company A-Z</SelectItem>
              <SelectItem value="company_name-desc">Company Z-A</SelectItem>
              <SelectItem value="status-asc">Status A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedListings.length} of {listings.length} listings
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedListings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No listings found matching your criteria
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedListings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {listing.company_name || 'Unnamed Company'}
                      {listing.is_resubmission && (
                        <Badge variant="outline" className="flex items-center gap-1 text-orange-600 border-orange-200">
                          <RefreshCw className="h-3 w-3" />
                          Resubmitted ({listing.rejection_count}x)
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={listing.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(listing.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit', 
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] truncate">
                      {listing.users?.email || listing.created_by?.slice(0, 8) + '...' || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* Preview Modal */}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setPreviewListingId(listing.id)}
                        title="Preview listing"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {listing.status === 'pending' && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-success hover:text-success"
                            onClick={() => handleStatusUpdate(listing.id, 'approved')}
                            disabled={isLoading === listing.id}
                            title="Approve listing"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRejectionModal({ 
                              listingId: listing.id, 
                              companyName: listing.company_name || 'Unnamed Company',
                              versionId: listing.pending_version_id
                            })}
                            disabled={isLoading === listing.id}
                            title="Reject listing"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(listing.status === 'approved' || listing.status === 'rejected') && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-muted-foreground"
                          onClick={() => handleStatusUpdate(listing.id, 'archived')}
                          disabled={isLoading === listing.id}
                          title="Archive listing"
                        >
                          <ArchiveIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Preview Modal */}
      {previewListingId && (
        <ImmersiveListingModal
          listingId={previewListingId}
          isOpen={true}
          onClose={() => setPreviewListingId(null)}
          // Use the admin API endpoint since admins need to see all data
          apiEndpoint={`/api/admin/listings/${previewListingId}/detailed`}
        />
      )}

      {/* Rejection Modal */}
      {rejectionModal && (
        <RejectionModal
          isOpen={true}
          onClose={() => setRejectionModal(null)}
          listingId={rejectionModal.listingId}
          companyName={rejectionModal.companyName}
          versionId={rejectionModal.versionId}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ListingStatus }) {
  const statusConfig = {
    pending: {
      color: 'bg-warning text-warning-foreground',
      icon: Clock,
      label: 'Under Review'
    },
    approved: {
      color: 'bg-success text-success-foreground',
      icon: CheckCircle,
      label: 'Published'
    },
    rejected: {
      color: 'bg-destructive text-destructive-foreground',
      icon: XCircle,
      label: 'Needs Changes'
    },
    archived: {
      color: 'bg-muted text-muted-foreground',
      icon: ArchiveIcon,
      label: 'Archived'
    },
    draft: {
      color: 'bg-muted text-muted-foreground',
      icon: Edit,
      label: 'Draft'
    }
  }

  const config = statusConfig[status] || statusConfig.draft
  const Icon = config.icon

  return (
    <Badge variant="secondary" className={`${config.color} flex items-center gap-1 w-fit`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}