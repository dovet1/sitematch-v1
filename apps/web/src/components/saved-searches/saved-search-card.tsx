'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, MapPin } from 'lucide-react';
import type { SavedSearchWithMatches } from '@/lib/saved-searches-types';
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
import { toast } from 'sonner';

interface SavedSearchCardProps {
  search: SavedSearchWithMatches;
  onEdit: (search: SavedSearchWithMatches) => void;
  onDelete: () => void;
}

export function SavedSearchCard({ search, onEdit, onDelete }: SavedSearchCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/saved-searches/${search.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete search');
      }

      toast.success('Search deleted successfully');
      onDelete();
    } catch (error) {
      console.error('Error deleting search:', error);
      toast.error('Failed to delete search');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Build criteria description
  const criteriaItems: string[] = [];

  if (search.listing_type) {
    criteriaItems.push(
      search.listing_type.charAt(0).toUpperCase() + search.listing_type.slice(1)
    );
  }

  if (search.location_address) {
    criteriaItems.push(
      `${search.location_address} (${search.location_radius_miles} mi)`
    );
  }

  if (search.sectors && search.sectors.length > 0) {
    criteriaItems.push(`${search.sectors.length} sector(s)`);
  }

  if (search.planning_use_classes && search.planning_use_classes.length > 0) {
    criteriaItems.push(`${search.planning_use_classes.length} use class(es)`);
  }

  if (search.min_size || search.max_size) {
    const sizeUnit = search.listing_type === 'residential' ? 'acres' : 'sq ft';
    if (search.min_size && search.max_size) {
      criteriaItems.push(`${search.min_size}-${search.max_size} ${sizeUnit}`);
    } else if (search.min_size) {
      criteriaItems.push(`${search.min_size}+ ${sizeUnit}`);
    } else if (search.max_size) {
      criteriaItems.push(`up to ${search.max_size} ${sizeUnit}`);
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-5 w-5 text-violet-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {search.name}
              </h3>
            </div>

            {criteriaItems.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {criteriaItems.map((item, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-violet-50 text-violet-700 border-violet-200"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            )}

            <div className="text-sm text-gray-600">
              <span className="font-medium text-violet-700">
                {search.match_count}
              </span>{' '}
              matching requirement{search.match_count !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(search)}
              className="border-gray-300 hover:bg-gray-50"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Search?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{search.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
