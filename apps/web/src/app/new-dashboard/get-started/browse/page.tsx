'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Search } from 'lucide-react';

export default function GetStartedBrowsePage() {
  const router = useRouter();

  const handleSavedSearchClick = () => {
    router.push('/new-dashboard');

    const dispatchEvent = () => {
      const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
      window.dispatchEvent(event);
    };

    // Try dispatching the event multiple times with delays
    setTimeout(dispatchEvent, 150);
    setTimeout(dispatchEvent, 300);
    setTimeout(dispatchEvent, 500);
    setTimeout(dispatchEvent, 800);
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

            <div className="mt-6">
              <button
                onClick={handleSavedSearchClick}
                className="text-sm text-violet-600 hover:text-violet-700 font-semibold underline"
              >
                Or save a search to get notified of new requirements
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
