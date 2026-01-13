'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Search, ExternalLink, CheckCircle2, Calendar, X } from 'lucide-react'
import { formatVerificationDate, formatDateForInput, getTodayISOString } from '@/lib/utils/date-formatting'
import { updateListingVerificationDate, markListingVerifiedToday } from '@/lib/actions/verify-listing'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AllListingsTableProps {
  listings: any[]
}

type StatusFilter = 'all' | 'draft' | 'pending' | 'approved' | 'rejected' | 'archived'
type SortBy = 'company_name' | 'verified_at_newest' | 'verified_at_oldest' | 'unverified' | 'created_at'

export function AllListingsTable({ listings }: AllListingsTableProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('created_at')
  const [updatingListing, setUpdatingListing] = useState<string | null>(null)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)

  // Filter and sort listings
  const filteredAndSortedListings = useMemo(() => {
    let filtered = listings

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((listing) =>
        listing.company_name?.toLowerCase().includes(query)
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((listing) => listing.status === statusFilter)
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'company_name':
          return (a.company_name || '').localeCompare(b.company_name || '')
        case 'verified_at_newest':
          if (!a.verified_at && !b.verified_at) return 0
          if (!a.verified_at) return 1
          if (!b.verified_at) return -1
          return new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime()
        case 'verified_at_oldest':
          if (!a.verified_at && !b.verified_at) return 0
          if (!a.verified_at) return 1
          if (!b.verified_at) return -1
          return new Date(a.verified_at).getTime() - new Date(b.verified_at).getTime()
        case 'unverified':
          if (!a.verified_at && b.verified_at) return -1
          if (a.verified_at && !b.verified_at) return 1
          return 0
        case 'created_at':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return sorted
  }, [listings, searchQuery, statusFilter, sortBy])

  const handleDateChange = async (listingId: string, newDate: string) => {
    if (!newDate) return // Don't process empty dates

    setUpdatingListing(listingId)
    try {
      const isoDate = new Date(newDate).toISOString()
      const result = await updateListingVerificationDate(listingId, isoDate)

      if (result.success) {
        toast.success('Verification date updated')
        setOpenPopoverId(null) // Close popover after successful update
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update verification date')
      }
    } catch (error) {
      toast.error('Failed to update verification date')
    } finally {
      setUpdatingListing(null)
    }
  }

  const handleMarkVerifiedToday = async (listingId: string) => {
    setUpdatingListing(listingId)
    try {
      const result = await markListingVerifiedToday(listingId)

      if (result.success) {
        toast.success('Marked as verified today')
        setOpenPopoverId(null) // Close popover after successful update
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to mark as verified')
      }
    } catch (error) {
      toast.error('Failed to mark as verified')
    } finally {
      setUpdatingListing(null)
    }
  }

  const handleClearVerification = async (listingId: string) => {
    setUpdatingListing(listingId)
    try {
      const result = await updateListingVerificationDate(listingId, null)

      if (result.success) {
        toast.success('Verification date cleared')
        setOpenPopoverId(null) // Close popover after successful update
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to clear verification date')
      }
    } catch (error) {
      toast.error('Failed to clear verification date')
    } finally {
      setUpdatingListing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      archived: 'outline',
    }

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by company name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Recently Created</SelectItem>
            <SelectItem value="company_name">Company Name</SelectItem>
            <SelectItem value="verified_at_newest">Recently Verified</SelectItem>
            <SelectItem value="verified_at_oldest">Oldest Verified</SelectItem>
            <SelectItem value="unverified">Unverified First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedListings.length} of {listings.length} listings
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verification Date</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedListings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No listings found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedListings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {listing.company_name}
                      <Link
                        href={`/admin/listings/${listing.id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(listing.status)}</TableCell>
                  <TableCell>
                    <Popover
                      open={openPopoverId === listing.id}
                      onOpenChange={(open) => setOpenPopoverId(open ? listing.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full sm:w-[240px] justify-start text-left font-normal",
                            !listing.verified_at && "text-muted-foreground"
                          )}
                          disabled={updatingListing === listing.id}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {listing.verified_at ? (
                            <span className="flex items-center gap-2">
                              {formatVerificationDate(listing.verified_at)}
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                            </span>
                          ) : (
                            <span>Not verified</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-4"
                        align="start"
                        onInteractOutside={(e) => {
                          // Prevent closing when clicking inside the date input
                          const target = e.target as HTMLElement
                          if (target.closest('input[type="date"]')) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Verification Date</label>
                            <Input
                              type="date"
                              value={listing.verified_at ? formatDateForInput(listing.verified_at) : ''}
                              onChange={(e) => handleDateChange(listing.id, e.target.value)}
                              disabled={updatingListing === listing.id}
                              className="w-full"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleMarkVerifiedToday(listing.id)}
                              disabled={updatingListing === listing.id}
                              className="flex-1"
                            >
                              {updatingListing === listing.id ? (
                                <>
                                  <Calendar className="w-3 h-3 mr-1 animate-pulse" />
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Today
                                </>
                              )}
                            </Button>
                            {listing.verified_at && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleClearVerification(listing.id)}
                                disabled={updatingListing === listing.id}
                                className="flex-1"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/listings/${listing.id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="whitespace-nowrap"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
