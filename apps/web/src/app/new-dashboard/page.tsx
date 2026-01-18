import { getCurrentUser } from '@/lib/auth';
import DashboardClient from '@/components/dashboard/dashboard-client';

export const dynamic = 'force-dynamic';

export default async function NewDashboardPage() {
  // Layout handles auth redirect, but we still need to get user info for the client
  const user = await getCurrentUser();

  // This should never happen since layout redirects, but TypeScript safety
  if (!user) {
    return null;
  }

  return <DashboardClient userId={user.id} userEmail={user.email} />;
}

export const metadata = {
  title: 'Dashboard - SiteMatcher',
  description: 'Manage your property requirements and sites',
};
