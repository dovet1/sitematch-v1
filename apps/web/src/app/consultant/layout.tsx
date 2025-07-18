import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export default async function ConsultantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  const supabase = createServerClient();
  
  // Check if user is a consultant
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (userError || userData?.user_type !== 'Consultant') {
    redirect('/occupier/dashboard');
  }

  return <>{children}</>;
}