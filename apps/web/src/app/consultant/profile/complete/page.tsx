import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import ConsultantProfileWizard from '@/components/consultant/consultant-profile-wizard';

export const dynamic = 'force-dynamic';

export default async function ConsultantProfileCompletePage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/login?redirect=/consultant/profile/complete');
  }

  const supabase = await createServerClient();
  
  // Check if user is a consultant
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (userError || userData?.user_type !== 'Consultant') {
    redirect('/new-dashboard');
  }

  // Check if profile is already completed
  const { data: profileData, error: profileError } = await supabase
    .from('consultant_profiles')
    .select('profile_completed')
    .eq('user_id', user.id)
    .single();

  if (profileData?.profile_completed) {
    redirect('/consultant/profile/edit');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="heading-2 text-foreground mb-4">
              Complete Your Consultant Profile
            </h1>
            <p className="body-large text-muted-foreground max-w-2xl mx-auto">
              Set up your professional profile to be featured in our agent directory. 
              This will help potential clients discover your services and expertise.
            </p>
          </div>
          
          <ConsultantProfileWizard />
        </div>
      </div>
    </div>
  );
}