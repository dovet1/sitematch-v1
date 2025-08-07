'use client';

import { useRouter } from 'next/navigation';
import { createClientClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, FileText, Clock, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '../components/StatusBadge';
import ConsultantProfileCard from '@/components/consultant/consultant-profile-card';
import { ImmersiveListingModal } from '@/components/listings/ImmersiveListingModal';
import { useState, useEffect } from 'react';
import type { User } from '@supabase/auth-js';

interface Listing {
  id: string;
  company_name: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
}

export default function OccupierDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewListingId, setPreviewListingId] = useState<string | null>(null);
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

      // Get user's listings
      const { data: listings, error } = await supabase
        .from('listings')
        .select('id, company_name, status, created_at, updated_at, rejection_reason')
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching listings:', error);
      } else {
        setListings(listings || []);
      }
      
      setLoading(false);
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
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

  // Get status-specific content
  const getStatusContent = (listing: Listing) => {
    switch (listing.status) {
      case 'rejected':
        return {
          icon: AlertTriangle,
          iconColor: 'text-destructive',
          message: listing.rejection_reason || 'Changes requested',
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
            label: 'View Details',
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
  const hasRejectedListings = listings.some(l => l.status === 'rejected');

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
                  {listings.length === 0 
                    ? 'Create your first property requirement'
                    : `${listings.length} property requirement${listings.length > 1 ? 's' : ''}`
                  }
                </p>
              </div>
              
              {!hasRejectedListings && (
                <Button 
                  asChild 
                  size="lg"
                  className="violet-bloom-button violet-bloom-touch shadow-sm hover:shadow-md transition-all"
                >
                  <Link href="/occupier/create-listing-quick">
                    <Plus className="w-5 h-5 mr-2" />
                    Create New Listing
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {listings.length === 0 ? (
              <>
                <Card className="violet-bloom-card">
                  <CardContent className="p-8 sm:p-12 text-center">
                    <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-10 h-10 text-primary-400" />
                    </div>
                    <h3 className="heading-4 text-foreground mb-2">Start Your Property Search</h3>
                    <p className="body-base text-muted-foreground mb-6 max-w-sm mx-auto">
                      Create your first listing to connect with agents and find your ideal property.
                    </p>
                    <Button asChild size="lg" className="violet-bloom-button violet-bloom-touch">
                      <Link href="/occupier/create-listing-quick">
                        <Plus className="w-5 h-5 mr-2" />
                        Create Your First Listing
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
                
                {/* Consultant Profile Card */}
                <ConsultantProfileCard />
              </>
            ) : (
              <>
                <div className="space-y-4">
                  {listings.map((listing) => {
                  const statusContent = getStatusContent(listing);
                  const StatusIcon = statusContent.icon;
                  
                  return (
                    <Card 
                      key={listing.id} 
                      className={`violet-bloom-card-hover transition-all duration-200 ${
                        listing.status === 'rejected' ? 'border-destructive/30' : ''
                      }`}
                    >
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Left Side - Listing Info */}
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              listing.status === 'approved' ? 'bg-emerald-50' :
                              listing.status === 'pending' ? 'bg-amber-50' :
                              listing.status === 'rejected' ? 'bg-destructive/10' :
                              'bg-muted'
                            }`}>
                              <StatusIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${statusContent.iconColor}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground truncate">
                                  {listing.company_name}
                                </h3>
                                <StatusBadge status={listing.status} />
                              </div>
                              
                              <p className="text-sm text-muted-foreground mt-1">
                                {statusContent.message} • {formatDate(listing.updated_at)}
                              </p>
                              
                              {listing.status === 'rejected' && listing.rejection_reason && (
                                <p className="text-sm text-destructive mt-2 line-clamp-2">
                                  Feedback: {listing.rejection_reason}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Right Side - Actions */}
                          <div className="flex items-center gap-2 ml-14 sm:ml-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-muted"
                              onClick={() => setPreviewListingId(listing.id)}
                            >
                              <Eye className="w-4 h-4" />
                              <span className="sr-only">Preview listing</span>
                            </Button>
                            
                            <Button
                              asChild
                              variant={statusContent.action.variant}
                              size="sm"
                              className="min-w-[100px]"
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
                
                {/* Consultant Profile Card */}
                <ConsultantProfileCard />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewListingId && (
        <ImmersiveListingModal
          listingId={previewListingId}
          isOpen={true}
          onClose={() => setPreviewListingId(null)}
        />
      )}
    </div>
  );
}