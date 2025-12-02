'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Loader2, Trash2, Eye, Edit, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BrochureRow } from '@/types/brochure';

export default function BrochuresListPage() {
  const router = useRouter();
  const [brochures, setBrochures] = useState<BrochureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchBrochures();
  }, []);

  const fetchBrochures = async () => {
    try {
      const response = await fetch('/api/brochures');
      if (response.ok) {
        const data = await response.json();
        setBrochures(data);
      }
    } catch (error) {
      console.error('Failed to fetch brochures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brochure?')) return;

    setDeleting(id);
    try {
      const response = await fetch(`/api/brochures/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setBrochures((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete brochure:', error);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brochures</h1>
          <p className="text-gray-500 mt-1">
            Create and manage requirement brochures
          </p>
        </div>
        <Link href="/new-dashboard/brochures/new">
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="h-4 w-4 mr-2" />
            New Brochure
          </Button>
        </Link>
      </div>

      {/* Brochures Grid */}
      {brochures.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No brochures yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first brochure to generate professional PDF requirements documents.
          </p>
          <Link href="/new-dashboard/brochures/new">
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Brochure
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brochures.map((brochure) => (
            <Card
              key={brochure.id}
              className="p-4 hover:border-violet-300 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {brochure.company_name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {brochure.requirements_summary}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Updated {new Date(brochure.updated_at).toLocaleDateString()}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/new-dashboard/brochures/${brochure.id}`)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/new-dashboard/brochures/${brochure.id}/edit`)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(brochure.id)}
                      className="text-red-600"
                      disabled={deleting === brochure.id}
                    >
                      {deleting === brochure.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Quick action */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push(`/new-dashboard/brochures/${brochure.id}`)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Brochure
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
