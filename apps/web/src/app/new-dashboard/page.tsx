import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export const dynamic = 'force-dynamic';

export default async function NewDashboardPage() {
  // Check authentication
  const user = await getCurrentUser();

  if (!user) {
    redirect('/?login=1&redirect=/new-dashboard');
  }

  return <DashboardClient userId={user.id} userEmail={user.email} />;
}

export const metadata = {
  title: 'Dashboard - SiteMatcher',
  description: 'Manage your property requirements and sites',
};
