'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Loader2, MapPin, Search, Ruler, BarChart3, MoreVertical, Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { SiteCreationModal } from './site-creation-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface Site {
  id: string;
  name: string;
  address: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  attachment_counts: {
    searches: number;
    sketches: number;
    analyses: number;
  };
}

interface SitesTabProps {
  userId: string;
}

export function SitesTab({ userId }: SitesTabProps) {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);

  useEffect(() => {
    fetchSites();
  }, [userId]);

  const fetchSites = async () => {
    try {
      const response = await fetch('/api/sites');
      if (!response.ok) throw new Error('Failed to fetch sites');

      const data = await response.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = async () => {
    await fetchSites();
    setShowCreateModal(false);
    setEditingSite(null);
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setShowCreateModal(true);
  };

  const handleDeleteClick = (siteId: string) => {
    setDeletingSiteId(siteId);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSiteId) return;

    try {
      const response = await fetch(`/api/sites/${deletingSiteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete site');

      toast.success('Site deleted successfully');
      await fetchSites();
    } catch (error) {
      console.error('Error deleting site:', error);
      toast.error('Failed to delete site');
    } finally {
      setDeletingSiteId(null);
    }
  };

  const handleViewDetails = (site: Site) => {
    router.push(`/new-dashboard/sites/${site.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900">Your Sites</h1>
            <p className="text-gray-600 mt-1 sm:mt-2 text-base sm:text-lg font-medium">
              Organise your searches, sketches, and analyses by location
            </p>
          </div>
          {sites.length > 0 && (
            <Button
              className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg font-bold rounded-xl px-6 py-5 sm:py-3"
              onClick={() => {
                setEditingSite(null);
                setShowCreateModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Site
            </Button>
          )}
        </div>

        {/* Empty State */}
        {sites.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border-3 border-violet-200 shadow-xl p-8 sm:p-12">
            <div className="max-w-2xl mx-auto text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Building2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">No Sites Created Yet</h2>
              <p className="text-base sm:text-lg text-gray-600 font-medium mb-8">
                Create sites to organise your saved searches, sketches, and location analyses in one place.
              </p>
              <Button
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg font-bold rounded-xl px-8 py-6 text-lg"
                onClick={() => {
                  setEditingSite(null);
                  setShowCreateModal(true);
                }}
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Site
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {sites.map((site) => (
                <div
                  key={site.id}
                  className="bg-white rounded-2xl border-3 border-violet-200 p-5 shadow-lg"
                >
                  <div className="space-y-3">
                    {/* Site Name */}
                    <div>
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Site Name</p>
                      <p className="text-base font-bold text-gray-900">{site.name}</p>
                    </div>

                    {/* Address */}
                    <div>
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Address</p>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-violet-600" />
                        <p className="text-sm text-gray-600 font-medium break-words">{site.address}</p>
                      </div>
                    </div>

                    {/* Description */}
                    {site.description && (
                      <div>
                        <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Description</p>
                        <p className="text-sm text-gray-600">{site.description}</p>
                      </div>
                    )}

                    {/* Attachment Counts */}
                    <div>
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-2">Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-300 font-bold">
                          <Search className="h-3 w-3 mr-1" />
                          {site.attachment_counts.searches} Searches
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 font-bold">
                          <Ruler className="h-3 w-3 mr-1" />
                          {site.attachment_counts.sketches} Sketches
                        </Badge>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-300 font-bold">
                          <BarChart3 className="h-3 w-3 mr-1" />
                          {site.attachment_counts.analyses} Analyses
                        </Badge>
                      </div>
                    </div>

                    {/* Created Date */}
                    <div>
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Created</p>
                      <p className="text-sm text-gray-600 font-medium">
                        {new Date(site.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t-2 border-violet-100">
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-2">Actions</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(site)}
                          className="flex-1 text-violet-600 border-violet-300 hover:bg-violet-50 font-bold rounded-lg"
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(site)}
                          className="flex-1 border-gray-300 hover:bg-gray-50 font-bold rounded-lg"
                        >
                          <Pencil className="h-4 w-4 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(site.id)}
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
                    <TableHead className="font-black text-violet-600 uppercase tracking-wide">Site Name</TableHead>
                    <TableHead className="font-black text-violet-600 uppercase tracking-wide">Address</TableHead>
                    <TableHead className="font-black text-violet-600 uppercase tracking-wide text-center">Searches</TableHead>
                    <TableHead className="font-black text-violet-600 uppercase tracking-wide text-center">Sketches</TableHead>
                    <TableHead className="font-black text-violet-600 uppercase tracking-wide text-center">Analyses</TableHead>
                    <TableHead className="font-black text-violet-600 uppercase tracking-wide">Created</TableHead>
                    <TableHead className="text-right font-black text-violet-600 uppercase tracking-wide">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((site) => (
                    <TableRow key={site.id} className="border-b border-violet-100">
                      <TableCell
                        className="font-bold text-gray-900 cursor-pointer hover:text-violet-600"
                        onClick={() => handleViewDetails(site)}
                      >
                        {site.name}
                      </TableCell>
                      <TableCell className="text-gray-600 font-medium max-w-xs truncate" title={site.address}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-violet-600 flex-shrink-0" />
                          <span className="truncate">{site.address}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-300 font-bold">
                          {site.attachment_counts.searches}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 font-bold">
                          {site.attachment_counts.sketches}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-300 font-bold">
                          {site.attachment_counts.analyses}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600 font-medium">
                        {new Date(site.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(site)}
                            className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 font-bold rounded-lg"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(site)}
                            className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold rounded-lg"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(site.id)}
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
      </div>

      {/* Create/Edit Modal */}
      <SiteCreationModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingSite(null);
        }}
        onSuccess={handleCreateSuccess}
        editingSite={editingSite}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingSiteId} onOpenChange={() => setDeletingSiteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink all attached resources (saved searches, sketches) but won't delete them.
              Location analyses attached to this site will be permanently deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
