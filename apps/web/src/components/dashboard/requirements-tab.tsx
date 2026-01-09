'use client';

import { useState, useEffect } from 'react';
import { createClientClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Eye, Pencil, Trash2, Plus, Loader2, Archive, ArchiveRestore } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Listing {
  id: string;
  company_name: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
  created_at: string;
  updated_at: string;
}

interface RequirementsTabProps {
  userId: string;
}

const statusConfig = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
};

export function RequirementsTab({ userId }: RequirementsTabProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteListingId, setDeleteListingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [archivingListingId, setArchivingListingId] = useState<string | null>(null);

  useEffect(() => {
    fetchListings();
  }, [userId, activeTab]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const supabase = createClientClient();

      let query = supabase
        .from('listings')
        .select('id, company_name, status, created_at, updated_at')
        .eq('created_by', userId);

      // Filter by tab
      if (activeTab === 'active') {
        query = query.neq('status', 'archived');
      } else {
        query = query.eq('status', 'archived');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteListingId) return;

    setIsDeleting(true);
    try {
      const supabase = createClientClient();
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', deleteListingId);

      if (error) throw error;

      toast.success('Listing deleted successfully');
      setListings(listings.filter((l) => l.id !== deleteListingId));
      setDeleteListingId(null);
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast.error('Failed to delete listing');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveToggle = async (listingId: string, isArchived: boolean) => {
    setArchivingListingId(listingId);
    try {
      const response = await fetch(`/api/listings/${listingId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: !isArchived }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update listing');
      }

      toast.success(result.message);
      // Refresh listings
      await fetchListings();
    } catch (error) {
      console.error('Error toggling archive:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update listing');
    } finally {
      setArchivingListingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900">Your Requirements</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-base sm:text-lg font-medium">Manage your property requirement listings</p>
        </div>
        <Link href="/occupier/create-listing-quick" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg font-bold rounded-xl px-6 py-5 sm:py-3">
            <Plus className="h-4 w-4 mr-2" />
            New Requirement
          </Button>
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b-2 border-violet-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-3 font-bold rounded-t-lg transition-all ${
            activeTab === 'active'
              ? 'bg-violet-600 text-white'
              : 'text-gray-600 hover:text-violet-600 hover:bg-violet-50'
          }`}
        >
          Active Listings
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`px-6 py-3 font-bold rounded-t-lg transition-all ${
            activeTab === 'archived'
              ? 'bg-violet-600 text-white'
              : 'text-gray-600 hover:text-violet-600 hover:bg-violet-50'
          }`}
        >
          Archived
        </button>
      </div>

      {/* Requirements List */}
      {listings.length === 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl border-3 border-violet-200 shadow-xl text-center py-12 px-6">
          <p className="text-gray-500 mb-4 text-base sm:text-lg">
            {activeTab === 'active' ? 'No active requirements' : 'No archived requirements'}
          </p>
          {activeTab === 'active' && (
            <Link href="/occupier/create-listing-quick">
              <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                Create your first requirement
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white rounded-2xl border-3 border-violet-200 p-5 shadow-lg"
              >
                <div className="space-y-3">
                  {/* Company Name */}
                  <div>
                    <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Company</p>
                    <p className="text-base font-bold text-gray-900">{listing.company_name}</p>
                  </div>

                  {/* Status & Date */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Status</p>
                      <Badge variant="secondary" className={`${statusConfig[listing.status].className} font-bold`}>
                        {statusConfig[listing.status].label}
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Created</p>
                      <p className="text-sm text-gray-600 font-medium">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t-2 border-violet-100">
                    <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-2">Actions</p>
                    <div className="flex items-center gap-2">
                      <Link href={`/occupier/listing/${listing.id}/preview`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-violet-600 border-violet-300 hover:bg-violet-50 font-bold rounded-lg"
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          View
                        </Button>
                      </Link>
                      <Link href={`/occupier/listing/${listing.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-gray-300 hover:bg-gray-50 font-bold rounded-lg"
                        >
                          <Pencil className="h-4 w-4 mr-1.5" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchiveToggle(listing.id, listing.status === 'archived')}
                        disabled={archivingListingId === listing.id}
                        className={`font-bold rounded-lg px-3 ${
                          listing.status === 'archived'
                            ? 'border-blue-300 text-blue-600 hover:bg-blue-50'
                            : 'border-orange-300 text-orange-600 hover:bg-orange-50'
                        }`}
                      >
                        {archivingListingId === listing.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : listing.status === 'archived' ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteListingId(listing.id)}
                        className="border-red-300 text-red-600 hover:bg-red-50 font-bold rounded-lg px-3"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-3xl border-3 border-violet-200 shadow-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-violet-200">
                  <TableHead className="font-black text-violet-600 uppercase tracking-wide">Company Name</TableHead>
                  <TableHead className="font-black text-violet-600 uppercase tracking-wide">Status</TableHead>
                  <TableHead className="font-black text-violet-600 uppercase tracking-wide">Created</TableHead>
                  <TableHead className="text-right font-black text-violet-600 uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => (
                  <TableRow key={listing.id} className="border-b border-violet-100">
                    <TableCell className="font-bold text-gray-900">{listing.company_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${statusConfig[listing.status].className} font-bold`}>
                        {statusConfig[listing.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 font-medium">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/occupier/listing/${listing.id}/preview`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 font-bold rounded-lg"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/occupier/listing/${listing.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold rounded-lg"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiveToggle(listing.id, listing.status === 'archived')}
                          disabled={archivingListingId === listing.id}
                          className={`font-bold rounded-lg ${
                            listing.status === 'archived'
                              ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                              : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                          }`}
                          title={listing.status === 'archived' ? 'Unarchive listing' : 'Archive listing'}
                        >
                          {archivingListingId === listing.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : listing.status === 'archived' ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteListingId(listing.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteListingId} onOpenChange={() => setDeleteListingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requirement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this requirement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
