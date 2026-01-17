import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardWrapper } from '@/components/dashboard/dashboard-wrapper';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/?login=1&redirect=/new-dashboard');
  }

  return (
    <DashboardWrapper userId={user.id} userEmail={user.email}>
      {children}
    </DashboardWrapper>
  );
}
