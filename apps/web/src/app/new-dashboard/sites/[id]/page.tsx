import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SiteDetailPage } from '@/components/dashboard/site-detail-page';

export default async function SiteDetailPageRoute({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <SiteDetailPage siteId={params.id} userId={user.id} />;
}
