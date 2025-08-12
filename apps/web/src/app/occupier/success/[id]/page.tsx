// =====================================================
// Premium Unified Success Page - UX Expert Design
// Celebration moment with clear next steps and premium feel
// =====================================================

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Calendar, Mail, ArrowRight, Home, Eye, Sparkles, Clock, Users } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function ListingSuccessPage({ params }: PageProps) {
  // Check authentication
  const user = await getCurrentUser();
  
  if (!user) {
    redirect(`/?login=1&redirect=/occupier/success/${params.id}`);
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  // Fetch listing data
  let listingData: any;
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
    
    listingData = listing;
  } catch (error) {
    console.error('Failed to fetch listing:', error);
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
      
      {/* Celebration Header */}
      <div className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-purple-200 to-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-20 right-10 w-32 h-32 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-32 h-32 bg-gradient-to-r from-blue-200 to-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
          {/* Success Icon with animation */}
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-ping opacity-30"></div>
            <div className="relative w-20 h-20 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          
          {/* Success Message */}
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-purple-900 to-violet-900 bg-clip-text text-transparent mb-4">
            Submission Successful! 🎉
          </h1>
          
          <p className="text-xl text-gray-600 mb-2 max-w-2xl mx-auto leading-relaxed">
            Your property requirement for <span className="font-semibold text-purple-700">{listingData.company_name}</span> has been submitted for review.
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Expected review time: 24-48 hours</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        
        {/* Primary Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          
          {/* Dashboard Card */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300">
                  <Home className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Your Dashboard</h3>
                  <p className="text-sm text-gray-600">Monitor your listing status</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Track the progress of your submission and manage your requirements.
              </p>
              <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium h-12 shadow-lg hover:shadow-xl transition-all duration-200">
                <Link href="/occupier/dashboard">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Preview Card */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Preview Your Listing</h3>
                  <p className="text-sm text-gray-600">See how it will appear</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Take a look at how your property requirement will appear to landlords and agents once it's approved.
              </p>
              <Button asChild variant="outline" className="w-full border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium h-12 transition-all duration-200">
                <Link href={`/occupier/listing/${params.id}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Listing
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Process Timeline */}
        <Card className="mb-8 border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              What Happens Next?
            </h2>
            <p className="text-violet-100 mt-1">Your listing is now in our review pipeline</p>
          </div>
          <CardContent className="p-8">
            <div className="relative">
              <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 to-violet-400 opacity-30"></div>
              
              <div className="space-y-8">
                {[
                  {
                    icon: CheckCircle,
                    title: "Submission Received",
                    description: "Your listing has been successfully submitted and is in our review queue.",
                    status: "completed",
                    time: "Just now"
                  },
                  {
                    icon: Users,
                    title: "Admin Review",
                    description: "Our team will review your listing for completeness and accuracy within 24-48 hours.",
                    status: "in_progress",
                    time: "Next 24-48 hours"
                  },
                  {
                    icon: Mail,
                    title: "Email Notification",
                    description: "You'll receive an email once your listing is approved and live on the platform.",
                    status: "pending",
                    time: "After approval"
                  },
                  {
                    icon: Sparkles,
                    title: "Go Live!",
                    description: "Your listing becomes visible to property professionals who can contact you with opportunities.",
                    status: "pending",
                    time: "Upon approval"
                  }
                ].map((step, index) => (
                  <div key={index} className="relative flex items-start gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-all duration-300",
                      step.status === 'completed' ? "bg-emerald-100 text-emerald-600 shadow-lg" :
                      step.status === 'in_progress' ? "bg-violet-100 text-violet-600 shadow-lg animate-pulse" :
                      "bg-gray-100 text-gray-400"
                    )}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pb-8">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={cn(
                          "font-semibold",
                          step.status === 'completed' ? "text-emerald-900" :
                          step.status === 'in_progress' ? "text-violet-900" :
                          "text-gray-600"
                        )}>
                          {step.title}
                        </h3>
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                          {step.time}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                      {step.status === 'completed' && (
                        <Badge className="mt-2 bg-emerald-100 text-emerald-800 border-emerald-300">
                          Completed
                        </Badge>
                      )}
                      {step.status === 'in_progress' && (
                        <Badge className="mt-2 bg-violet-100 text-violet-800 border-violet-300">
                          In Progress
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-gray-50 to-blue-50">
          <CardContent className="p-8 text-center">
            <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Questions About Your Submission?</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Our support team is here to help if you need to make changes or have questions about the review process.
            </p>
            <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
              <Mail className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Submission Successful - SiteMatcher',
  description: 'Your property requirement has been successfully submitted for review',
};