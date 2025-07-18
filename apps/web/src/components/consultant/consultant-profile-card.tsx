'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Eye, Clock, CheckCircle, Edit, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface ProfileStatus {
  is_consultant: boolean;
  profile_completed: boolean;
  profile_exists: boolean;
}

interface ConsultantProfileCardProps {
  className?: string;
}

export default function ConsultantProfileCard({ className }: ConsultantProfileCardProps) {
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const fetchProfileStatus = async () => {
      try {
        const response = await fetch('/api/consultant/profile-status');
        const data = await response.json();

        if (data.success) {
          setProfileStatus(data.data);
        } else {
          setError(data.message || 'Failed to fetch profile status');
        }
      } catch (err) {
        console.error('Error fetching profile status:', err);
        setError('Failed to load profile status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileStatus();
  }, [user]);

  const handleCompleteProfile = () => {
    router.push('/consultant/profile/complete');
  };

  const handleEditProfile = () => {
    router.push('/consultant/profile/edit');
  };

  const handleViewProfile = () => {
    router.push('/agents'); // Navigate to agent directory
  };

  if (isLoading) {
    return (
      <Card className={`violet-bloom-card ${className}`}>
        <CardContent className="p-8">
          <div className="animate-pulse" data-testid="loading-skeleton">
            <div className="h-20 w-20 bg-gray-200 rounded-full mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`violet-bloom-card border-red-200 ${className}`}>
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="heading-4 text-red-600 mb-2">Error Loading Profile</h3>
          <p className="body-base text-red-500 mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="violet-bloom-button"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Don't render anything if user is not a consultant
  if (!profileStatus?.is_consultant) {
    return null;
  }

  // Show profile completion card if profile is not completed
  if (!profileStatus.profile_completed) {
    return (
      <Card className={`violet-bloom-card violet-bloom-card-hover ${className}`}>
        <CardContent className="p-8 sm:p-12 text-center">
          <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-primary-400" />
          </div>
          
          <h3 className="heading-4 text-foreground mb-2">
            Want to be added to the agent directory for free?
          </h3>
          
          <p className="body-base text-muted-foreground mb-4 max-w-sm mx-auto">
            Complete your professional profile to showcase your expertise and connect with potential clients. 
            Get discovered by property seekers looking for consultant services.
          </p>
          
          <div className="flex items-center justify-center gap-2 mb-6">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Takes 3 minutes</span>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            <Badge variant="secondary" className="text-xs">
              <Eye className="w-3 h-3 mr-1" />
              Increased visibility
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              Professional network
            </Badge>
          </div>
          
          <Button 
            onClick={handleCompleteProfile}
            size="lg" 
            className="violet-bloom-button violet-bloom-touch w-full sm:w-auto"
          >
            Complete Your Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show profile complete status card
  return (
    <Card className={`violet-bloom-card ${className}`}>
      <CardContent className="p-8 sm:p-12 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        
        <h3 className="heading-4 text-foreground mb-2">
          Profile Complete
        </h3>
        
        <p className="body-base text-muted-foreground mb-6 max-w-sm mx-auto">
          Your professional profile is now live in the agent directory. 
          Potential clients can discover and contact you directly.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            onClick={handleViewProfile}
            variant="outline"
            size="lg"
            className="violet-bloom-button violet-bloom-touch"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Your Profile
          </Button>
          
          <Button 
            onClick={handleEditProfile}
            size="lg"
            className="violet-bloom-button violet-bloom-touch"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}