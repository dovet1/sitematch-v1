'use client';

import { useRouter } from 'next/navigation';
import { createClientClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, FileText, Clock, CheckCircle, AlertTriangle, Eye, Building2, TrendingUp, Users, MapPin, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '../components/StatusBadge';
import { AgencyCreationModal } from '@/components/agencies/agency-creation-modal';
import { AgencyModal } from '@/components/agencies/AgencyModal';
import { useState, useEffect } from 'react';
import type { User } from '@supabase/auth-js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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

export const dynamic = 'force-dynamic';

interface Listing {
  id: string;
  company_name: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  latest_version?: {
    status: string;
    review_notes?: string;
    version_number: number;
    reviewed_at?: string;
  };
}

interface Agency {
  id: string;
  name: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export default function OccupierDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requirements');
  const [showWelcomeTip, setShowWelcomeTip] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAgencyId, setPreviewAgencyId] = useState<string | null>(null);
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClientClient();
    
    const fetchData = async () => {
      // First check session to ensure we have fresh auth state
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Try to refresh the session
        const { data: { user: refreshedUser } } = await supabase.auth.getUser();
        
        if (!refreshedUser) {
          router.push('/?login=1');
          return;
        }
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/?login=1');
        return;
      }

      setUser(user);

      // Get user's agency
      const { data: userAgency, error: agencyError } = await supabase
        .from('agencies')
        .select('id, name, status, created_at, updated_at')
        .eq('created_by', user.id)
        .maybeSingle();

      if (userAgency && !agencyError) {
        setAgency(userAgency);
      }

      // Get user's listings
      const { data: listings, error } = await supabase
        .from('listings')
        .select('id, company_name, status, created_at, updated_at, rejection_reason')
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });

      // Get latest versions for each listing
      if (listings && listings.length > 0) {
        const listingIds = listings.map(l => l.id);
        const { data: versions } = await supabase
          .from('listing_versions')
          .select('listing_id, status, review_notes, version_number, reviewed_at')
          .in('listing_id', listingIds)
          .order('version_number', { ascending: false });

        // Attach latest version to each listing
        const listingsWithVersions = listings.map(listing => {
          const latestVersion = versions?.find(v => v.listing_id === listing.id);
          return {
            ...listing,
            latest_version: latestVersion ? {
              status: latestVersion.status,
              review_notes: latestVersion.review_notes,
              version_number: latestVersion.version_number,
              reviewed_at: latestVersion.reviewed_at
            } : undefined
          };
        });

        setListings(listingsWithVersions);
      } else {
        setListings(listings || []);
      }

      if (error) {
        console.error('Error fetching listings:', error);
      }
      
      setLoading(false);
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        fetchData();
      } else if (event === 'SIGNED_OUT') {
        router.push('/?login=1');
      }
    });

    // Initial fetch
    fetchData();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Delete listing handler
  const handleDeleteListing = async (listingId: string) => {
    if (!user) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/occupier/listings/${listingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete listing');
      }

      // Remove from local state
      setListings(listings.filter(l => l.id !== listingId));
      setListingToDelete(null);

      // Force a page refresh to ensure data is in sync
      router.refresh();
    } catch (error) {
      console.error('Error deleting listing:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete listing');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get status-specific content based on latest version
  const getStatusContent = (listing: Listing) => {
    // Use latest version status if available, otherwise fall back to listing status
    const currentStatus = listing.latest_version?.status || listing.status;
    
    switch (currentStatus) {
      case 'rejected':
        return {
          icon: AlertTriangle,
          iconColor: 'text-destructive',
          message: listing.latest_version?.review_notes || listing.rejection_reason || 'Changes requested',
          action: {
            label: 'Fix & Resubmit',
            href: `/occupier/listing/${listing.id}`,
            variant: 'destructive' as const
          }
        };
      case 'pending':
        return {
          icon: Clock,
          iconColor: 'text-amber-600',
          message: 'Under review',
          action: {
            label: 'Edit Listing',
            href: `/occupier/listing/${listing.id}`,
            variant: 'secondary' as const
          }
        };
      case 'pending_review':
        return {
          icon: Eye,
          iconColor: 'text-blue-600',
          message: 'Submitted for review',
          action: {
            label: 'View Submission',
            href: `/occupier/listing/${listing.id}`,
            variant: 'secondary' as const
          }
        };
      case 'approved':
        return {
          icon: CheckCircle,
          iconColor: 'text-emerald-600',
          message: 'Published',
          action: {
            label: 'View Listing',
            href: `/occupier/listing/${listing.id}`,
            variant: 'secondary' as const
          }
        };
      default:
        return {
          icon: FileText,
          iconColor: 'text-muted-foreground',
          message: 'Draft',
          action: {
            label: 'Continue Editing',
            href: `/occupier/listing/${listing.id}`,
            variant: 'outline' as const
          }
        };
    }
  };

  // Check if user has any rejected listings that need attention
  const hasRejectedListings = listings.some(l => (l.latest_version?.status || l.status) === 'rejected');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150" />
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-b from-primary-50/30 to-background">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="heading-3 sm:heading-2 text-foreground flex items-center gap-2">
                  Welcome back!
                </h1>
                <p className="body-base text-muted-foreground mt-1">
                  Manage your property requirements and agency profile
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Tip for New Users */}
          {showWelcomeTip && listings.length === 0 && !agency && (
            <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Welcome to Your Dashboard!</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Get started by creating your first property requirement or setting up your agency profile.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center text-xs">
                      <div className="inline-flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="whitespace-nowrap">Specify your location needs</span>
                      </div>
                      <div className="inline-flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                        <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="whitespace-nowrap">Promote your agency</span>
                      </div>
                      <div className="inline-flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                        <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="whitespace-nowrap">Increase deal flow</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowWelcomeTip(false)}
                    className="p-1 rounded-lg hover:bg-white/60 transition-colors"
                    aria-label="Dismiss tip"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabbed Interface for Better Content Organization */}
          <Tabs defaultValue="requirements" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 h-12">
              <TabsTrigger value="requirements" className="relative">
                <FileText className="w-4 h-4 mr-2" />
                Requirements
                {listings.length > 0 ? (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0 h-5 text-xs">
                    {listings.length}
                  </Badge>
                ) : (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                )}
                {hasRejectedListings && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </TabsTrigger>
              <TabsTrigger value="agency" className="relative">
                <Building2 className="w-4 h-4 mr-2" />
                Agency
                {agency ? (
                  <Badge variant={agency.status === 'approved' ? 'default' : 'outline'} className="ml-2 px-1.5 py-0 h-5 text-xs">
                    {agency.status === 'approved' ? '✓' : '!'}
                  </Badge>
                ) : (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </TabsTrigger>
            </TabsList>

            {/* Requirements Tab */}
            <TabsContent value="requirements" className="space-y-4">
              {/* Action Bar for Requirements */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Property Requirements</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {listings.length === 0 
                      ? 'Post your property needs to connect with agents'
                      : `${listings.length} active requirement${listings.length > 1 ? 's' : ''}`
                    }
                  </p>
                </div>
                {!hasRejectedListings && (
                  <Button 
                    asChild 
                    size="default"
                    className="violet-bloom-button violet-bloom-touch shadow-sm hover:shadow-md transition-all w-full sm:w-auto"
                  >
                    <Link href="/occupier/create-listing-quick">
                      <Plus className="w-4 h-4 mr-2" />
                      New Requirement
                    </Link>
                  </Button>
                )}
              </div>

              {listings.length === 0 ? (
                /* Empty State for Requirements */
                <Card className="violet-bloom-card border-dashed">
                  <CardContent className="p-8 sm:p-10 text-center">
                    <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-primary-500" />
                    </div>
                    <h3 className="heading-4 text-foreground mb-2">No Requirements Yet</h3>
                    <p className="body-base text-muted-foreground mb-6 max-w-sm mx-auto">
                      Post your first property requirement to start receiving proposals from agents.
                    </p>
                    <div className="space-y-4">
                      <Button asChild size="lg" className="violet-bloom-button violet-bloom-touch w-full sm:w-auto">
                        <Link href="/occupier/create-listing-quick">
                          <Plus className="w-5 h-5 mr-2" />
                          Create Your First Requirement
                        </Link>
                      </Button>
                      <div className="flex flex-col sm:flex-row gap-2 items-center justify-center text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Takes 2 minutes
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Instant visibility
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            ) : (
              <>
                <div className="space-y-4">
                  {listings.map((listing) => {
                  const statusContent = getStatusContent(listing);
                  const StatusIcon = statusContent.icon;
                  
                  return (
                    <Card 
                      key={listing.id} 
                      className={`group relative overflow-hidden border border-border/60 bg-gradient-to-br from-card via-card to-card/95 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-border/80 hover:scale-[1.01] ${
                        (listing.latest_version?.status || listing.status) === 'rejected' ? 'border-destructive/20 bg-gradient-to-br from-destructive/5 via-card to-card' : ''
                      }`}
                    >
                      {/* Premium gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <CardContent className="relative p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          {/* Left Side - Listing Info */}
                          <div className="flex items-start gap-4 flex-1">
                            {/* Premium Status Avatar */}
                            <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-black/5 transition-all duration-200 group-hover:shadow-md ${
                              (listing.latest_version?.status || listing.status) === 'approved' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50' :
                              (listing.latest_version?.status || listing.status) === 'pending' ? 'bg-gradient-to-br from-amber-50 to-amber-100/50' :
                              (listing.latest_version?.status || listing.status) === 'pending_review' ? 'bg-gradient-to-br from-blue-50 to-blue-100/50' :
                              (listing.latest_version?.status || listing.status) === 'rejected' ? 'bg-gradient-to-br from-red-50 to-red-100/50' :
                              'bg-gradient-to-br from-slate-50 to-slate-100/50'
                            }`}>
                              <StatusIcon className={`w-6 h-6 sm:w-7 sm:h-7 ${statusContent.iconColor} transition-transform duration-200 group-hover:scale-110`} />
                              
                              {/* Status indicator dot */}
                              <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-card shadow-sm ${
                                (listing.latest_version?.status || listing.status) === 'approved' ? 'bg-emerald-500' :
                                (listing.latest_version?.status || listing.status) === 'pending' ? 'bg-amber-500' :
                                (listing.latest_version?.status || listing.status) === 'pending_review' ? 'bg-blue-500' :
                                (listing.latest_version?.status || listing.status) === 'rejected' ? 'bg-red-500' :
                                'bg-slate-400'
                              }`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              {/* Company Name with enhanced typography */}
                              <h3 className="text-lg font-semibold text-foreground truncate mb-1.5 group-hover:text-primary transition-colors duration-200">
                                {listing.company_name}
                              </h3>
                              
                              {/* Premium Status Badge */}
                              <div className="flex items-center gap-2 mb-2">
                                <StatusBadge status={listing.latest_version?.status || listing.status} className="shadow-sm" />
                              </div>
                              
                              {/* Enhanced Rejection Feedback */}
                              {((listing.latest_version?.status || listing.status) === 'rejected') && (listing.latest_version?.review_notes || listing.rejection_reason) && (
                                <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50/80 border border-red-200/60 shadow-sm">
                                  <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <AlertTriangle className="w-3 h-3 text-red-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-red-900 mb-1.5 flex items-center gap-2">
                                        Action Required
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                          Rejected
                                        </span>
                                      </p>
                                      <p className="text-sm text-red-800/90 leading-relaxed">
                                        {listing.latest_version?.review_notes || listing.rejection_reason}
                                      </p>
                                      <div className="mt-2 flex items-center gap-1 text-xs text-red-700/80">
                                        <span>💡</span>
                                        <span>Review the feedback and resubmit when ready</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Enhanced Pending Review Feedback */}
                              {(listing.latest_version?.status === 'pending_review') && (
                                <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/80 border border-blue-200/60 shadow-sm">
                                  <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <Eye className="w-3 h-3 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-blue-900 mb-1.5 flex items-center gap-2">
                                        Under Review
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          Submitted
                                        </span>
                                      </p>
                                      <p className="text-sm text-blue-800/90 leading-relaxed">
                                        Your listing has been submitted and is awaiting admin review. You&apos;ll receive feedback shortly.
                                      </p>
                                      <div className="mt-2 flex items-center gap-1 text-xs text-blue-700/80">
                                        <span>⏱️</span>
                                        <span>We typically review submissions within 1-2 business days</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Enhanced Approved Feedback */}
                              {(listing.latest_version?.status === 'approved') && (
                                <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50/80 border border-emerald-200/60 shadow-sm">
                                  <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-emerald-900 mb-1.5 flex items-center gap-2">
                                        Published Successfully
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                          Live
                                        </span>
                                      </p>
                                      <p className="text-sm text-emerald-800/90 leading-relaxed">
                                        Your listing is now live and visible to agents.
                                      </p>
                                      <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700/80">
                                        <span>🚀</span>
                                        <span>Your listing is attracting potential matches</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Right Side - Premium Actions */}
                          <div className="flex items-center gap-2 ml-16 sm:ml-0">
                            {/* Delete Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setListingToDelete(listing.id)}
                              className="h-9 w-9 p-0 rounded-lg border border-border/60 bg-card/50 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive shadow-sm hover:shadow transition-all duration-200"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sr-only">Delete listing</span>
                            </Button>

                            {/* Enhanced Preview Button */}
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-lg border border-border/60 bg-card/50 hover:bg-card hover:border-border shadow-sm hover:shadow transition-all duration-200"
                            >
                              <Link href={`/occupier/listing/${listing.id}/preview`}>
                                <Eye className="w-4 h-4" />
                                <span className="sr-only">Preview listing</span>
                              </Link>
                            </Button>

                            {/* Enhanced Primary Action */}
                            <Button
                              asChild
                              variant={statusContent.action.variant}
                              size="sm"
                              className={`min-w-[100px] h-9 shadow-sm hover:shadow transition-all duration-200 font-medium ${
                                statusContent.action.variant === 'destructive' ? 'bg-gradient-to-r from-destructive to-destructive/90' :
                                statusContent.action.variant === 'secondary' ? 'bg-gradient-to-r from-secondary to-secondary/95 hover:from-secondary/90 hover:to-secondary/85' :
                                'bg-gradient-to-r from-muted to-muted/95 hover:from-muted/90 hover:to-muted/85'
                              }`}
                            >
                              <Link href={statusContent.action.href}>
                                {statusContent.action.label}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                </div>
              </>
            )}
            </TabsContent>

            {/* Agency Tab */}
            <TabsContent value="agency" className="space-y-4">
              {/* Action Bar for Agency */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Agency Profile</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {agency 
                      ? 'Manage your agency listing and visibility'
                      : 'Create your agency profile to showcase your services'
                    }
                  </p>
                </div>
                {!agency && (
                  <AgencyCreationModal>
                    <Button 
                      size="default"
                      className="violet-bloom-button violet-bloom-touch shadow-sm hover:shadow-md transition-all w-full sm:w-auto"
                    >
                      <Building2 className="w-4 h-4 mr-2" />
                      Create Agency
                    </Button>
                  </AgencyCreationModal>
                )}
              </div>

              {!agency ? (
                /* Empty State for Agency */
                <Card className="violet-bloom-card border-dashed">
                  <CardContent className="p-8 sm:p-10">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-primary-50 to-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-10 h-10 text-primary-500" />
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <h3 className="heading-4 text-foreground mb-2">No Agency Profile</h3>
                        <p className="body-base text-muted-foreground mb-4">
                          Create your agency profile to increase visibility and build trust with potential clients.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 bg-muted/50 rounded-full px-3 py-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Verified badge
                          </span>
                          <span className="flex items-center gap-1 bg-muted/50 rounded-full px-3 py-1">
                            <Eye className="w-3 h-3 text-blue-600" /> Public listing
                          </span>
                          <span className="flex items-center gap-1 bg-muted/50 rounded-full px-3 py-1">
                            <FileText className="w-3 h-3 text-purple-600" /> Contact details
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <AgencyCreationModal>
                          <Button size="lg" className="violet-bloom-button violet-bloom-touch w-full md:w-auto">
                            <Plus className="w-5 h-5 mr-2" />
                            Create Agency Profile
                          </Button>
                        </AgencyCreationModal>
                        <p className="text-xs text-center text-muted-foreground">
                          Takes 3 minutes
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                /* Agency Card */
                <Card className="overflow-hidden">
                  <div className="h-24 bg-gradient-to-r from-primary-100 via-primary-50 to-purple-50" />
                  <CardContent className="p-6 -mt-12">
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="w-20 h-20 bg-white rounded-xl shadow-md border-4 border-white flex items-center justify-center">
                        <Building2 className="w-10 h-10 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-bold text-foreground mb-1">{agency.name}</h3>
                            <div className="flex items-center gap-2 mb-3">
                              <StatusBadge status={agency.status} className="shadow-sm" />
                              <span className="text-sm text-muted-foreground">
                                Created {formatDate(agency.created_at)}
                              </span>
                            </div>
                            {agency.status === 'approved' && (
                              <div className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                <CheckCircle className="w-3 h-3" />
                                Verified agency profile
                              </div>
                            )}
                            {agency.status === 'pending' && (
                              <div className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                <Clock className="w-3 h-3" />
                                Under review - typically takes 24 hours
                              </div>
                            )}
                            {agency.status === 'rejected' && (
                              <div className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                Requires changes before approval
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreviewAgencyId(agency.id);
                                setShowPreview(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </Button>
                            <Button asChild size="sm">
                              <Link href={`/agencies/${agency.id}/edit`}>
                                Edit Profile
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Agency Preview Modal */}
      <AgencyModal
        agencyId={previewAgencyId}
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setPreviewAgencyId(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!listingToDelete} onOpenChange={(open) => !open && setListingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Listing?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone and will permanently remove the listing and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => listingToDelete && handleDeleteListing(listingToDelete)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}