import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { CheckCircle, ArrowLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface SubmittedPageProps {
  params: {
    id: string;
  };
}

export default async function SubmittedPage({ params }: SubmittedPageProps) {
  // Check authentication
  const user = await getCurrentUser();
  
  if (!user) {
    redirect(`/?login=1&redirect=/occupier/listing/${params.id}/submitted`);
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          {/* Success Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Submission Successful!
          </h1>
          <p className="text-gray-600 mb-8">
            Your listing has been submitted for review. We'll notify you once it's been approved and is live on the platform.
          </p>
          
          {/* Action Buttons */}
          <div className="space-y-3">
            <Link href={`/occupier/listing/${params.id}`}>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Listing
              </Button>
            </Link>
            
            <Link href={`/occupier/listing/${params.id}/preview`}>
              <Button className="w-full bg-violet-600 hover:bg-violet-700">
                <Eye className="w-4 h-4 mr-2" />
                Preview Listing
              </Button>
            </Link>
          </div>
          
          {/* Additional Info */}
          <div className="mt-8 p-4 bg-violet-50 rounded-lg">
            <p className="text-sm text-violet-800">
              <strong>What happens next?</strong><br />
              Our team will review your listing within 1-2 business days. 
              You'll receive an email notification once it's approved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Listing Submitted - SiteMatch',
  description: 'Your listing has been successfully submitted for review',
};