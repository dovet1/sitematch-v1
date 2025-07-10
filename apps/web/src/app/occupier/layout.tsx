import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function OccupierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/?login=1&redirect=/occupier/dashboard');
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}