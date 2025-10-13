import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import ConsultantProfileEditor from '@/components/consultant/consultant-profile-editor';

export const dynamic = 'force-dynamic';

export default async function ConsultantProfileEditPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/login?redirect=/consultant/profile/edit');
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

  // Check if profile exists
  const { data: profileData, error: profileError } = await supabase
    .from('consultant_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profileData) {
    redirect('/consultant/profile/complete');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="heading-2 text-foreground mb-4">
              Edit Your Consultant Profile
            </h1>
            <p className="body-large text-muted-foreground max-w-2xl mx-auto">
              Update your professional profile information to keep your listing 
              in the agent directory current and accurate.
            </p>
          </div>
          
          <ConsultantProfileEditor initialData={profileData} />
        </div>
      </div>
    </div>
  );
}