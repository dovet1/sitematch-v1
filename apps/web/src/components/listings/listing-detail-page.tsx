// =====================================================
// Listing Detail Page - Redesigned to match public modal layout exactly
// Owner's editing interface with edit/delete CTAs throughout
// =====================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { 
  Building2, 
  MapPin, 
  Users, 
  MessageSquare, 
  FileText, 
  Eye,
  Plus,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Save,
  X,
  Phone,
  Mail,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

import { createClientClient } from '@/lib/supabase';
import { getSectors, getUseClasses } from '@/lib/listings';
import type { WizardFormData } from '@/types/wizard';
import type { Sector, UseClass } from '@/types/listings';
import { uploadFiles, validateFiles } from '@/lib/file-upload';
import type { FileUploadType, UploadedFile } from '@/types/uploads';
import { ImmersiveListingModal } from '@/components/listings/ImmersiveListingModal';

interface ListingDetailPageProps {
  listingId: string;
  userId: string;
  showHeaderBar?: boolean;
}

interface ListingData extends WizardFormData {
  id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  completion_percentage?: number;
}

export function ListingDetailPage({ listingId, userId, showHeaderBar = true }: ListingDetailPageProps) {
  const router = useRouter();
  const [listingData, setListingData] = useState<ListingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tab navigation (matching public modal exactly)
  const [activeTab, setActiveTab] = useState('overview');
  
  // Editing state for each section
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>({});

  // Reference data for sectors and use classes
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [useClasses, setUseClasses] = useState<UseClass[]>([]);
  
  // Visual hero view state (matching public modal)
  const [visualView, setVisualView] = useState<'map' | 'fitouts' | 'siteplans'>('map');
  
  // Quick Add Modal states
  const [quickAddModals, setQuickAddModals] = useState({
    faq: false,
    contact: false,
    uploadSitePlans: false,
    uploadFitOuts: false,
    requirements: false
  });


  const tabs = [
    { id: 'overview', label: 'overview' },
    { id: 'requirements', label: 'requirements' },
    { id: 'locations', label: 'locations' },
    { id: 'contact', label: 'contact' },
    { id: 'faqs', label: 'faqs' }
  ];

  // Get company name for tab display
  const companyName = listingData?.companyName || 'Company';

  // Fetch reference data
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [sectorsData, useClassesData] = await Promise.all([
          getSectors(),
          getUseClasses()
        ]);
        setSectors(sectorsData);
        setUseClasses(useClassesData);
      } catch (err) {
        console.error('Error fetching reference data:', err);
      }
    };

    fetchReferenceData();
  }, []);

  // Fetch listing data
  useEffect(() => {
    const fetchListingData = async () => {
      try {
        const supabase = createClientClient();
        
        // Fetch main listing data
        const { data: listing, error: listingError } = await supabase
          .from('listings')
          .select('*')
          .eq('id', listingId)
          .eq('created_by', userId)
          .single();

        if (listingError) {
          throw new Error(listingError.message);
        }

        if (!listing) {
          throw new Error('Listing not found');
        }

        // Fetch related data
        const [
          { data: contacts },
          { data: locations },
          { data: faqs },
          { data: files }
        ] = await Promise.all([
          supabase.from('listing_contacts').select('*').eq('listing_id', listingId),
          supabase.from('listing_locations').select('*').eq('listing_id', listingId),
          supabase.from('faqs').select('*').eq('listing_id', listingId).order('display_order'),
          supabase.from('file_uploads').select('*').eq('listing_id', listingId)
        ]);

        // Transform data to match WizardFormData structure
        const transformedData: ListingData = {
          id: listing.id,
          companyName: listing.company_name,
          listingType: listing.listing_type as 'commercial' | 'residential',
          status: listing.status,
          created_at: listing.created_at,
          updated_at: listing.updated_at,
          completion_percentage: listing.completion_percentage || 20,
          
          // Primary contact from listings table
          primaryContact: {
            contactName: listing.contact_name || '',
            contactTitle: listing.contact_title || '',
            contactEmail: listing.contact_email || '',
            contactPhone: listing.contact_phone || '',
            contactArea: listing.contact_area || '',
            isPrimaryContact: true,
            headshotUrl: contacts?.find(c => c.is_primary_contact)?.headshot_url || ''
          },

          // Logo information
          logoMethod: listing.clearbit_logo ? 'clearbit' : 'upload',
          clearbitLogo: listing.clearbit_logo || false,
          companyDomain: listing.company_domain || '',
          logoUrl: listing.logo_url || '',
          logoPreview: listing.logo_url || '',

          // Property page link
          propertyPageLink: listing.property_page_link || '',

          // Requirements
          siteSizeMin: listing.site_size_min,
          siteSizeMax: listing.site_size_max,
          dwellingCountMin: listing.dwelling_count_min,
          dwellingCountMax: listing.dwelling_count_max,
          siteAcreageMin: listing.site_acreage_min,
          siteAcreageMax: listing.site_acreage_max,
          sectors: listing.sectors || [],
          useClassIds: listing.use_class_ids || [],

          // Locations
          locations: locations?.map(loc => ({
            id: loc.id,
            place_name: loc.place_name,
            coordinates: loc.coordinates,
            type: 'preferred' as const,
            formatted_address: loc.formatted_address,
            region: loc.region,
            country: loc.country
          })) || [],

          // Additional contacts
          additionalContacts: contacts?.filter(c => !c.is_primary_contact).map(contact => ({
            id: contact.id,
            contactName: contact.contact_name,
            contactTitle: contact.contact_title,
            contactEmail: contact.contact_email,
            contactPhone: contact.contact_phone,
            contactArea: contact.contact_area,
            isPrimaryContact: false,
            headshotUrl: contact.headshot_url
          })) || [],

          // FAQs
          faqs: faqs?.map(faq => ({
            id: faq.id,
            question: faq.question,
            answer: faq.answer,
            displayOrder: faq.display_order
          })) || [],

          // Files - Generate proper Supabase public URLs
          brochureFiles: files?.filter(f => f.file_type === 'brochure').map(file => {
            const { data: urlData } = supabase.storage
              .from('brochures')
              .getPublicUrl(file.file_path);
            return {
              id: file.id,
              name: file.file_name,
              url: urlData.publicUrl,
              path: file.file_path,
              type: 'brochure' as const,
              size: file.file_size,
              mimeType: file.mime_type,
              uploadedAt: new Date(file.created_at)
            };
          }) || [],

          sitePlanFiles: files?.filter(f => f.file_type === 'sitePlan').map(file => {
            const { data: urlData } = supabase.storage
              .from('site-plans')
              .getPublicUrl(file.file_path);
            return {
              id: file.id,
              name: file.file_name,
              url: urlData.publicUrl,
              path: file.file_path,
              type: 'sitePlan' as const,
              size: file.file_size,
              mimeType: file.mime_type,
              uploadedAt: new Date(file.created_at)
            };
          }) || [],

          fitOutFiles: files?.filter(f => f.file_type === 'fitOut').map(file => {
            const { data: urlData } = supabase.storage
              .from('fit-outs')
              .getPublicUrl(file.file_path);
            return {
              id: file.id,
              name: file.file_name,
              url: urlData.publicUrl,
              path: file.file_path,
              type: 'fitOut' as const,
              size: file.file_size,
              mimeType: file.mime_type,
              uploadedAt: new Date(file.created_at),
              displayOrder: file.display_order || 0
            };
          }) || []
        };

        setListingData(transformedData);
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError(err instanceof Error ? err.message : 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    };

    fetchListingData();
  }, [listingId, userId]);

  const handleSubmitForReview = async () => {
    if (!listingData) return;

    try {
      const supabase = createClientClient();
      
      // Update listing status to pending
      const { error } = await supabase
        .from('listings')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', listingId);

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Listing submitted for review!');
      
      // Update local state
      setListingData(prev => prev ? { ...prev, status: 'pending' } : null);
    } catch (err) {
      console.error('Error submitting listing:', err);
      toast.error('Failed to submit listing for review');
    }
  };

  // Section editing handlers
  const startEditing = (section: string, initialData: any = {}) => {
    setEditingSection(section);
    setEditingData(initialData);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditingData({});
  };

  const saveSection = async (section: string, data: any) => {
    try {
      const supabase = createClientClient();
      
      if (section === 'requirements') {
        // Update listings table with requirements data
        const { error } = await supabase
          .from('listings')
          .update({
            site_size_min: data.siteSizeMin ? parseInt(data.siteSizeMin) : null,
            site_size_max: data.siteSizeMax ? parseInt(data.siteSizeMax) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', listingId);

        if (error) throw error;

        // Update local state optimistically
        setListingData(prev => prev ? {
          ...prev,
          siteSizeMin: data.siteSizeMin ? parseInt(data.siteSizeMin) : undefined,
          siteSizeMax: data.siteSizeMax ? parseInt(data.siteSizeMax) : undefined
        } : null);

      } else if (section === 'faqs') {
        // Delete existing FAQs
        await supabase
          .from('faqs')
          .delete()
          .eq('listing_id', listingId);

        // Insert new FAQs
        if (data.faqs && data.faqs.length > 0) {
          const faqsToInsert = data.faqs
            .filter((faq: any) => faq.question.trim() && faq.answer.trim())
            .map((faq: any, index: number) => ({
              listing_id: listingId,
              question: faq.question.trim(),
              answer: faq.answer.trim(),
              display_order: index
            }));

          if (faqsToInsert.length > 0) {
            const { error } = await supabase
              .from('faqs')
              .insert(faqsToInsert);

            if (error) throw error;
          }
        }

        // Update local state optimistically
        setListingData(prev => prev ? {
          ...prev,
          faqs: data.faqs?.filter((faq: any) => faq.question.trim() && faq.answer.trim()) || []
        } : null);
      }

      toast.success('Section saved successfully!');
      
      // Update local state and exit editing mode
      setEditingSection(null);
      setEditingData({});
      
    } catch (error) {
      console.error('Error saving section:', error);
      toast.error('Failed to save section');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150" />
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-300" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Listing</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/occupier/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!listingData) {
    return null;
  }

  // Helper function to get status info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'draft':
        return {
          icon: Edit,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: 'Draft'
        };
      case 'pending':
        return {
          icon: Clock,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          label: 'Under Review'
        };
      case 'approved':
        return {
          icon: CheckCircle,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          label: 'Published'
        };
      case 'rejected':
        return {
          icon: AlertTriangle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          label: 'Changes Requested'
        };
      default:
        return {
          icon: Edit,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: 'Draft'
        };
    }
  };

  const statusInfo = getStatusInfo(listingData.status);
  const StatusIcon = statusInfo.icon;

  // Calculate completion status for each section
  const getCompletionStatus = () => {
    if (!listingData) return {};
    
    return {
      overview: {
        completed: !!(listingData.brochureFiles?.length || (listingData.sectors?.length || listingData.useClassIds?.length)),
        total: 2,
        current: (listingData.brochureFiles?.length ? 1 : 0) + ((listingData.sectors?.length || listingData.useClassIds?.length) ? 1 : 0)
      },
      requirements: {
        completed: !!(listingData.sectors?.length && listingData.useClassIds?.length && listingData.siteSizeMin && listingData.siteSizeMax),
        total: 3,
        current: (listingData.sectors?.length ? 1 : 0) + (listingData.useClassIds?.length ? 1 : 0) + (listingData.siteSizeMin && listingData.siteSizeMax ? 1 : 0)
      },
      locations: {
        completed: !!(listingData.locations?.length || listingData.locationSearchNationwide),
        total: 1,
        current: (listingData.locations?.length || listingData.locationSearchNationwide) ? 1 : 0
      },
      contact: {
        completed: !!(listingData.primaryContact?.contactName && listingData.primaryContact?.contactEmail),
        total: 2,
        current: (listingData.primaryContact?.contactName ? 1 : 0) + (listingData.primaryContact?.contactEmail ? 1 : 0)
      },
      documents: {
        completed: !!(listingData.sitePlanFiles?.length || listingData.fitOutFiles?.length),
        total: 2,
        current: (listingData.sitePlanFiles?.length ? 1 : 0) + (listingData.fitOutFiles?.length ? 1 : 0)
      },
      faqs: {
        completed: !!(listingData.faqs?.length),
        total: 1,
        current: listingData.faqs?.length ? 1 : 0
      }
    };
  };

  const completionStatus = getCompletionStatus();

  // Sophisticated empty state component
  const SophisticatedEmptyState = ({ 
    icon: Icon, 
    title, 
    description, 
    benefit, 
    actionText, 
    onAction, 
    preview,
    examples,
    className = "",
    showBenefits = true,
    showExamples = true
  }: {
    icon: any,
    title: string,
    description: string,
    benefit: string,
    actionText: string,
    onAction: () => void,
    preview?: string,
    examples?: string[],
    className?: string,
    showBenefits?: boolean,
    showExamples?: boolean
  }) => (
    <div className={`text-center group hover:scale-[1.02] transition-all duration-300 ${className}`}>
      <div className="relative">
        <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/15 transition-colors duration-300">
          <Icon className="w-12 h-12 text-white group-hover:scale-110 transition-transform duration-300" />
        </div>
        
        {/* Floating benefit badge */}
        {showBenefits && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            +Impact
          </div>
        )}
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-violet-200 text-base mb-4 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      
      {/* Benefit messaging */}
      {showBenefits && (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6 max-w-md mx-auto border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-white">Why this helps:</span>
          </div>
          <p className="text-violet-200 text-sm leading-relaxed">{benefit}</p>
        </div>
      )}

      {/* Examples/suggestions */}
      {showExamples && examples && examples.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-violet-200 mb-3">Popular examples:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {examples.map((example, index) => (
              <button
                key={index}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-full transition-colors duration-200 border border-white/20"
                onClick={() => {/* TODO: Auto-fill example */}}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <Button 
        onClick={onAction}
        className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105"
      >
        <Plus className="w-4 h-4 mr-2" />
        {actionText}
      </Button>
      
      {preview && (
        <p className="text-xs text-violet-300 mt-3 opacity-75">
          Preview: {preview}
        </p>
      )}
    </div>
  );

  // Sophisticated tab empty state component
  const TabEmptyState = ({ 
    icon: Icon, 
    title, 
    description, 
    benefit, 
    actionText, 
    onAction,
    examples
  }: {
    icon: any,
    title: string,
    description: string,
    benefit: string,
    actionText: string,
    onAction: () => void,
    examples?: string[]
  }) => (
    <div className="text-center py-12 px-6">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-violet-100 transition-colors duration-300">
          <Icon className="w-10 h-10 text-violet-500" />
        </div>
        
        <h4 className="text-xl font-semibold text-gray-900 mb-3">{title}</h4>
        <p className="text-gray-600 mb-6 leading-relaxed">
          {description}
        </p>
        
        {/* Benefit box */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-green-800">Impact:</span>
          </div>
          <p className="text-green-700 text-sm">{benefit}</p>
        </div>

        {/* Examples */}
        {examples && examples.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-3">Common examples:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {examples.map((example, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border"
                >
                  {example}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <Button 
          onClick={onAction}
          className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2"
        >
          <Plus className="w-4 h-4 mr-2" />
          {actionText}
        </Button>
      </div>
    </div>
  );

  // Subtle completion indicator - just a small dot
  const CompletionIndicator = ({ status, tabId }: { status: any, tabId: string }) => {
    if (!status) return null;
    
    const isComplete = status.completed;
    const hasContent = status.current > 0;
    
    // Only show indicator if incomplete
    if (isComplete) {
      return (
        <div className="absolute -top-1 -right-1">
          <div 
            className="w-2 h-2 rounded-full bg-green-500 shadow-sm" 
            title="Section complete"
            id={`status-${tabId}`}
            aria-label="Section complete"
            role="status"
          />
        </div>
      );
    } else if (!hasContent) {
      return (
        <div className="absolute -top-1 -right-1">
          <div 
            className="w-2 h-2 rounded-full bg-red-400 shadow-sm animate-pulse" 
            title="Section needs attention"
            id={`status-${tabId}`}
            aria-label="Section needs attention"
            role="status"
          />
        </div>
      );
    } else {
      return (
        <div className="absolute -top-1 -right-1">
          <div 
            className="w-2 h-2 rounded-full bg-yellow-400 shadow-sm" 
            title="Section partially complete"
            id={`status-${tabId}`}
            aria-label="Section partially complete"
            role="status"
          />
        </div>
      );
    }
  };

  // Editable section wrapper with smooth transitions
  const EditableSection = ({ 
    children, 
    onEdit, 
    onDelete, 
    isEmpty = false,
    emptyState,
    className = "",
    showEditOnHover = true
  }: {
    children: React.ReactNode,
    onEdit?: () => void,
    onDelete?: () => void,
    isEmpty?: boolean,
    emptyState?: React.ReactNode,
    className?: string,
    showEditOnHover?: boolean
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    if (isEmpty && emptyState) {
      return <div className={className}>{emptyState}</div>;
    }
    
    return (
      <div 
        className={`group relative transition-all duration-200 ${showEditOnHover ? 'hover:bg-gray-50' : ''} ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
        
        {/* Floating edit controls */}
        {showEditOnHover && (onEdit || onDelete) && (
          <div className={`absolute top-2 right-2 flex items-center gap-1 transition-all duration-200 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'
          }`}>
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                className="h-8 w-8 p-0 bg-white shadow-sm border hover:bg-violet-50 hover:border-violet-200 transition-all duration-200"
                title="Edit this section"
              >
                <Edit className="w-3 h-3 text-violet-600" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-8 w-8 p-0 bg-white shadow-sm border hover:bg-red-50 hover:border-red-200 transition-all duration-200"
                title="Delete this section"
              >
                <Trash2 className="w-3 h-3 text-red-600" />
              </Button>
            )}
          </div>
        )}
        
        {/* Subtle hover indicator */}
        {showEditOnHover && onEdit && (
          <div className={`absolute inset-0 border-2 border-transparent transition-all duration-200 rounded-lg pointer-events-none ${
            isHovered ? 'border-violet-200 bg-violet-50/30' : ''
          }`} />
        )}
      </div>
    );
  };

  // Quick Add Modal Components
  const QuickAddFAQModal = ({ isOpen, onClose, onSave }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (faq: { question: string; answer: string }) => void;
  }) => {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
      if (!question.trim() || !answer.trim()) return;
      
      setIsSubmitting(true);
      try {
        await onSave({ question: question.trim(), answer: answer.trim() });
        setQuestion('');
        setAnswer('');
        onClose();
      } catch (error) {
        console.error('Error saving FAQ:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Add FAQ</h3>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question
                </label>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., What's the lease length?"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Answer
                </label>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Provide a clear, helpful answer..."
                  rows={4}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!question.trim() || !answer.trim() || isSubmitting}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isSubmitting ? 'Adding...' : 'Add FAQ'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Quick Upload Modal for Visual Hero Section  
  const QuickUploadModal = ({ isOpen, onClose, type, onUpload }: {
    isOpen: boolean;
    onClose: () => void;
    type: 'siteplans' | 'fitouts';
    onUpload: (files: File[]) => void;
  }) => {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const title = type === 'siteplans' ? 'Upload Site Plans' : 'Upload Fit-Out Examples';
    const description = type === 'siteplans' 
      ? 'Upload floor plans, site layouts, or property plans'
      : 'Upload images or videos of your ideal space design';

    const acceptedTypes = type === 'siteplans' 
      ? '.pdf,.jpg,.jpeg,.png,.dwg'
      : '.jpg,.jpeg,.png,.mp4,.mov';

    const handleDrag = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setDragActive(true);
      } else if (e.type === 'dragleave') {
        setDragActive(false);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...files]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const files = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...files]);
      }
    };

    const removeFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
      if (selectedFiles.length === 0) return;
      
      setIsUploading(true);
      try {
        await onUpload(selectedFiles);
        setSelectedFiles([]);
        onClose();
        toast.success(`${title} uploaded successfully!`);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('Upload failed');
      } finally {
        setIsUploading(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-gray-600 mb-4">{description}</p>
            
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-violet-500 bg-violet-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedTypes}
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="space-y-2">
                <div className="w-12 h-12 bg-violet-50 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-violet-500" />
                </div>
                <p className="text-gray-600">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-violet-600 hover:text-violet-700 font-medium"
                  >
                    Click to upload
                  </button>
                  {' '}or drag and drop
                </p>
                <p className="text-sm text-gray-400">
                  {type === 'siteplans' ? 'PDF, JPG, PNG, DWG files' : 'JPG, PNG, MP4, MOV files'}
                </p>
              </div>
            </div>

            {/* Selected files */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Selected files:</p>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600 truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={onClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={selectedFiles.length === 0 || isUploading}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const openQuickAddModal = (type: keyof typeof quickAddModals) => {
    setQuickAddModals(prev => ({ ...prev, [type]: true }));
  };

  const closeQuickAddModal = (type: keyof typeof quickAddModals) => {
    setQuickAddModals(prev => ({ ...prev, [type]: false }));
  };

  const handleQuickAddFAQ = async (faq: { question: string; answer: string }) => {
    try {
      const currentFaqs = listingData?.faqs || [];
      const newFaq = {
        ...faq,
        id: crypto.randomUUID(),
        displayOrder: currentFaqs.length
      };
      
      const updatedFaqs = [...currentFaqs, newFaq];
      await saveSection('faqs', { faqs: updatedFaqs });
      
      toast.success('FAQ added successfully!');
    } catch (error) {
      console.error('Error adding FAQ:', error);
      toast.error('Failed to add FAQ');
    }
  };

  // File action handlers
  const handleViewFile = (file: any) => {
    window.open(file.url, '_blank');
  };


  const handleDeleteFile = async (file: any, type: 'siteplans' | 'fitouts') => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
      return;
    }

    try {
      const supabase = createClientClient();
      
      // Delete from storage
      const bucket = type === 'siteplans' ? 'site-plans' : 'fit-outs';
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([file.path]);

      if (storageError) {
        throw new Error(`Failed to delete file from storage: ${storageError.message}`);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('file_uploads')
        .delete()
        .eq('id', file.id);

      if (dbError) {
        throw new Error(`Failed to delete file record: ${dbError.message}`);
      }

      // Update local state
      if (type === 'siteplans') {
        setListingData(prev => prev ? {
          ...prev,
          sitePlanFiles: prev.sitePlanFiles?.filter(f => f.id !== file.id) || []
        } : null);
      } else {
        setListingData(prev => prev ? {
          ...prev,
          fitOutFiles: prev.fitOutFiles?.filter(f => f.id !== file.id) || []
        } : null);
      }

      toast.success('File deleted successfully!');
    } catch (error) {
      console.error('Delete file error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete file');
    }
  };

  const handleQuickUpload = async (files: File[], type: 'siteplans' | 'fitouts') => {
    try {
      const supabase = createClientClient();
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }
      
      // Map our type to the file upload types
      const fileUploadType: FileUploadType = type === 'siteplans' ? 'sitePlan' : 'fitOut';
      
      // Validate files first
      const validation = validateFiles(files, fileUploadType);
      if (!validation.isValid) {
        throw new Error(validation.errors[0]?.message || 'File validation failed');
      }
      
      // Show validation warnings if any
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => toast.warning(warning));
      }
      
      console.log(`Uploading ${files.length} ${type} files:`, files.map(f => f.name));
      
      // Upload files using the real upload function with listing ID
      const uploadedFiles = await uploadFiles(files, fileUploadType, user.id, listingId, (progress) => {
        console.log(`Upload progress: ${progress}%`);
      });
      
      // Update the listing data with real uploaded files
      if (type === 'siteplans') {
        const transformedFiles = uploadedFiles.map((file, index) => ({
          id: file.id,
          name: file.name,
          url: file.url,
          path: file.path,
          type: file.type as 'sitePlan',
          size: file.size,
          mimeType: file.mimeType,
          uploadedAt: file.uploadedAt
        }));
        
        const currentFiles = listingData?.sitePlanFiles || [];
        const updatedFiles = [...currentFiles, ...transformedFiles];
        
        setListingData(prev => prev ? {
          ...prev,
          sitePlanFiles: updatedFiles
        } : null);
      } else {
        const transformedFiles = uploadedFiles.map((file, index) => ({
          id: file.id,
          name: file.name,
          url: file.url,
          path: file.path,
          type: file.type as 'fitOut',
          size: file.size,
          mimeType: file.mimeType,
          uploadedAt: file.uploadedAt,
          displayOrder: index,
          caption: '',
          isVideo: file.mimeType.startsWith('video/'),
          thumbnail: file.thumbnail
        }));
        
        const currentFiles = listingData?.fitOutFiles || [];
        const updatedFiles = [...currentFiles, ...transformedFiles];
        
        setListingData(prev => prev ? {
          ...prev,
          fitOutFiles: updatedFiles
        } : null);
      }

      // Save to database by updating the listing with file associations
      const finalFiles = type === 'siteplans' ? 
        [...(listingData?.sitePlanFiles || []), ...uploadedFiles] : 
        [...(listingData?.fitOutFiles || []), ...uploadedFiles];
      await saveSection('documents', { [type]: finalFiles });
      
      // Close the modal and show success message
      closeQuickAddModal(type === 'siteplans' ? 'uploadSitePlans' : 'uploadFitOuts');
      toast.success(`${uploadedFiles.length} ${type === 'siteplans' ? 'site plan' : 'fit-out'} file${uploadedFiles.length > 1 ? 's' : ''} uploaded successfully!`);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload files');
    }
  };

  // Portal for action buttons in breadcrumb bar
  const ActionButtons = () => (
    <>
      <Button
        variant="outline"
        onClick={() => router.push(`/occupier/listing/${listingId}/preview`)}
      >
        <Eye className="w-4 h-4 mr-2" />
        Preview
      </Button>
      
      {listingData?.status === 'draft' && (
        <Button
          onClick={handleSubmitForReview}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          Submit for Review
        </Button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Portal action buttons to breadcrumb bar */}
      {typeof window !== 'undefined' && document.getElementById('listing-action-buttons') && 
        createPortal(<ActionButtons />, document.getElementById('listing-action-buttons')!)
      }

      {/* Header Bar (optional) */}
      {showHeaderBar && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => router.push('/occupier/dashboard')}>
                  ← Back to Dashboard
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <ActionButtons />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container (matching modal layout) */}
      <div className="max-w-6xl mx-auto bg-white">
        <div className="flex h-[calc(100vh-64px)]">
          {/* Visual Hero Section - 40% width (matching modal exactly) */}
          <div className="w-2/5 bg-gradient-to-br from-violet-900 to-violet-700 relative overflow-hidden">
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative h-full flex flex-col">

              {/* Main Visual Content Area (matching modal structure) */}
              <div className="flex-1 relative">
                {visualView === 'map' && (
                  <div className="h-full flex items-center justify-center p-8">
                    <div className="text-center">
                      <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                        {listingData.locations && listingData.locations.length > 0 ? (
                          <MapPin className="w-16 h-16 text-white" />
                        ) : (
                          <div className="text-center">
                            <div className="w-12 h-12 bg-violet-400/30 rounded-full flex items-center justify-center mx-auto mb-2">
                              <MapPin className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-xs text-violet-200">UK & Ireland</div>
                          </div>
                        )}
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">
                        {listingData.locations && listingData.locations.length > 0 
                          ? `${listingData.locations.length} Location${listingData.locations.length > 1 ? 's' : ''}`
                          : 'Nationwide Coverage'
                        }
                      </h3>
                      <p className="text-violet-200 text-lg mb-6 max-w-sm mx-auto leading-relaxed">
                        {listingData.locations && listingData.locations.length > 0 
                          ? 'Specific locations have been selected for this property requirement.'
                          : 'Open to opportunities across the UK & Ireland'
                        }
                      </p>
                      <Button 
                        variant="ghost" 
                        className="text-white hover:bg-white/10 border border-white/20 px-6 py-2" 
                        onClick={() => setActiveTab('locations')}
                      >
                        {listingData.locations && listingData.locations.length > 0 ? 'View Details' : 'Add Locations'}
                      </Button>
                    </div>
                  </div>
                )}

                {visualView === 'siteplans' && (
                  <div className="h-full">
                    {listingData.sitePlanFiles && listingData.sitePlanFiles.length > 0 ? (
                      <div className="h-full overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-white font-semibold text-xl">Site Plans</h3>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-white hover:bg-white/10"
                              onClick={() => openQuickAddModal('uploadSitePlans')}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                          <div className="grid grid-cols-1 gap-4">
                            {listingData.sitePlanFiles.map((file) => (
                              <div key={file.id} className="bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-white/20 transition-colors group">
                                {file.mimeType?.startsWith('image/') ? (
                                  <div className="relative">
                                    <img
                                      src={file.url}
                                      alt={file.name}
                                      className="w-full h-48 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-white hover:bg-white/20"
                                        onClick={() => handleViewFile(file)}
                                      >
                                        <Eye className="w-4 h-4 mr-1" />
                                        View
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-red-300 hover:bg-red-500/20"
                                        onClick={() => handleDeleteFile(file, 'siteplans')}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-6 h-6 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium text-sm truncate">{file.name}</p>
                                        <p className="text-violet-200 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                                      </div>
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
                                          onClick={() => handleDeleteFile(file, 'siteplans')}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <div className="p-3">
                                  <p className="text-white text-sm font-medium truncate">{file.name}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center p-4">
                          <SophisticatedEmptyState
                            icon={FileText}
                            title="Site Plans"
                            description="Upload floor plans, site layouts, or property plans to help agents understand your space requirements."
                            benefit="Detailed plans help agents assess whether available properties match your spatial needs and layout preferences."
                            actionText="Upload Site Plans"
                            onAction={() => openQuickAddModal('uploadSitePlans')}
                            examples={["Floor plans", "Site layout", "Building sections", "CAD drawings"]}
                            showBenefits={false}
                            showExamples={false}
                          />
                        </div>
                      )}
                    </div>
                  )}

                {visualView === 'fitouts' && (
                  <div className="h-full">
                    {listingData.fitOutFiles && listingData.fitOutFiles.length > 0 ? (
                      <div className="h-full overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-white font-semibold text-xl">Fit-Out Examples</h3>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-white hover:bg-white/10"
                              onClick={() => openQuickAddModal('uploadFitOuts')}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        </div>
                          <div className="grid grid-cols-1 gap-4">
                            {listingData.fitOutFiles.map((file) => (
                              <div key={file.id} className="bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-white/20 transition-colors group">
                                {file.mimeType?.startsWith('image/') ? (
                                  <div className="relative">
                                    <img
                                      src={file.url}
                                      alt={file.name}
                                      className="w-full h-48 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-white hover:bg-white/20"
                                        onClick={() => handleViewFile(file)}
                                      >
                                        <Eye className="w-4 h-4 mr-1" />
                                        View
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-red-300 hover:bg-red-500/20"
                                        onClick={() => handleDeleteFile(file, 'fitouts')}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                ) : file.isVideo ? (
                                  <div className="relative">
                                    <video 
                                      src={file.url}
                                      className="w-full h-48 object-cover"
                                      controls={false}
                                      poster={file.thumbnail}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-white hover:bg-white/20"
                                        onClick={() => handleViewFile(file)}
                                      >
                                        <Eye className="w-4 h-4 mr-1" />
                                        Play
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-red-300 hover:bg-red-500/20"
                                        onClick={() => handleDeleteFile(file, 'fitouts')}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-6 h-6 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium text-sm truncate">{file.name}</p>
                                        <p className="text-violet-200 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                                      </div>
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
                                          onClick={() => handleDeleteFile(file, 'siteplans')}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <div className="p-3">
                                  <p className="text-white text-sm font-medium truncate">{file.name}</p>
                                  {file.caption && (
                                    <p className="text-violet-200 text-xs mt-1">{file.caption}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center p-4">
                          <SophisticatedEmptyState
                            icon={Building2}
                            title="Fit-Out Examples"
                            description="Upload images or videos of your ideal space design to help agents understand your style preferences."
                            benefit="Agents can better match your requirements and present more relevant opportunities when they understand your aesthetic preferences."
                            actionText="Upload Fit-Out Examples"
                            onAction={() => openQuickAddModal('uploadFitOuts')}
                            examples={["Modern office", "Industrial style", "Traditional workspace", "Creative space"]}
                            showBenefits={false}
                            showExamples={false}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

              {/* Content Type Indicators (matching public modal exactly) */}
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md rounded-full p-2">
                  <button
                    onClick={() => setVisualView('map')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setVisualView('map');
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent ${
                      visualView === 'map'
                        ? 'bg-white/20 text-white border-2 border-white/60 shadow-lg'
                        : 'text-white/70 hover:bg-white/10 hover:text-white border border-white/20'
                    }`}
                    title="Switch to map view"
                    aria-pressed={visualView === 'map'}
                    aria-label="Map view toggle"
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="whitespace-nowrap">Map</span>
                  </button>
                  <button
                    onClick={() => setVisualView('siteplans')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent ${
                      visualView === 'siteplans'
                        ? 'bg-white/20 text-white border-2 border-white/60 shadow-lg'
                        : 'text-white/70 hover:bg-white/10 hover:text-white border border-white/20'
                    }`}
                    title="Switch to site plans view"
                    aria-pressed={visualView === 'siteplans'}
                    aria-label="Site plans view toggle"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="whitespace-nowrap">Site-Plans</span>
                    {listingData.sitePlanFiles && listingData.sitePlanFiles.length > 0 && (
                      <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                        {listingData.sitePlanFiles.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setVisualView('fitouts')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent ${
                      visualView === 'fitouts'
                        ? 'bg-white/20 text-white border-2 border-white/60 shadow-lg'
                        : 'text-white/70 hover:bg-white/10 hover:text-white border border-white/20'
                    }`}
                    title="Switch to fit-out examples view"
                    aria-pressed={visualView === 'fitouts'}
                    aria-label="Fit-out examples view toggle"
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="whitespace-nowrap">Fit-Outs</span>
                    {listingData.fitOutFiles && listingData.fitOutFiles.length > 0 && (
                      <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                        {listingData.fitOutFiles.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Location Count Badge (like public modal) */}
              {visualView === 'map' && (
                <div className="absolute top-6 left-6 px-3 py-2 rounded-full text-sm font-medium bg-white/20 backdrop-blur-md text-white">
                  {listingData.locations && listingData.locations.length > 0 
                    ? `${listingData.locations.length} ${listingData.locations.length === 1 ? 'Location' : 'Locations'}`
                    : 'Nationwide'
                  }
                </div>
              )}
            </div>
          </div>

          {/* Information Panel - 60% width (matching modal) */}
          <div className="w-3/5 h-full overflow-y-auto">
            {/* Company Hero Card (matching modal) */}
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-4">
                {listingData.logoPreview ? (
                  <img
                    src={listingData.logoPreview}
                    alt={`${companyName} logo`}
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {companyName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {companyName}
                  </h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span>{listingData.listingType === 'residential' ? 'Residential' : 'Commercial'}</span>
                    <span>📍 {listingData.locations && listingData.locations.length > 0 ? `${listingData.locations.length} Locations` : 'Nationwide'}</span>
                    {listingData.siteSizeMin && listingData.siteSizeMax && (
                      <span>📐 {listingData.siteSizeMin} - {listingData.siteSizeMax} sq ft</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${statusInfo.bgColor}`}>
                      <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
                      <span className={`text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation with Completion Indicators */}
            <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
              <div className="flex">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 hover:bg-gray-50",
                      "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-inset",
                      activeTab === tab.id
                        ? "border-violet-500 text-violet-600 bg-violet-50/50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`panel-${tab.id}`}
                    aria-describedby={completionStatus[tab.id as keyof typeof completionStatus] ? `status-${tab.id}` : undefined}
                  >
                    <div className="relative flex items-center justify-center">
                      <span>
                        {tab.id === 'overview' ? `From ${companyName}` :
                         tab.id === 'faqs' ? 'FAQs' : 
                         tab.label.charAt(0).toUpperCase() + tab.label.slice(1)}
                      </span>
                      <CompletionIndicator 
                        status={completionStatus[tab.id as keyof typeof completionStatus]} 
                        tabId={tab.id} 
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          
              {/* Overview Tab Content (matching modal exactly) */}
              {activeTab === 'overview' && (
                <div className="p-6 space-y-6">
                  <h3 className="text-lg font-semibold">Requirements In {companyName}'s Own Words</h3>

                  {/* Requirements Brochure */}
                  {listingData.brochureFiles && listingData.brochureFiles.length > 0 ? (
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <span className="text-blue-500">📋</span>
                          Requirements Brochure
                        </h4>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                      {listingData.brochureFiles.map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              View detailed property requirements
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-blue-600 group-hover:text-blue-700">
                            <span className="text-xs font-medium">Download</span>
                            <ExternalLink className="w-4 h-4" />
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 border-dashed">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <span className="text-blue-500">📋</span>
                          Requirements Brochure
                        </h4>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                          <Plus className="w-3 h-3 mr-1" />
                          Add Brochure
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600">Upload your property requirements brochure to help agents understand your needs.</p>
                    </div>
                  )}

                  {/* Property Page Link */}
                  {listingData.propertyPageLink ? (
                    <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <span className="text-violet-500">🔗</span>
                          Property Page
                        </h4>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                      <a
                        href={listingData.propertyPageLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 transition-all duration-200 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-200 transition-colors">
                          <ExternalLink className="w-5 h-5 text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            View Requirement Details
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {listingData.propertyPageLink}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-violet-600 group-hover:text-violet-700">
                          <span className="text-xs font-medium">Visit</span>
                          <ExternalLink className="w-4 h-4" />
                        </div>
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-violet-50 border border-violet-200 border-dashed">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <span className="text-violet-500">🔗</span>
                          Property Page
                        </h4>
                        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                          <Plus className="w-3 h-3 mr-1" />
                          Add Link
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600">Link to your existing property details page or requirements document.</p>
                    </div>
                  )}

                  {/* Empty state if no overview content */}
                  {!listingData.brochureFiles?.length && !listingData.propertyPageLink && (
                    <div className="p-8 rounded-lg bg-gray-50 text-center border border-gray-200">
                      <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-violet-500" />
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">Add Your Requirements Overview</h4>
                      <p className="text-gray-600 text-sm max-w-sm mx-auto mb-4">
                        Upload a brochure or link to your property page to help agents understand your requirements.
                      </p>
                      <div className="flex justify-center gap-2">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                          <Plus className="w-3 h-3 mr-1" />
                          Add Brochure
                        </Button>
                        <Button size="sm" variant="outline">
                          <Plus className="w-3 h-3 mr-1" />
                          Add Link
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Requirements Tab Content (matching modal exactly) */}
              {activeTab === 'requirements' && (
                <div className="p-6 space-y-6">
                  <h3 className="text-lg font-semibold">Requirements</h3>
                  
                  {editingSection === 'requirements' ? (
                    // Editing Mode
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Edit Requirements</h4>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEditing}>
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => saveSection('requirements', editingData)} className="bg-violet-600 hover:bg-violet-700 text-white">
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Min Size (sq ft)</label>
                          <Input
                            type="number"
                            placeholder="e.g. 1000"
                            value={editingData.siteSizeMin || ''}
                            onChange={(e) => setEditingData((prev: any) => ({ ...prev, siteSizeMin: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Max Size (sq ft)</label>
                          <Input
                            type="number"
                            placeholder="e.g. 5000"
                            value={editingData.siteSizeMax || ''}
                            onChange={(e) => setEditingData((prev: any) => ({ ...prev, siteSizeMax: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Site Size Requirements */}
                      {listingData.listingType === 'commercial' && (listingData.siteSizeMin || listingData.siteSizeMax) ? (
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-violet-500">📐</span>
                              Site Size
                            </h4>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => startEditing('requirements', { siteSizeMin: listingData.siteSizeMin, siteSizeMax: listingData.siteSizeMax })}>
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                          <p className="text-gray-700">
                            {listingData.siteSizeMin && listingData.siteSizeMax 
                              ? `${listingData.siteSizeMin.toLocaleString()} - ${listingData.siteSizeMax.toLocaleString()} sq ft`
                              : listingData.siteSizeMin 
                                ? `From ${listingData.siteSizeMin.toLocaleString()} sq ft`
                                : `Up to ${listingData.siteSizeMax?.toLocaleString()} sq ft`
                            }
                          </p>
                        </div>
                      ) : listingData.listingType === 'commercial' ? (
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 border-dashed">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-violet-500">📐</span>
                              Site Size
                            </h4>
                            <Button size="sm" onClick={() => startEditing('requirements', {})} className="bg-violet-600 hover:bg-violet-700 text-white">
                              <Plus className="w-3 h-3 mr-1" />
                              Add Size Requirements
                            </Button>
                          </div>
                          <p className="text-gray-600 text-sm">Specify your minimum and maximum space requirements.</p>
                        </div>
                      ) : null}

                      {/* Dwelling Count (for residential) */}
                      {listingData.listingType === 'residential' && (listingData.dwellingCountMin || listingData.dwellingCountMax) ? (
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-violet-500">🏠</span>
                              Dwelling Count
                            </h4>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                          <p className="text-gray-700">
                            {listingData.dwellingCountMin && listingData.dwellingCountMax 
                              ? `${listingData.dwellingCountMin} - ${listingData.dwellingCountMax} dwellings`
                              : listingData.dwellingCountMin 
                                ? `From ${listingData.dwellingCountMin} dwellings`
                                : `Up to ${listingData.dwellingCountMax} dwellings`
                            }
                          </p>
                        </div>
                      ) : null}

                      {/* Site Acreage (for residential) */}
                      {listingData.listingType === 'residential' && (listingData.siteAcreageMin || listingData.siteAcreageMax) ? (
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-violet-500">🌾</span>
                              Site Acreage
                            </h4>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                          <p className="text-gray-700">
                            {listingData.siteAcreageMin && listingData.siteAcreageMax 
                              ? `${listingData.siteAcreageMin} - ${listingData.siteAcreageMax} acres`
                              : listingData.siteAcreageMin 
                                ? `From ${listingData.siteAcreageMin} acres`
                                : `Up to ${listingData.siteAcreageMax} acres`
                            }
                          </p>
                        </div>
                      ) : null}

                      {/* Sectors (for commercial) */}
                      {listingData.listingType === 'commercial' && listingData.sectors && listingData.sectors.length > 0 ? (
                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-blue-500">🏢</span>
                              Sectors
                            </h4>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {listingData.sectors.map((sectorId, index) => {
                              const sector = sectors.find(s => s.id === sectorId);
                              return (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200"
                                >
                                  {sector?.name || sectorId}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : listingData.listingType === 'commercial' ? (
                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 border-dashed">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-blue-500">🏢</span>
                              Sectors
                            </h4>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                              <Plus className="w-3 h-3 mr-1" />
                              Add Sectors
                            </Button>
                          </div>
                          <p className="text-gray-600 text-sm">Specify which industry sectors you're interested in.</p>
                        </div>
                      ) : null}

                      {/* Use Classes (for commercial) */}
                      {listingData.listingType === 'commercial' && listingData.useClassIds && listingData.useClassIds.length > 0 ? (
                        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-green-500">🏗️</span>
                              Use Classes
                            </h4>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {listingData.useClassIds.map((useClassId, index) => {
                              const useClass = useClasses.find(uc => uc.id === useClassId);
                              return (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200"
                                >
                                  {useClass?.name || useClassId}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : listingData.listingType === 'commercial' ? (
                        <div className="p-4 rounded-lg bg-green-50 border border-green-200 border-dashed">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-green-500">🏗️</span>
                              Use Classes
                            </h4>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                              <Plus className="w-3 h-3 mr-1" />
                              Add Use Classes
                            </Button>
                          </div>
                          <p className="text-gray-600 text-sm">Select the planning use classes that are suitable for your requirements.</p>
                        </div>
                      ) : null}

                      {/* Empty state */}
                      {((listingData.listingType === 'commercial' && 
                         !listingData.siteSizeMin && !listingData.siteSizeMax &&
                         (!listingData.sectors || listingData.sectors.length === 0) &&
                         (!listingData.useClassIds || listingData.useClassIds.length === 0)) ||
                        (listingData.listingType === 'residential' && 
                         !listingData.dwellingCountMin && !listingData.dwellingCountMax &&
                         !listingData.siteAcreageMin && !listingData.siteAcreageMax)) && (
                        <div className="p-8 rounded-lg bg-gray-50 text-center border border-gray-200">
                          <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Building2 className="w-8 h-8 text-violet-500" />
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-2">Add Your Requirements</h4>
                          <p className="text-gray-600 text-sm max-w-sm mx-auto mb-4">
                            Specify your property requirements to help agents find the right opportunities.
                          </p>
                          <Button onClick={() => startEditing('requirements', {})} className="bg-violet-600 hover:bg-violet-700 text-white">
                            <Plus className="w-4 h-4 mr-1" />
                            Add Requirements
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Locations Tab Content (matching modal exactly) */}
              {activeTab === 'locations' && (
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Locations</h3>
                  
                  {listingData.locations && listingData.locations.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-600">{listingData.locations.length} location(s) specified</span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Plus className="w-3 h-3 mr-1" />
                            Add Location
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-3 h-3 mr-1" />
                            Edit All
                          </Button>
                        </div>
                      </div>
                      {listingData.locations.map((location, index) => (
                        <div 
                          key={location.id || index} 
                          className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-violet-600" />
                          </div>
                          <span className="text-gray-700 flex-1">
                            {location.place_name || location.formatted_address || 'Unknown location'}
                          </span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-800 flex items-center gap-2">
                            <span className="text-xl">🌍</span> Nationwide Coverage
                          </p>
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                              <Plus className="w-3 h-3 mr-1" />
                              Add Specific Locations
                            </Button>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">
                          This listing is open to opportunities across the UK & Ireland
                        </p>
                      </div>
                      
                      <div className="p-8 rounded-lg bg-gray-50 text-center border border-gray-200 border-dashed">
                        <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <MapPin className="w-8 h-8 text-violet-500" />
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">Add Preferred Locations</h4>
                        <p className="text-gray-600 text-sm max-w-sm mx-auto mb-4">
                          Specify particular areas or regions where you're looking for properties.
                        </p>
                        <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                          <Plus className="w-4 h-4 mr-1" />
                          Add Locations
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Contact Tab Content (matching modal exactly) */}
              {activeTab === 'contact' && (
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Contact</h3>
                  
                  <div className="space-y-4">
                    {/* Primary Contact */}
                    {listingData.primaryContact && (
                      <div className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200">
                        <div className="flex items-start gap-4">
                          {listingData.primaryContact.headshotUrl ? (
                            <img
                              src={listingData.primaryContact.headshotUrl}
                              alt={listingData.primaryContact.contactName || 'Contact'}
                              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-violet-600 text-lg font-medium">
                                {listingData.primaryContact.contactName ? listingData.primaryContact.contactName.charAt(0).toUpperCase() : 'C'}
                              </span>
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-gray-900">{listingData.primaryContact.contactName || 'Contact Name'}</h4>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{listingData.primaryContact.contactTitle || 'Contact Title'}</p>
                            {listingData.primaryContact.contactArea && (
                              <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full mt-1">
                                {listingData.primaryContact.contactArea}
                              </span>
                            )}
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <a 
                                  href={`mailto:${listingData.primaryContact.contactEmail}`} 
                                  className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium"
                                >
                                  {listingData.primaryContact.contactEmail}
                                </a>
                              </div>
                              {listingData.primaryContact.contactPhone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <a 
                                    href={`tel:${listingData.primaryContact.contactPhone}`} 
                                    className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium"
                                  >
                                    {listingData.primaryContact.contactPhone}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Additional Contacts */}
                    {listingData.additionalContacts && listingData.additionalContacts.length > 0 && (
                      <>
                        <div className="flex items-center justify-between pt-4">
                          <h4 className="font-medium text-gray-900">Additional Team Members</h4>
                          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                            <Plus className="w-3 h-3 mr-1" />
                            Add Team Member
                          </Button>
                        </div>
                        {listingData.additionalContacts.map((contact, index) => (
                          <div 
                            key={contact.id || index} 
                            className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200"
                          >
                            <div className="flex items-start gap-4">
                              {contact.headshotUrl ? (
                                <img
                                  src={contact.headshotUrl}
                                  alt={contact.contactName || 'Contact'}
                                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-violet-600 text-lg font-medium">
                                    {contact.contactName ? contact.contactName.charAt(0).toUpperCase() : 'C'}
                                  </span>
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-gray-900">{contact.contactName}</h4>
                                  <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm">
                                      <Edit className="w-3 h-3 mr-1" />
                                      Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                      <Trash2 className="w-3 h-3 mr-1" />
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{contact.contactTitle}</p>
                                {contact.contactArea && (
                                  <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full mt-1">
                                    {contact.contactArea}
                                  </span>
                                )}
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <a 
                                      href={`mailto:${contact.contactEmail}`} 
                                      className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium"
                                    >
                                      {contact.contactEmail}
                                    </a>
                                  </div>
                                  {contact.contactPhone && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      <a 
                                        href={`tel:${contact.contactPhone}`} 
                                        className="text-violet-600 hover:text-violet-700 transition-colors duration-200 font-medium"
                                      >
                                        {contact.contactPhone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Add Team Members Option */}
                    {(!listingData.additionalContacts || listingData.additionalContacts.length === 0) && (
                      <div className="p-6 rounded-lg bg-gray-50 text-center border border-gray-200 border-dashed">
                        <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Users className="w-8 h-8 text-violet-500" />
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">Add Team Members</h4>
                        <p className="text-gray-600 text-sm max-w-sm mx-auto mb-4">
                          Showcase additional contacts who will be involved in the property search process.
                        </p>
                        <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                          <Plus className="w-4 h-4 mr-1" />
                          Add Team Members
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FAQs Tab Content (matching modal exactly) */}
              {activeTab === 'faqs' && (
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
                  
                  {editingSection === 'faqs' ? (
                    // Editing Mode
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Edit FAQs</h4>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEditing}>
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => saveSection('faqs', editingData)} className="bg-violet-600 hover:bg-violet-700 text-white">
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {(editingData.faqs || []).map((faq: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4 space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-2">Question</label>
                              <Input
                                placeholder="e.g. What parking is available?"
                                value={faq.question || ''}
                                onChange={(e) => {
                                  const newFaqs = [...(editingData.faqs || [])];
                                  newFaqs[index] = { ...faq, question: e.target.value };
                                  setEditingData((prev: any) => ({ ...prev, faqs: newFaqs }));
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Answer</label>
                              <Textarea
                                placeholder="Provide a helpful answer..."
                                value={faq.answer || ''}
                                onChange={(e) => {
                                  const newFaqs = [...(editingData.faqs || [])];
                                  newFaqs[index] = { ...faq, answer: e.target.value };
                                  setEditingData((prev: any) => ({ ...prev, faqs: newFaqs }));
                                }}
                                rows={2}
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                const newFaqs = editingData.faqs.filter((_: any, i: number) => i !== index);
                                setEditingData((prev: any) => ({ ...prev, faqs: newFaqs }));
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => openQuickAddModal('faq')}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Another FAQ
                        </Button>
                        {(editingData.faqs || []).length === 0 && (
                          <TabEmptyState
                            icon={MessageSquare}
                            title="No FAQs Added Yet"
                            description="Add frequently asked questions to address common queries from agents and prospective tenants."
                            benefit="FAQs help filter qualified inquiries and demonstrate professionalism to potential partners."
                            actionText="Add First FAQ"
                            onAction={() => openQuickAddModal('faq')}
                            examples={["What's the lease length?", "Parking availability?", "Move-in timeline?", "Nearby amenities?"]}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {listingData.faqs && listingData.faqs.length > 0 ? (
                          <>
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-sm text-gray-600">{listingData.faqs.length} FAQ(s)</span>
                              <div className="flex items-center gap-2">
                                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add FAQ
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => startEditing('faqs', { faqs: listingData.faqs })}>
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit All
                                </Button>
                              </div>
                            </div>
                            {listingData.faqs.map((faq) => (
                              <div
                                key={faq.id}
                                className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:border-violet-200 transition-colors group"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 mb-2 flex items-start gap-2">
                                      <span className="text-violet-500 font-bold text-lg">Q:</span>
                                      {faq.question}
                                    </h4>
                                    <p className="text-gray-600 text-sm leading-relaxed pl-6">
                                      <span className="text-violet-500 font-bold mr-1">A:</span>
                                      {faq.answer}
                                    </p>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-4">
                                    <Button variant="ghost" size="sm">
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="p-8 rounded-lg bg-gray-50 text-center border border-gray-200">
                            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <MessageSquare className="w-8 h-8 text-violet-500" />
                            </div>
                            <h4 className="font-semibold text-gray-900 mb-2">No FAQs Available</h4>
                            <p className="text-gray-600 text-sm max-w-sm mx-auto mb-4">
                              Add frequently asked questions to help agents understand your requirements better.
                            </p>
                            <Button 
                              onClick={() => startEditing('faqs', { faqs: [] })}
                              className="bg-violet-600 hover:bg-violet-700 text-white"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add FAQs
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 p-4 rounded-lg bg-violet-50 border border-violet-200">
                        <h4 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          Still have questions?
                        </h4>
                        <button
                          onClick={() => setActiveTab('contact')}
                          className="text-violet-700 text-sm hover:text-violet-800 underline transition-colors"
                        >
                          Contact {companyName}'s team to find out more
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Add Modals */}
      <QuickAddFAQModal
        isOpen={quickAddModals.faq}
        onClose={() => closeQuickAddModal('faq')}
        onSave={handleQuickAddFAQ}
      />
      
      <QuickUploadModal
        isOpen={quickAddModals.uploadSitePlans}
        onClose={() => closeQuickAddModal('uploadSitePlans')}
        type="siteplans"
        onUpload={(files) => handleQuickUpload(files, 'siteplans')}
      />
      
      <QuickUploadModal
        isOpen={quickAddModals.uploadFitOuts}
        onClose={() => closeQuickAddModal('uploadFitOuts')}
        type="fitouts"
        onUpload={(files) => handleQuickUpload(files, 'fitouts')}
      />

    </div>
  );
}

