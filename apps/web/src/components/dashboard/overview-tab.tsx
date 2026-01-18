'use client';

import Link from 'next/link';
import { Search, Plus, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OverviewTabProps {
  userId: string;
}

export function OverviewTab({ userId }: OverviewTabProps) {
  return (
    <div className="h-full flex items-center justify-center">
      {/* Main Content - Always shown */}
      <div className="bg-white rounded-3xl border-3 border-violet-200 p-8 sm:p-12 lg:p-16 shadow-xl w-full">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 mb-4">
            What would you like to do today?
          </h2>
          <p className="text-xl text-gray-600">
            Choose how you'd like to get started with SiteMatcher
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Option 1: Browse Directory */}
          <Link href="/new-dashboard/get-started/browse">
            <div className="border-3 border-violet-200 rounded-2xl p-8 hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-white h-full">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-violet-100 rounded-xl mb-6">
                  <Search className="h-10 w-10 text-violet-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">
                  Browse Requirements
                </h3>
                <p className="text-base text-gray-600">
                  Explore our directory of verified property requirements
                </p>
              </div>
            </div>
          </Link>

          {/* Option 2: Post Requirement */}
          <Link href="/new-dashboard/get-started/post-requirement">
            <div className="border-3 border-violet-200 rounded-2xl p-8 hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-white h-full">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-violet-100 rounded-xl mb-6">
                  <Plus className="h-10 w-10 text-violet-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">
                  Post or Manage a Requirement
                </h3>
                <Badge className="bg-green-100 text-green-700 mb-3 text-sm">Free, forever!</Badge>
                <p className="text-base text-gray-600">
                  Share what you're looking for with our community
                </p>
              </div>
            </div>
          </Link>

          {/* Option 3: Assess Site */}
          <Link href="/new-dashboard/get-started/assess-site">
            <div className="border-3 border-violet-200 rounded-2xl p-8 hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-white h-full">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-violet-100 rounded-xl mb-6">
                  <Wrench className="h-10 w-10 text-violet-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">
                  Assess a Site
                </h3>
                <p className="text-base text-gray-600">
                  Quickly assess sites with our tools
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
