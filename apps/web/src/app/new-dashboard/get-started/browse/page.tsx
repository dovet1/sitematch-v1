'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Search, Lightbulb } from 'lucide-react';

export default function GetStartedBrowsePage() {
  const router = useRouter();

  const handleSavedSearchClick = () => {
    router.push('/new-dashboard');
    setTimeout(() => {
      const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
      window.dispatchEvent(event);
    }, 150);
    setTimeout(() => {
      const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
      window.dispatchEvent(event);
    }, 300);
    setTimeout(() => {
      const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
      window.dispatchEvent(event);
    }, 500);
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-3xl mx-auto w-full">
        <div className="bg-white rounded-3xl border-3 border-violet-200 p-8 sm:p-12 shadow-xl">
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-violet-100 rounded-2xl mb-4">
              <Search className="h-12 w-12 text-violet-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Browse Requirements
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Explore thousands of verified property requirements
            </p>

            <Link href="/search">
              <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                View Directory
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="mt-8 pt-8 border-t-2 border-violet-100">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-6 w-6 text-violet-600" />
              <h2 className="text-xl font-black text-gray-900">Did you know?</h2>
            </div>

            <div className="space-y-3">
              <p className="text-gray-700 pl-8">
                • Listings are verified every 90 days as a minimum
              </p>
              <p className="text-gray-700 pl-8">
                • Want to be notified of new requirements matching your search criteria?{' '}
                <button
                  onClick={handleSavedSearchClick}
                  className="text-violet-600 hover:text-violet-700 font-semibold underline"
                >
                  Add a saved search
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
