'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, FileText, Building2, Wrench, Search, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Toaster } from 'sonner';
import { OverviewTab } from './overview-tab';
import { RequirementsTab } from './requirements-tab';
import { SavedSearchesTab } from '@/components/saved-searches/saved-searches-tab';
import { ToolsTab } from './tools-tab';

interface DashboardClientProps {
  userId: string;
  userEmail: string;
}

type TabType = 'overview' | 'requirements' | 'searches' | 'sites' | 'tools';

const navigationItems = [
  { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard },
  { id: 'requirements' as TabType, label: 'Requirements', icon: FileText },
  { id: 'searches' as TabType, label: 'Saved Searches', icon: Search },
  { id: 'sites' as TabType, label: 'Sites', icon: Building2 },
  { id: 'tools' as TabType, label: 'Tools', icon: Wrench },
];

export function DashboardClient({ userId, userEmail }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleTabChange = (event: CustomEvent<TabType>) => {
      setActiveTab(event.detail);
    };

    window.addEventListener('dashboard-tab-change', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('dashboard-tab-change', handleTabChange as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-blue-50">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-sm border-b-2 border-violet-200 shadow-md z-40 flex items-center px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="mr-2 hover:bg-violet-50"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <h1 className="text-lg font-black">Dashboard</h1>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r-2 border-violet-200 shadow-xl transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b-2 border-violet-200 bg-gradient-to-r from-violet-50/30 to-transparent">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <Image
              src="/logos/logo.svg"
              alt="SiteMatcher"
              width={160}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 shadow-lg border-2 border-violet-300'
                    : 'text-gray-700 hover:bg-violet-50 hover:text-violet-600 hover:shadow-sm'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-violet-600')} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t-2 border-violet-200 bg-gradient-to-r from-violet-50/30 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-lg">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{userEmail}</p>
              <p className="text-xs text-violet-600 font-medium">Logged in</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          {activeTab === 'overview' && <OverviewTab userId={userId} />}
          {activeTab === 'requirements' && <RequirementsTab userId={userId} />}
          {activeTab === 'searches' && <SavedSearchesTab userId={userId} />}
          {activeTab === 'sites' && (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sites</h3>
              <p className="text-gray-500">Coming soon</p>
            </div>
          )}
          {activeTab === 'tools' && <ToolsTab />}
        </div>
      </main>

      {/* Toast Notifications */}
      <Toaster position="top-right" />
    </div>
  );
}
