'use client';

import { useRouter } from 'next/navigation';
import { createClientClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  Edit, 
  Archive,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '../components/StatusBadge';
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
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClientClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
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

    fetchData();
  }, [router]);

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
            href: `/occupier/create-listing?edit=${listing.id}`,
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
            href: `/occupier/create-listing?edit=${listing.id}`,
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
            href: `/occupier/create-listing?edit=${listing.id}`,
            variant: 'secondary' as const
          }
        };
      case 'archived':
        return {
          icon: Archive,
          iconColor: 'text-muted-foreground',
          message: 'Archived',
          action: {
            label: 'View',
            href: `/occupier/create-listing?edit=${listing.id}`,
            variant: 'ghost' as const
          }
        };
      default:
        return {
          icon: FileText,
          iconColor: 'text-muted-foreground',
          message: 'Draft',
          action: {
            label: 'Continue Editing',
            href: `/occupier/create-listing?edit=${listing.id}`,
            variant: 'outline' as const
          }
        };
    }
  };

  // Empty state for additional listings
  const EmptyListingSlot = ({ index }: { index: number }) => (
    <Card className="border-dashed border-2 border-muted-foreground/20 hover:border-primary/30 transition-all duration-200 group">
      <CardContent className="p-6">
        <Link 
          href="/occupier/create-listing"
          className="flex items-center justify-between hover:no-underline"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary-50 transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Add listing #{index}
              </p>
              <p className="text-sm text-muted-foreground">
                Expand your reach
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
        </Link>
      </CardContent>
    </Card>
  );

  // Check if user has any rejected listings that need attention
  const hasRejectedListings = listings.some(l => l.status === 'rejected');

  return (
    <div className="min-h-screen bg-background">
      {/* Streamlined Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-primary-50/30 to-background">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="heading-3 sm:heading-2 text-foreground flex items-center gap-2">
                  Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                </h1>
                <p className="body-base text-muted-foreground mt-1">
                  {listings.length === 0 
                    ? 'Create your first property requirement'
                    : `${listings.length} property requirement${listings.length > 1 ? 's' : ''}`
                  }
                </p>
              </div>
              
              {/* Primary CTA */}
              {!hasRejectedListings && (
                <Button 
                  asChild 
                  size="lg"
                  className="violet-bloom-button violet-bloom-touch shadow-sm hover:shadow-md transition-all"
                >
                  <Link href="/occupier/create-listing">
                    <Plus className="w-5 h-5 mr-2" />
                    Create New Listing
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - All Listings */}
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Urgent Alert for Rejected Listings */}
          {hasRejectedListings && (
            <Card className="border-destructive/50 bg-destructive/5 mb-6">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-foreground">Action Required</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {listings.filter(l => l.status === 'rejected').length} listing{listings.filter(l => l.status === 'rejected').length > 1 ? 's need' : ' needs'} changes before publishing
                      </p>
                    </div>
                  </div>
                  <Button 
                    asChild 
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Link href={`/occupier/create-listing?edit=${listings.find(l => l.status === 'rejected')?.id}`}>
                      Fix Now
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Listings Grid */}
          <div className="space-y-4">
            {/* Active Listings */}
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
                          asChild
                          variant="ghost"
                          size="sm"
                          className="hover:bg-muted"
                        >
                          <Link href={`/occupier/create-listing?edit=${listing.id}`}>
                            <Eye className="w-4 h-4" />
                            <span className="sr-only">View details</span>
                          </Link>
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
            
            {/* Empty State - No Listings */}
            {listings.length === 0 && (
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
                    <Link href="/occupier/create-listing">
                      <Plus className="w-5 h-5 mr-2" />
                      Create Your First Listing
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {/* Empty Slots - Show potential for growth */}
            {listings.length > 0 && listings.length < 5 && (
              <>
                {[...Array(Math.min(2, 5 - listings.length))].map((_, index) => (
                  <EmptyListingSlot key={index} index={listings.length + index + 1} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}