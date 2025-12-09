'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Loader2, MapPin, Search, Ruler, BarChart3, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SiteCreationModal } from './site-creation-modal';
import { SiteDetailView } from './site-detail-view';
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
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
  const [viewingSite, setViewingSite] = useState<{ id: string; name: string } | null>(null);

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
    setViewingSite({ id: site.id, name: site.name });
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
              Organize your searches, sketches, and analyses by location
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
                Create sites to organize your saved searches, sketches, and demographic analyses in one place.
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
          /* Sites Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {sites.map((site) => (
              <div
                key={site.id}
                className="bg-white rounded-2xl border-3 border-violet-200 shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5 sm:p-6 border-b-2 border-violet-100">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex-1 break-words">
                      {site.name}
                    </h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-violet-50"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(site)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(site.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-start gap-2 text-sm text-gray-600 mb-3">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-violet-600" />
                    <span className="break-words">{site.address}</span>
                  </div>

                  {site.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {site.description}
                    </p>
                  )}
                </div>

                {/* Attachment Summary */}
                <div className="p-5 sm:p-6 bg-gradient-to-br from-violet-50/50 to-purple-50/50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Search className="h-4 w-4 text-violet-600" />
                        <span className="font-medium">Saved Searches</span>
                      </div>
                      <span className="font-bold text-violet-600">
                        {site.attachment_counts.searches}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Ruler className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Sketches</span>
                      </div>
                      <span className="font-bold text-blue-600">
                        {site.attachment_counts.sketches}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <BarChart3 className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">Analyses</span>
                      </div>
                      <span className="font-bold text-purple-600">
                        {site.attachment_counts.analyses}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full mt-4 bg-white border-2 border-violet-200 hover:bg-violet-50 text-violet-700 font-bold rounded-xl"
                    onClick={() => handleViewDetails(site)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
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

      {/* Site Detail View Modal */}
      {viewingSite && (
        <SiteDetailView
          siteId={viewingSite.id}
          siteName={viewingSite.name}
          open={!!viewingSite}
          onClose={() => setViewingSite(null)}
          onUpdate={fetchSites}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingSiteId} onOpenChange={() => setDeletingSiteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink all attached resources (saved searches, sketches) but won't delete them.
              Demographic analyses attached to this site will be permanently deleted.
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
