// =====================================================
// Listing Submission Success Page - Story 3.3 Task 5
// Enhanced post-submission experience with rich summary
// =====================================================

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Mail, ArrowRight, Home, FileText } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

// =====================================================
// TYPES
// =====================================================

interface SubmissionSuccessData {
  listingId: string;
  title: string;
  submittedAt: Date;
  estimatedReviewTime: string;
  nextSteps: string[];
  contactEmail: string;
  companyName: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface PageProps {
  params: {
    id: string;
  };
}

// =====================================================
// PAGE COMPONENT
// =====================================================

export default async function ListingSubmittedPage({ params }: PageProps) {
  // Check authentication
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/?login=1&redirect=/occupier/dashboard');
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  // Fetch actual listing data from database
  let submissionData: SubmissionSuccessData;
  
  try {
    const { createAdminService } = await import('@/lib/admin');
    const adminService = createAdminService();
    const listing = await adminService.getListingById(params.id);
    
    if (!listing) {
      notFound();
    }
    
    // Check if user owns this listing or is admin
    if (listing.created_by !== user.id && user.role !== 'admin') {
      redirect('/unauthorized');
    }
    
    submissionData = {
      listingId: params.id,
      title: listing.title || `Property Requirement - ${listing.company_name}`,
      submittedAt: new Date(listing.created_at),
      estimatedReviewTime: '1-2 business days',
      nextSteps: [
        'Our admin team will review your listing for completeness and accuracy',
        'You will receive an email notification once your listing is approved',
        'Your listing will be published and visible to potential partners',
        'You can track responses and manage your listing from your dashboard'
      ],
      contactEmail: listing.contact_email || user.email || '',
      companyName: listing.company_name || 'Company Name Not Provided',
      status: listing.status || 'pending'
    };
  } catch (error) {
    console.error('Failed to fetch listing:', error);
    // Fallback to basic data if fetch fails
    submissionData = {
      listingId: params.id,
      title: `Property Requirement - Listing ${params.id}`,
      submittedAt: new Date(),
      estimatedReviewTime: '1-2 business days',
      nextSteps: [
        'Our admin team will review your listing for completeness and accuracy',
        'You will receive an email notification once your listing is approved',
        'Your listing will be published and visible to potential partners',
        'You can track responses and manage your listing from your dashboard'
      ],
      contactEmail: user.email || '',
      companyName: 'Company Name Not Available',
      status: 'pending'
    };
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Header */}
      <div className="bg-green-50 border-b border-green-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-900">
                Listing Submitted Successfully!
              </h1>
              <p className="text-green-700 mt-1">
                Your property requirement has been received and is under review.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Submission Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Submission Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Listing ID</Label>
                    <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {submissionData.listingId}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Status</Label>
                    <div className="mt-1">
                      <Badge 
                        variant="secondary" 
                        className={
                          submissionData.status === 'approved' ? 'bg-green-100 text-green-800' :
                          submissionData.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {submissionData.status === 'approved' ? 'Approved' :
                         submissionData.status === 'rejected' ? 'Rejected' :
                         'Pending Review'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Company</Label>
                    <p className="font-medium">{submissionData.companyName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Submitted</Label>
                    <p className="text-sm">
                      {submissionData.submittedAt.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })} at{' '}
                      {submissionData.submittedAt.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card>
              <CardHeader>
                <CardTitle>What Happens Next?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {submissionData.nextSteps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-sm font-medium flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="flex-1">
                <Link href="/occupier/dashboard">
                  <Home className="w-4 h-4 mr-2" />
                  View Dashboard
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/occupier/dashboard">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Link>
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Review Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-green-900">Submitted</p>
                      <p className="text-sm text-green-700">
                        {submissionData.submittedAt.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Under Review</p>
                      <p className="text-sm text-gray-500">
                        Estimated: {submissionData.estimatedReviewTime}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Notification</p>
                      <p className="text-sm text-gray-500">
                        Email confirmation sent
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  If you have questions about your submission or need to make changes, 
                  please contact our support team.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Support
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// METADATA
// =====================================================

export const metadata = {
  title: 'Listing Submitted - SiteMatch',
  description: 'Your property requirement listing has been submitted successfully',
};

// =====================================================
// UTILITY COMPONENT
// =====================================================

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block text-sm font-medium', className)}>
      {children}
    </label>
  );
}