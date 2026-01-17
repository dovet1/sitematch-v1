'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Wrench, Building2, ArrowRight, Map } from 'lucide-react';

export default function GetStartedAssessSitePage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-3xl border-3 border-violet-200 p-8 sm:p-12 shadow-xl">
          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-violet-100 rounded-2xl mb-4">
              <Wrench className="h-12 w-12 text-violet-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Site Assessment Tools
            </h1>
            <p className="text-lg text-gray-600">
              Quickly assess sites with our tools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SiteSketcher Card */}
            <div className="border-3 border-blue-200 rounded-2xl p-6 hover:border-blue-400 hover:shadow-xl transition-all duration-300">
              <div className="text-center">
                <div className="inline-flex p-3 bg-blue-100 rounded-xl mb-4">
                  <Map className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-3">SiteSketcher</h2>
                <p className="text-gray-600 mb-4 text-sm">
                  Sketch buildings and parking on a map
                </p>
                <Link href="/sitesketcher" className="block">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                    Open Tool
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* SiteAnalyser Card */}
            <div className="border-3 border-violet-200 rounded-2xl p-6 hover:border-violet-400 hover:shadow-xl transition-all duration-300">
              <div className="text-center">
                <div className="inline-flex p-3 bg-violet-100 rounded-xl mb-4">
                  <Building2 className="h-8 w-8 text-violet-600" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-3">SiteAnalyser</h2>
                <p className="text-gray-600 mb-4 text-sm">
                  Analyse demographic data around a site
                </p>
                <Link href="/new-dashboard/tools/site-demographer" className="block">
                  <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                    Open Tool
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-violet-600 mt-6">
            Find these tools anytime via "Tools" in the sidebar
          </p>
        </div>
      </div>
    </div>
  );
}
