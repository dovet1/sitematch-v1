'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, FileText, Building2, Wrench, Search, Menu, X, MoreVertical, LogOut, LogOutIcon, CreditCard, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Toaster } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

interface DashboardWrapperProps {
  userId: string;
  userEmail: string;
  children: React.ReactNode;
}

type TabType = 'overview' | 'requirements' | 'searches' | 'sites' | 'outputs' | 'tools' | 'agency';

interface NavigationSection {
  header?: string;
  items: Array<{
    id: TabType | 'external';
    label: string;
    icon: any;
    href?: string;
    external?: boolean;
  }>;
}

const navigationSections: NavigationSection[] = [
  {
    items: [
      { id: 'overview' as TabType, label: 'Get Started', icon: LayoutDashboard },
    ],
  },
  {
    header: 'Directories',
    items: [
      { id: 'external', label: 'Requirement Directory', icon: Search, href: '/search', external: true },
    ],
  },
  {
    header: 'Your Listings',
    items: [
      { id: 'requirements' as TabType, label: 'Your Requirements', icon: FileText },
    ],
  },
  {
    header: 'Site Tools',
    items: [
      { id: 'sites' as TabType, label: 'Your Sites', icon: Building2 },
      { id: 'searches' as TabType, label: 'Saved Searches', icon: Search },
      { id: 'outputs' as TabType, label: 'My Outputs', icon: FileText },
      { id: 'tools' as TabType, label: 'Tools', icon: Wrench },
    ],
  },
];

export function DashboardWrapper({ userId, userEmail, children }: DashboardWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [showSignoutAllDialog, setShowSignoutAllDialog] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'trialing' | 'active' | 'past_due' | 'canceled' | null>(null);
  const { signOut } = useAuth();

  // Listen for tab change events from dashboard-client
  useEffect(() => {
    const handleTabChange = (event: CustomEvent<TabType>) => {
      setActiveTab(event.detail);
    };

    window.addEventListener('dashboard-tab-change', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('dashboard-tab-change', handleTabChange as EventListener);
    };
  }, []);

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        const response = await fetch('/api/user/subscription-status');
        if (response.ok) {
          const data = await response.json();
          setSubscriptionStatus(data.subscriptionStatus);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      }
    };

    fetchSubscriptionStatus();
  }, [userId]);

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Portal session error:', errorData);
        throw new Error(errorData.details || 'Failed to create portal session');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening billing portal:', error);
      alert(error instanceof Error ? error.message : 'Failed to open billing portal. Please try again.');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOutAllDevices = async () => {
    setIsSigningOutAll(true);
    try {
      const response = await fetch('/api/auth/signout-all-devices', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sign out all devices');
      }

      setShowSignoutAllDialog(false);
      await signOut();
    } catch (error) {
      console.error('Error signing out all devices:', error);
      alert('Failed to sign out all devices. Please try again.');
    } finally {
      setIsSigningOutAll(false);
    }
  };

  const hasSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'past_due';

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
          'fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r-2 border-violet-200 shadow-xl transition-transform duration-300 ease-in-out flex flex-col',
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
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {navigationSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.header && (
                <h3 className="px-4 mb-2 text-xs font-black text-violet-600 uppercase tracking-wider">
                  {section.header}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  const isActive = !item.external && activeTab === item.id;
                  const key = `${sectionIndex}-${itemIndex}`;

                  if (item.external && item.href) {
                    return (
                      <Link
                        key={key}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 text-gray-700 hover:bg-violet-50 hover:text-violet-600 hover:shadow-sm"
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (item.id !== 'external') {
                          setSidebarOpen(false);

                          // If we're not on the main dashboard page, navigate there first
                          if (pathname !== '/new-dashboard') {
                            router.push('/new-dashboard');
                            // Dispatch event after a short delay to ensure navigation completes
                            setTimeout(() => {
                              const event = new CustomEvent('dashboard-tab-change', { detail: item.id });
                              window.dispatchEvent(event);
                            }, 100);
                          } else {
                            // Already on dashboard, just dispatch the event
                            const event = new CustomEvent('dashboard-tab-change', { detail: item.id });
                            window.dispatchEvent(event);
                          }
                        }
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
              </div>
            </div>
          ))}
        </nav>

        {/* User info at bottom */}
        <div className="flex-shrink-0 p-4 border-t-2 border-violet-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-lg">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{userEmail}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {subscriptionStatus === 'trialing' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-300">
                    Trial
                  </span>
                )}
                {subscriptionStatus === 'active' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-violet-100 text-violet-700 border border-violet-300">
                    Pro
                  </span>
                )}
                {subscriptionStatus === 'past_due' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                    Past Due
                  </span>
                )}
                {!subscriptionStatus || subscriptionStatus === 'canceled' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">
                    Free
                  </span>
                ) : null}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-violet-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {hasSubscription && (
                  <>
                    <DropdownMenuItem
                      onClick={handleManageSubscription}
                      disabled={isLoadingPortal}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      {isLoadingPortal ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      <span>{isLoadingPortal ? 'Opening...' : 'Manage Subscription'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => setShowSignoutAllDialog(true)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <LogOutIcon className="h-4 w-4" />
                  <span>Log out all devices</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{isLoading ? 'Signing out...' : 'Log out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          {children}
        </div>
      </main>

      {/* Toast Notifications */}
      <Toaster position="top-right" />

      {/* Sign out all devices confirmation dialog */}
      <AlertDialog open={showSignoutAllDialog} onOpenChange={setShowSignoutAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out all devices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will log you out from all devices where you're currently signed in, including this one. You'll need to sign in again on each device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOutAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOutAllDevices}
              disabled={isSigningOutAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSigningOutAll ? 'Logging out...' : 'Log out all devices'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
