'use client';

import { useState, useEffect } from 'react';
import { createClientClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Eye, Loader2, CheckCircle, Clock, AlertTriangle, Pencil } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AgencyCreationModal } from '@/components/agencies/agency-creation-modal';
import { AgencyModal } from '@/components/agencies/AgencyModal';
import { PaywallModal } from '@/components/PaywallModal';
import { Badge } from '@/components/ui/badge';

interface Agency {
  id: string;
  name: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface AgencyTabProps {
  userId: string;
}

const statusConfig = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

export function AgencyTab({ userId }: AgencyTabProps) {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateAgency, setShowCreateAgency] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);

  useEffect(() => {
    fetchAgency();
    checkSubscription();
  }, [userId]);

  const fetchAgency = async () => {
    try {
      const supabase = createClientClient();
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, status, created_at, updated_at')
        .eq('created_by', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found" which is ok
      setAgency(data);
    } catch (error) {
      console.error('Error fetching agency:', error);
      toast.error('Failed to load agency');
    } finally {
      setLoading(false);
    }
  };

  const checkSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/check');
      const data = await response.json();
      setHasSubscription(data.hasAccess || false);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setHasSubscription(false);
    }
  };

  const handleCreateAgencyClick = () => {
    if (hasSubscription) {
      setShowCreateAgency(true);
    } else {
      setShowPaywall(true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900">Your Agency</h1>
            <p className="text-gray-600 mt-1 sm:mt-2 text-base sm:text-lg font-medium">
              {agency
                ? 'Manage your agency profile and visibility'
                : 'Create your agency profile to showcase your services'
              }
            </p>
          </div>
          {!agency && (
            <Button
              className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg font-bold rounded-xl px-6 py-5 sm:py-3"
              onClick={handleCreateAgencyClick}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Agency Profile
            </Button>
          )}
        </div>

        {/* Agency Content */}
        {!agency ? (
          /* Empty State */
          <div className="bg-white rounded-2xl sm:rounded-3xl border-3 border-violet-200 shadow-xl p-8 sm:p-12">
            <div className="max-w-2xl mx-auto text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Building2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">No Agency Profile Yet</h2>
              <p className="text-base sm:text-lg text-gray-600 font-medium mb-6">
                Create your agency profile to increase visibility and build trust with potential clients.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                <span className="inline-flex items-center gap-2 bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-2 text-sm font-bold text-violet-700">
                  <CheckCircle className="w-4 h-4" /> Verified badge
                </span>
                <span className="inline-flex items-center gap-2 bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-2 text-sm font-bold text-violet-700">
                  <Eye className="w-4 h-4" /> Public listing
                </span>
                <span className="inline-flex items-center gap-2 bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-2 text-sm font-bold text-violet-700">
                  <Building2 className="w-4 h-4" /> Contact details
                </span>
              </div>
              <Button
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black shadow-xl hover:shadow-2xl rounded-xl px-8 py-6 text-lg"
                onClick={handleCreateAgencyClick}
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Agency Profile
              </Button>
              <p className="text-sm text-gray-500 mt-4 font-medium">
                Takes about 3 minutes
              </p>
            </div>
          </div>
        ) : (
          /* Agency Card */
          <div className="bg-white rounded-2xl sm:rounded-3xl border-3 border-violet-200 shadow-xl overflow-hidden">
            {/* Header Background */}
            <div className="h-32 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8 -mt-16">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {/* Agency Icon */}
                <div className="w-24 h-24 bg-white rounded-2xl shadow-xl border-4 border-white flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-12 h-12 text-violet-600" />
                </div>

                {/* Agency Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">{agency.name}</h2>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Badge variant="secondary" className={`${statusConfig[agency.status].className} font-bold text-sm px-3 py-1`}>
                      {statusConfig[agency.status].label}
                    </Badge>
                    <span className="text-sm text-gray-600 font-medium">
                      Created {formatDate(agency.created_at)}
                    </span>
                  </div>

                  {/* Status Messages */}
                  {agency.status === 'approved' && (
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border-2 border-emerald-200 px-4 py-2 rounded-xl">
                      <CheckCircle className="w-4 h-4" />
                      Verified agency profile - visible in directory
                    </div>
                  )}
                  {agency.status === 'pending' && (
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-700 bg-amber-50 border-2 border-amber-200 px-4 py-2 rounded-xl">
                      <Clock className="w-4 h-4" />
                      Under review - typically takes 24 hours
                    </div>
                  )}
                  {agency.status === 'rejected' && (
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-red-700 bg-red-50 border-2 border-red-200 px-4 py-2 rounded-xl">
                      <AlertTriangle className="w-4 h-4" />
                      Requires changes before approval
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t-2 border-violet-100">
                <Button
                  variant="outline"
                  className="border-2 border-violet-300 hover:bg-violet-50 font-bold rounded-xl"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Profile
                </Button>
                <Button
                  asChild
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg"
                >
                  <Link href={`/agencies/${agency.id}/edit`}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AgencyCreationModal
        isOpen={showCreateAgency}
        onClose={() => {
          setShowCreateAgency(false);
          fetchAgency(); // Refresh agency data after creation
        }}
      />

      <AgencyModal
        agencyId={agency?.id || null}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />

      <PaywallModal
        context="agency"
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </>
  );
}
