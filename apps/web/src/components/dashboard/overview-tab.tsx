'use client';

import { useState, useEffect } from 'react';
import { createClientClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, FileText, Building2, Wrench, Search, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Listing {
  id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
}

interface OverviewTabProps {
  userId: string;
}

export function OverviewTab({ userId }: OverviewTabProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedSearchCount, setSavedSearchCount] = useState(0);

  useEffect(() => {
    fetchListings();
    fetchSavedSearchCount();
  }, [userId]);

  const fetchListings = async () => {
    try {
      const supabase = createClientClient();
      const { data, error} = await supabase
        .from('listings')
        .select('id, status')
        .eq('created_by', userId);

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedSearchCount = async () => {
    try {
      const response = await fetch('/api/saved-searches');
      if (response.ok) {
        const data = await response.json();
        setSavedSearchCount(data.searches?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching saved search count:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // Calculate requirement stats
  const requirementStats = {
    draft: listings.filter((l) => l.status === 'draft').length,
    pending: listings.filter((l) => l.status === 'pending').length,
    approved: listings.filter((l) => l.status === 'approved').length,
    rejected: listings.filter((l) => l.status === 'rejected').length,
    archived: listings.filter((l) => l.status === 'archived').length,
  };

  const totalRequirements = listings.length;
  const hasRequirements = totalRequirements > 0;
  const needsAttention = requirementStats.pending + requirementStats.rejected;

  // Assessed sites placeholder - will be replaced with real data
  const assessedSites = 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 mt-1">Your workspace at a glance</p>
      </div>

      {/* Hero CTA - Only show when no requirements */}
      {!hasRequirements && (
        <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl p-8 text-white shadow-xl">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-3">Welcome to SiteMatcher! 🎉</h2>
            <p className="text-violet-100 mb-6 text-lg">
              Post requirements or use our site assessment tools to get started.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/occupier/create-listing-quick">
                <Button size="lg" className="bg-white text-violet-700 hover:bg-gray-50 font-semibold shadow-lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Post a Requirement
                </Button>
              </Link>
              <Link href="/site-sketcher">
                <Button size="lg" variant="outline" className="bg-transparent border-2 border-white text-white hover:bg-white/10">
                  <Wrench className="h-5 w-5 mr-2" />
                  Use SiteSketcher
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Bar */}
      {hasRequirements && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Requirements Stat */}
          <button
            onClick={() => {
              const event = new CustomEvent('dashboard-tab-change', { detail: 'requirements' });
              window.dispatchEvent(event);
            }}
            className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-violet-300 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Requirements</p>
                <p className="text-3xl font-bold text-gray-900">{totalRequirements}</p>
              </div>
              <FileText className="h-8 w-8 text-violet-600 group-hover:text-violet-700" />
            </div>
          </button>

          {/* Saved Searches Stat */}
          <button
            onClick={() => {
              const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
              window.dispatchEvent(event);
            }}
            className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-violet-300 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Saved Searches</p>
                <p className="text-3xl font-bold text-gray-900">{savedSearchCount}</p>
              </div>
              <Search className="h-8 w-8 text-violet-600 group-hover:text-violet-700" />
            </div>
          </button>

          {/* Assessed Sites Stat */}
          <button
            onClick={() => {
              const event = new CustomEvent('dashboard-tab-change', { detail: 'sites' });
              window.dispatchEvent(event);
            }}
            className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-violet-300 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Assessed Sites</p>
                <p className="text-3xl font-bold text-gray-900">{assessedSites}</p>
              </div>
              <Building2 className="h-8 w-8 text-violet-600 group-hover:text-violet-700" />
            </div>
          </button>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requirements Column */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              <h2 className="text-lg font-semibold text-gray-900">Requirements</h2>
            </div>
            {hasRequirements && needsAttention > 0 && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                {needsAttention} need attention
              </Badge>
            )}
          </div>

          {hasRequirements ? (
            <div className="space-y-4">
              {/* Status Cards */}
              <div className="space-y-2">
                {requirementStats.approved > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-green-900">Approved</span>
                    <span className="text-xl font-bold text-green-700">{requirementStats.approved}</span>
                  </div>
                )}

                {requirementStats.pending > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-yellow-900 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Pending Review
                    </span>
                    <span className="text-xl font-bold text-yellow-700">{requirementStats.pending}</span>
                  </div>
                )}

                {requirementStats.draft > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Draft</span>
                    <span className="text-xl font-bold text-gray-700">{requirementStats.draft}</span>
                  </div>
                )}

                {requirementStats.rejected > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-red-900">Rejected</span>
                    <span className="text-xl font-bold text-red-700">{requirementStats.rejected}</span>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <Link href="/occupier/create-listing-quick">
                  <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    New Requirement
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={() => {
                    const event = new CustomEvent('dashboard-tab-change', { detail: 'requirements' });
                    window.dispatchEvent(event);
                  }}
                >
                  View All Requirements
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No requirements yet</h3>
              <p className="text-xs text-gray-500 mb-4">Post your first requirement</p>
              <Link href="/occupier/create-listing-quick">
                <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white">
                  <Plus className="h-3 w-3 mr-1" />
                  Post Requirement
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Site Assessment Tools Column */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Wrench className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900">Site Assessment Tools</h2>
          </div>

          <div className="space-y-4">
            {/* Tools List */}
            <div className="space-y-3">
              {/* SiteSketcher */}
              <Link href="/site-sketcher">
                <div className="border border-gray-200 rounded-lg p-4 hover:border-violet-300 hover:shadow-md transition-all group cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm group-hover:text-violet-700 transition-colors">
                        SiteSketcher
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Draw and measure site boundaries with aerial imagery
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-violet-600 transition-colors flex-shrink-0 ml-2" />
                  </div>
                </div>
              </Link>

              {/* Coming Soon Tools */}
              <div className="border border-gray-200 rounded-lg p-4 opacity-60">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      SiteAppraiser
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      AI-powered site valuation and market analysis
                    </p>
                    <p className="text-xs text-violet-600 mt-2 font-medium">Coming soon</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 opacity-60">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      SiteAnalyser
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Detailed demographic insights for your area
                    </p>
                    <p className="text-xs text-violet-600 mt-2 font-medium">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sites Assessed Count */}
            {assessedSites > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-violet-900">Sites Assessed</span>
                    <span className="text-2xl font-bold text-violet-700">{assessedSites}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-2 border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={() => {
                    const event = new CustomEvent('dashboard-tab-change', { detail: 'sites' });
                    window.dispatchEvent(event);
                  }}
                >
                  View Assessed Sites
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Searches Section - Full Width */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border border-violet-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Search className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Saved Searches</h2>
              <p className="text-sm text-gray-600">Get notified when requirements match your criteria</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-violet-200 text-violet-700">
            Coming Soon
          </Badge>
        </div>
      </div>
    </div>
  );
}
