'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, FileText, ArrowRight } from 'lucide-react';

export default function GetStartedPostRequirementPage() {
  const router = useRouter();

  const handleManageRequirements = () => {
    // Navigate to dashboard and trigger requirements tab
    // Use a slightly longer delay and multiple attempts to ensure the event is caught
    router.push('/new-dashboard');

    const dispatchEvent = () => {
      const event = new CustomEvent('dashboard-tab-change', { detail: 'requirements' });
      window.dispatchEvent(event);
    };

    // Try dispatching the event multiple times with delays
    setTimeout(dispatchEvent, 150);
    setTimeout(dispatchEvent, 300);
    setTimeout(dispatchEvent, 500);
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-5xl mx-auto w-full">
        <div className="bg-white rounded-3xl border-3 border-violet-200 p-8 sm:p-12 shadow-xl">
          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-violet-100 rounded-2xl mb-4">
              <Plus className="h-12 w-12 text-violet-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Post or Manage a Requirement
            </h1>
            <Badge className="bg-green-100 text-green-700 text-base px-4 py-1 mb-3">
              Free, forever!
            </Badge>
            <p className="text-lg text-gray-600">
              Choose how you'd like to proceed
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Option 1: Add via Form */}
            <Link href="/occupier/create-listing-quick">
              <div className="border-3 border-violet-200 rounded-2xl p-6 hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-white h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-violet-100 rounded-xl mb-4">
                    <Plus className="h-8 w-8 text-violet-600" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    Use Our Form
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Quickly add a requirement using our simple form
                  </p>
                  <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                    Create Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </Link>

            {/* Option 2: Email Us */}
            <a href="mailto:rob@sitematcher.co.uk">
              <div className="border-3 border-blue-200 rounded-2xl p-6 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-white h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-blue-100 rounded-xl mb-4">
                    <Mail className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    Email Us
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    No time? Email rob@sitematcher.co.uk and we'll do it for you
                  </p>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                    Send Email
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </a>

            {/* Option 3: Manage Requirements */}
            <div onClick={handleManageRequirements} className="cursor-pointer">
              <div className="border-3 border-green-200 rounded-2xl p-6 hover:border-green-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-green-100 rounded-xl mb-4">
                    <FileText className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    Manage Requirements
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    View and manage your existing requirements
                  </p>
                  <Button className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800">
                    View Requirements
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
