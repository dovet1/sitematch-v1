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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ImageUpload } from '@/components/ui/image-upload';
import { DocumentUpload } from '@/components/listings/document-upload';
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
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';

import { createClientClient } from '@/lib/supabase';
import { getSectors, getUseClasses } from '@/lib/listings';
import type { WizardFormData } from '@/types/wizard';
import type { Sector, UseClass } from '@/types/listings';
import { uploadFiles, validateFiles } from '@/lib/file-upload';
import type { FileUploadType, UploadedFile } from '@/types/uploads';
import { ImmersiveListingModal } from '@/components/listings/ImmersiveListingModal';
import { fetchCompanyLogo, validateDomain, normalizeDomain, formatDomainWithProtocol } from '@/lib/clearbit-logo';
import { getCurrentListingVersion } from '@/lib/version-management';

// Import CRUD modals
import { OverviewModal } from '@/components/listings/modals/overview-modal';
import { LocationsModal } from '@/components/listings/modals/locations-modal';
import { ContactsModal } from '@/components/listings/modals/contacts-modal';
import { FAQsModal } from '@/components/listings/modals/faqs-modal';
import { InteractiveMapView } from '@/components/listings/ImmersiveListingModal/components/VisualHeroSection/InteractiveMapView';
// Import separate requirements modals
import { SectorsModal } from '@/components/listings/modals/sectors-modal';  
import { UseClassesModal } from '@/components/listings/modals/use-classes-modal';
import { SiteSizeModal } from '@/components/listings/modals/site-size-modal';


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
  
  // Carousel state for site-plans and fit-outs
  const [sitePlansIndex, setSitePlansIndex] = useState(0);
  const [fitOutsIndex, setFitOutsIndex] = useState(0);

  // CRUD Modal states
  const [modalStates, setModalStates] = useState({
    overview: false,
    sectors: false,
    useClasses: false,
    siteSize: false,
    locations: false,
    contacts: false,
    faqs: false
  });

  const [editingContactData, setEditingContactData] = useState<any>(null);

  // FAQ accordion state
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());
  const [draggedFAQ, setDraggedFAQ] = useState<string | null>(null);
  const [editingFAQ, setEditingFAQ] = useState<string | null>(null);
  const [editingFAQData, setEditingFAQData] = useState<{question: string; answer: string}>({question: '', answer: ''});
  
  // Quick Add Modal states
  const [quickAddModals, setQuickAddModals] = useState({
    faq: false,
    contact: false,
    uploadSitePlans: false,
    uploadFitOuts: false,
    uploadLogo: false,
    uploadBrochure: false,
    requirements: false
  });

  // Logo method state for company profile
  const [logoLoading, setLogoLoading] = useState(false);
  const [domainError, setDomainError] = useState<string>('');
  
  // Form validation state
  const [formErrors, setFormErrors] = useState<{
    companyName?: string;
    companyDomain?: string;
    propertyPageLink?: string;
  }>({});



  const tabs = [
    { id: 'overview', label: 'overview' },
    { id: 'requirements', label: 'requirements' },
    { id: 'locations', label: 'locations' },
    { id: 'contact', label: 'contact' },
    { id: 'faqs', label: 'faqs' }
  ];

  // Get company name for tab display
  const companyName = listingData?.companyName || 'Company';

  // Format names for human readability
  const formatName = (name: string): string => {
    return name
      .split(/[\s_-]+/) // Split on spaces, underscores, hyphens
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

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

  // Fetch listing data function
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
        { data: files },
        { data: listingSectors },
        { data: listingUseClasses }
      ] = await Promise.all([
        supabase.from('listing_contacts').select('*').eq('listing_id', listingId),
        supabase.from('listing_locations').select('*').eq('listing_id', listingId),
        supabase.from('faqs').select('*').eq('listing_id', listingId).order('display_order'),
        supabase.from('file_uploads').select('*').eq('listing_id', listingId),
        supabase.from('listing_sectors').select('sector_id').eq('listing_id', listingId),
        supabase.from('listing_use_classes').select('use_class_id').eq('listing_id', listingId)
      ]);
      
      console.log('Fetched contacts from DB:', contacts);
      console.log('First contact headshot_url:', contacts?.[0]?.headshot_url);

      // Transform data to match WizardFormData structure
      const transformedData: ListingData = {
        id: listing.id,
        companyName: listing.company_name,
        listingType: listing.listing_type as 'commercial' | 'residential',
        status: listing.status,
        created_at: listing.created_at,
        updated_at: listing.updated_at,
        completion_percentage: listing.completion_percentage || 20,
        
        // Primary contact from listing_contacts table
        primaryContact: (() => {
          const primaryContact = contacts?.find(c => c.is_primary_contact);
          return primaryContact ? {
            contactName: primaryContact.contact_name || '',
            contactTitle: primaryContact.contact_title || '',
            contactEmail: primaryContact.contact_email || '',
            contactPhone: primaryContact.contact_phone || '',
            contactArea: primaryContact.contact_area || '',
            isPrimaryContact: true,
            headshotUrl: primaryContact.headshot_url || ''
          } : {
            contactName: '',
            contactTitle: '',
            contactEmail: '',
            contactPhone: '',
            contactArea: '',
            isPrimaryContact: true,
            headshotUrl: ''
          };
        })(),

        // Logo information - will be set after async logo fetch
        logoMethod: listing.clearbit_logo ? 'clearbit' : 'upload',
        clearbitLogo: listing.clearbit_logo || false,
        companyDomain: listing.company_domain || '',
        logoUrl: '', // Will be fetched async
        logoPreview: '', // Will be fetched async

        // Property page link
        propertyPageLink: listing.property_page_link || '',

        // Requirements
        siteSizeMin: listing.site_size_min,
        siteSizeMax: listing.site_size_max,
        dwellingCountMin: listing.dwelling_count_min,
        dwellingCountMax: listing.dwelling_count_max,
        siteAcreageMin: listing.site_acreage_min,
        siteAcreageMax: listing.site_acreage_max,
        sectors: listingSectors?.map(ls => ls.sector_id) || [],
        useClassIds: listingUseClasses?.map(luc => luc.use_class_id) || [],

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
        additionalContacts: contacts?.filter(c => !c.is_primary_contact).map(contact => {
          console.log('Mapping additional contact:', contact.contact_name, 'headshot_url:', contact.headshot_url);
          return {
            id: contact.id,
            contactName: contact.contact_name,
            contactTitle: contact.contact_title,
            contactEmail: contact.contact_email,
            contactPhone: contact.contact_phone,
            contactArea: contact.contact_area,
            isPrimaryContact: false,
            headshotUrl: contact.headshot_url
          };
        }) || [],

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

      // Fetch logo URL based on the new logic
      try {
        const logoUrl = await getLogoUrl(listing);
        if (logoUrl) {
          setListingData(prev => prev ? {
            ...prev,
            logoUrl,
            logoPreview: logoUrl
          } : null);
        }
      } catch (logoError) {
        console.error('Error fetching logo:', logoError);
        // Don't fail the whole page load if logo fails
      }

    } catch (err) {
      console.error('Error fetching listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to load listing');
    } finally {
      setLoading(false);
    }
  };

  // Fetch listing data on component mount
  useEffect(() => {
    fetchListingData();
  }, [listingId, userId]);

  // Carousel navigation functions
  const nextSitePlan = () => {
    const sitePlanFiles = listingData?.sitePlanFiles;
    if (sitePlanFiles && sitePlanFiles.length > 0) {
      setSitePlansIndex((prev) => (prev + 1) % sitePlanFiles.length);
    }
  };

  const prevSitePlan = () => {
    const sitePlanFiles = listingData?.sitePlanFiles;
    if (sitePlanFiles && sitePlanFiles.length > 0) {
      setSitePlansIndex((prev) => (prev - 1 + sitePlanFiles.length) % sitePlanFiles.length);
    }
  };

  const nextFitOut = () => {
    const fitOutFiles = listingData?.fitOutFiles;
    if (fitOutFiles && fitOutFiles.length > 0) {
      setFitOutsIndex((prev) => (prev + 1) % fitOutFiles.length);
    }
  };

  const prevFitOut = () => {
    const fitOutFiles = listingData?.fitOutFiles;
    if (fitOutFiles && fitOutFiles.length > 0) {
      setFitOutsIndex((prev) => (prev - 1 + fitOutFiles.length) % fitOutFiles.length);
    }
  };

  // Modal helper functions
  const openModal = (modalType: keyof typeof modalStates) => {
    if (modalType === 'contacts') {
      // Clear editing contact data when opening in add mode
      setEditingContactData(null);
    }
    setModalStates(prev => ({ ...prev, [modalType]: true }));
  };

  const closeModal = (modalType: keyof typeof modalStates) => {
    setModalStates(prev => ({ ...prev, [modalType]: false }));
    if (modalType === 'contacts') {
      setEditingContactData(null);
    }
  };

  // FAQ accordion toggle function
  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(faqId)) {
        newExpanded.delete(faqId);
      } else {
        newExpanded.add(faqId);
      }
      return newExpanded;
    });
  };

  // FAQ reordering functions
  const moveFAQ = async (fromIndex: number, toIndex: number) => {
    if (!listingData?.faqs) return;

    const newFaqs = [...listingData.faqs];
    const [movedFaq] = newFaqs.splice(fromIndex, 1);
    newFaqs.splice(toIndex, 0, movedFaq);

    // Update the display order in the database
    try {
      const supabase = createClientClient();
      
      // Update each FAQ with its new display order
      const updates = newFaqs.map((faq, index) => ({
        id: faq.id,
        display_order: index
      }));

      for (const update of updates) {
        await supabase
          .from('faqs')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      // Update local state
      setListingData(prev => prev ? { ...prev, faqs: newFaqs } : null);
      toast.success('FAQ order updated');
    } catch (error) {
      console.error('Error reordering FAQs:', error);
      toast.error('Failed to reorder FAQs');
    }
  };

  const handleDragStart = (e: React.DragEvent, faqId: string) => {
    setDraggedFAQ(faqId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetFaqId: string) => {
    e.preventDefault();
    
    if (!draggedFAQ || !listingData?.faqs) return;
    
    const fromIndex = listingData.faqs.findIndex(faq => faq.id === draggedFAQ);
    const toIndex = listingData.faqs.findIndex(faq => faq.id === targetFaqId);
    
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      moveFAQ(fromIndex, toIndex);
    }
    
    setDraggedFAQ(null);
  };

  const handleDragEnd = () => {
    setDraggedFAQ(null);
  };

  // FAQ editing functions
  const startEditingFAQ = (faq: any) => {
    setEditingFAQ(faq.id);
    setEditingFAQData({
      question: faq.question || '',
      answer: faq.answer || ''
    });
    // Expand the FAQ when editing
    setExpandedFAQs(prev => new Set([...Array.from(prev), faq.id]));
  };

  const cancelEditingFAQ = () => {
    setEditingFAQ(null);
    setEditingFAQData({question: '', answer: ''});
  };

  const saveEditingFAQ = async () => {
    if (!editingFAQ || !editingFAQData.question.trim() || !editingFAQData.answer.trim()) {
      toast.error('Please fill in both question and answer');
      return;
    }

    try {
      const supabase = createClientClient();
      
      const { error } = await supabase
        .from('faqs')
        .update({
          question: editingFAQData.question.trim(),
          answer: editingFAQData.answer.trim()
        })
        .eq('id', editingFAQ);

      if (error) throw error;

      // Update local state
      setListingData(prev => {
        if (!prev?.faqs) return prev;
        const updatedFaqs = prev.faqs.map(faq => 
          faq.id === editingFAQ 
            ? { ...faq, question: editingFAQData.question.trim(), answer: editingFAQData.answer.trim() }
            : faq
        );
        return { ...prev, faqs: updatedFaqs };
      });

      setEditingFAQ(null);
      setEditingFAQData({question: '', answer: ''});
      toast.success('FAQ updated successfully');
    } catch (error) {
      console.error('Error updating FAQ:', error);
      toast.error('Failed to update FAQ');
    }
  };

  const addNewFAQ = async () => {
    try {
      const supabase = createClientClient();
      
      // Create a new FAQ with empty values
      const newFAQ = {
        listing_id: listingId,
        question: '',
        answer: '',
        display_order: listingData?.faqs?.length || 0
      };
      
      const { data, error } = await supabase
        .from('faqs')
        .insert(newFAQ)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local state with the new FAQ
      setListingData(prev => {
        if (!prev) return prev;
        const updatedFaqs = [...(prev.faqs || []), {
          id: data.id,
          question: data.question,
          answer: data.answer,
          displayOrder: data.display_order
        }];
        return { ...prev, faqs: updatedFaqs };
      });
      
      // Automatically start editing the new FAQ
      setEditingFAQ(data.id);
      setEditingFAQData({
        question: '',
        answer: ''
      });
      
      // Expand the new FAQ
      setExpandedFAQs(prev => new Set([...Array.from(prev), data.id]));
      
      // Scroll to the new FAQ
      setTimeout(() => {
        const element = document.querySelector(`[data-faq-id="${data.id}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      
    } catch (error) {
      console.error('Error adding FAQ:', error);
      toast.error('Failed to add FAQ');
    }
  };

  const deleteFAQ = async (faqId: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const supabase = createClientClient();
      
      const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', faqId);

      if (error) throw error;

      // Update local state
      setListingData(prev => {
        if (!prev?.faqs) return prev;
        const updatedFaqs = prev.faqs.filter(faq => faq.id !== faqId);
        return { ...prev, faqs: updatedFaqs };
      });

      // Clean up any related state
      setExpandedFAQs(prev => {
        const newExpanded = new Set(prev);
        newExpanded.delete(faqId);
        return newExpanded;
      });

      if (editingFAQ === faqId) {
        cancelEditingFAQ();
      }

      toast.success('FAQ deleted successfully');
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      toast.error('Failed to delete FAQ');
    }
  };

  // CRUD functions for each section
  const handleOverviewSave = async (data: { brochureFiles?: any[]; propertyPageLink?: string }) => {
    try {
      const supabase = createClientClient();
      
      // Update listing with overview data
      const updates: any = {};
      if (data.propertyPageLink !== undefined) {
        updates.property_page_link = data.propertyPageLink;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('listings')
          .update(updates)
          .eq('id', listingId);

        if (error) throw error;
      }

      // Handle brochure files if provided
      if (data.brochureFiles) {
        // Update brochure files in the database
        // This would typically involve file upload handling
      }

      // Refresh listing data
      await fetchListingData();
      toast.success('Overview updated successfully');
    } catch (error) {
      console.error('Error updating overview:', error);
      toast.error('Failed to update overview');
      throw error;
    }
  };

  const handleSectorsSave = async (sectors: string[]) => {
    try {
      const supabase = createClientClient();
      
      // First, delete existing sectors for this listing
      const { error: deleteError } = await supabase
        .from('listing_sectors')
        .delete()
        .eq('listing_id', listingId);

      if (deleteError) throw deleteError;

      // Then, insert the new sectors
      if (sectors.length > 0) {
        const { error: insertError } = await supabase
          .from('listing_sectors')
          .insert(
            sectors.map(sectorId => ({
              listing_id: listingId,
              sector_id: sectorId
            }))
          );

        if (insertError) throw insertError;
      }

      // Refresh listing data
      await fetchListingData();
      toast.success('Sectors updated successfully');
    } catch (error) {
      console.error('Error updating sectors:', error);
      toast.error('Failed to update sectors');
      throw error;
    }
  };

  const handleUseClassesSave = async (useClasses: string[]) => {
    try {
      const supabase = createClientClient();
      
      // First, delete existing use classes for this listing
      const { error: deleteError } = await supabase
        .from('listing_use_classes')
        .delete()
        .eq('listing_id', listingId);

      if (deleteError) throw deleteError;

      // Then, insert the new use classes
      if (useClasses.length > 0) {
        const { error: insertError } = await supabase
          .from('listing_use_classes')
          .insert(
            useClasses.map(useClassId => ({
              listing_id: listingId,
              use_class_id: useClassId
            }))
          );

        if (insertError) throw insertError;
      }

      // Refresh listing data
      await fetchListingData();
      toast.success('Use classes updated successfully');
    } catch (error) {
      console.error('Error updating use classes:', error);
      toast.error('Failed to update use classes');
      throw error;
    }
  };

  const handleSiteSizeSave = async (data: any) => {
    try {
      const supabase = createClientClient();
      
      // Build updates based on listing type
      const updates: any = {};
      
      if (listingData?.listingType === 'commercial') {
        if (data.siteSizeMin !== undefined) updates.site_size_min = data.siteSizeMin;
        if (data.siteSizeMax !== undefined) updates.site_size_max = data.siteSizeMax;
      } else {
        if (data.dwellingCountMin !== undefined) updates.dwelling_count_min = data.dwellingCountMin;
        if (data.dwellingCountMax !== undefined) updates.dwelling_count_max = data.dwellingCountMax;
        if (data.siteAcreageMin !== undefined) updates.site_acreage_min = data.siteAcreageMin;
        if (data.siteAcreageMax !== undefined) updates.site_acreage_max = data.siteAcreageMax;
      }

      const { error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', listingId);

      if (error) throw error;

      // Refresh listing data
      await fetchListingData();
      toast.success('Property size updated successfully');
    } catch (error) {
      console.error('Error updating property size:', error);
      toast.error('Failed to update property size');
      throw error;
    }
  };

  const handleLocationsSave = async (locations: any[]) => {
    try {
      const supabase = createClientClient();
      
      // Clear existing locations
      const { error: deleteError } = await supabase
        .from('listing_locations')
        .delete()
        .eq('listing_id', listingId);

      if (deleteError) throw deleteError;

      // Insert new locations if any
      if (locations.length > 0) {
        const { error: insertError } = await supabase
          .from('listing_locations')
          .insert(
            locations.map(location => ({
              listing_id: listingId,
              place_name: location.name,
              coordinates: location.coordinates,
              formatted_address: location.name,
              region: location.region || '',
              country: location.country || 'UK'
            }))
          );

        if (insertError) throw insertError;
      }

      // Refresh listing data
      await fetchListingData();
      toast.success('Locations updated successfully');
    } catch (error) {
      console.error('Error updating locations:', error);
      toast.error('Failed to update locations');
      throw error;
    }
  };

  const handleLocationDelete = async (locationId: string) => {
    try {
      const supabase = createClientClient();
      
      // Delete the specific location from listing_locations
      const { error: deleteError } = await supabase
        .from('listing_locations')
        .delete()
        .eq('listing_id', listingId)
        .eq('id', locationId);

      if (deleteError) throw deleteError;

      // Refresh listing data
      await fetchListingData();
      toast.success('Location removed successfully');
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Failed to remove location');
      throw error;
    }
  };

  const handleContactsSave = async (data: { contacts: any[] }) => {
    try {
      const supabase = createClientClient();
      
      if (data.contacts.length === 1) {
        const contact = data.contacts[0];
        
        if (!contact.id) {
          // This is a new contact being added
          const { error: insertError } = await supabase
            .from('listing_contacts')
            .insert({
              listing_id: listingId,
              contact_name: contact.name,
              contact_title: contact.title,
              contact_email: contact.email,
              contact_phone: contact.phone || null,
              contact_area: contact.area || null,
              headshot_url: contact.headshotUrl || null,
              is_primary_contact: contact.isPrimary || false
            });

          if (insertError) throw insertError;
        } else {
          // This is editing an existing contact - update only this contact
          const updateData: any = {
            contact_name: contact.name,
            contact_title: contact.title,
            contact_email: contact.email,
            contact_phone: contact.phone || null,
            contact_area: contact.area || null,
            headshot_url: contact.headshotUrl || null,
            is_primary_contact: contact.isPrimary || false
          };

          let updateQuery;
          if (contact.id === 'primary') {
            // Update primary contact
            updateQuery = supabase
              .from('listing_contacts')
              .update(updateData)
              .eq('listing_id', listingId)
              .eq('is_primary_contact', true);
          } else {
            // Update specific contact by ID
            updateQuery = supabase
              .from('listing_contacts')
              .update(updateData)
              .eq('listing_id', listingId)
              .eq('id', contact.id);
          }

          const { error: updateError } = await updateQuery;
          if (updateError) throw updateError;
        }
      } else {
        // This is a full replacement (bulk editing mode) - delete all and replace
        const { error: deleteError } = await supabase
          .from('listing_contacts')
          .delete()
          .eq('listing_id', listingId);

        if (deleteError) throw deleteError;

        if (data.contacts.length > 0) {
          const { error: insertError } = await supabase
            .from('listing_contacts')
            .insert(
              data.contacts.map(contact => ({
                listing_id: listingId,
                contact_name: contact.name,
                contact_title: contact.title,
                contact_email: contact.email,
                contact_phone: contact.phone || null,
                contact_area: contact.area || null,
                headshot_url: contact.headshotUrl || null,
                is_primary_contact: contact.isPrimary || false
              }))
            );

          if (insertError) throw insertError;
        }
      }

      // Refresh listing data
      await fetchListingData();
      toast.success('Contact saved successfully');
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
      throw error;
    }
  };

  const handleEditContact = async (contactId: string, contactData: any) => {
    // Open the contacts modal with the specific contact data for editing
    setEditingContactData({
      id: contactId,
      name: contactData.contactName || '',
      title: contactData.contactTitle || '',
      email: contactData.contactEmail || '',
      phone: contactData.contactPhone || '',
      area: contactData.contactArea || '',
      headshotUrl: contactData.headshotUrl || '',
      isPrimary: contactId === 'primary'
    });
    setModalStates(prev => ({ ...prev, contacts: true }));
  };

  const handleDeleteContact = async (contactId: string) => {
    console.log('handleDeleteContact called with contactId:', contactId);
    try {
      const supabase = createClientClient();
      
      // First, check how many contacts exist for this listing
      const { data: existingContacts, error: countError } = await supabase
        .from('listing_contacts')
        .select('id')
        .eq('listing_id', listingId);

      if (countError) throw countError;
      
      console.log('Existing contacts count:', existingContacts?.length);

      // Prevent deletion if this is the only contact
      if (existingContacts && existingContacts.length <= 1) {
        console.log('Preventing deletion - only one contact remaining');
        
        // Show toast message
        toast.error('You must have at least one contact. Please add another contact before deleting this one.', {
          duration: 5000,
        });
        
        // Also show alert as backup to ensure user sees the message
        alert('You must have at least one contact. Please add another contact before deleting this one.');
        
        return;
      }
      
      if (contactId === 'primary') {
        // Delete primary contact
        const { error: deleteError } = await supabase
          .from('listing_contacts')
          .delete()
          .eq('listing_id', listingId)
          .eq('is_primary_contact', true);

        if (deleteError) throw deleteError;
      } else {
        // Delete additional contact by ID
        const { error: deleteError } = await supabase
          .from('listing_contacts')
          .delete()
          .eq('listing_id', listingId)
          .eq('id', contactId);

        if (deleteError) throw deleteError;
      }

      // Refresh listing data
      await fetchListingData();
      toast.success('Contact removed successfully');
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to remove contact');
      throw error;
    }
  };

  const handleFAQsSave = async (data: { faqs: any[] }) => {
    try {
      const supabase = createClientClient();
      
      // Delete existing FAQs and insert new ones
      const { error: deleteError } = await supabase
        .from('faqs')
        .delete()
        .eq('listing_id', listingId);

      if (deleteError) throw deleteError;

      if (data.faqs.length > 0) {
        const { error: insertError } = await supabase
          .from('faqs')
          .insert(
            data.faqs.map(faq => ({
              listing_id: listingId,
              question: faq.question,
              answer: faq.answer,
              display_order: faq.order || faq.displayOrder
            }))
          );

        if (insertError) throw insertError;
      }

      // Refresh listing data
      await fetchListingData();
      toast.success('FAQs updated successfully');
    } catch (error) {
      console.error('Error updating FAQs:', error);
      toast.error('Failed to update FAQs');
      throw error;
    }
  };


  // Keyboard navigation for carousels
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle keyboard navigation in visual hero sections
      if (visualView === 'siteplans' && listingData?.sitePlanFiles && listingData.sitePlanFiles.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevSitePlan();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextSitePlan();
        }
      } else if (visualView === 'fitouts' && listingData?.fitOutFiles && listingData.fitOutFiles.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevFitOut();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextFitOut();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [visualView, listingData?.sitePlanFiles, listingData?.fitOutFiles]);

  const handleSubmitForReview = async () => {
    if (!listingData) return;

    try {
      console.log('Submitting listing for review:', listingId);
      
      // Use the version management system to create a proper submission
      const { submitListingForReviewAction } = await import('@/lib/actions/submit-listing-for-review');
      const result = await submitListingForReviewAction(listingId);
      
      console.log('Submit result:', result);
      
      if (result.success) {
        toast.success('Listing submitted for review!');
        
        // Update local state
        setListingData(prev => prev ? { ...prev, status: 'pending' } : null);
        
        // Redirect to success page after short delay
        setTimeout(() => {
          router.push(`/occupier/listing/${listingId}/submitted`);
        }, 1500);
      } else {
        throw new Error(result.error || 'Failed to submit for review');
      }
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

  // This function will be defined later with proper validation

  // Quick Add Modal functions
  const openQuickAddModal = (type: keyof typeof quickAddModals) => {
    setQuickAddModals(prev => ({ ...prev, [type]: true }));
  };

  const closeQuickAddModal = (type: keyof typeof quickAddModals) => {
    setQuickAddModals(prev => ({ ...prev, [type]: false }));
  };

  // Handle logo update from logo modal
  const handleLogoUpdate = async (logoUrl: string, clearbitLogo: boolean = false) => {
    try {
      // Update listing with logo URL
      const supabase = createClientClient();
      const { error } = await supabase
        .from('listings')
        .update({ 
          logo_url: logoUrl,
          clearbit_logo: clearbitLogo,
          updated_at: new Date().toISOString() 
        })
        .eq('id', listingId);

      if (error) throw error;

      // Update local state
      setListingData(prev => prev ? {
        ...prev,
        logoPreview: logoUrl,
        clearbitLogo: clearbitLogo
      } : null);

      toast.success('Logo updated successfully!');
      closeQuickAddModal('uploadLogo');
    } catch (error) {
      console.error('Error updating logo:', error);
      toast.error('Failed to update logo');
    }
  };

  // Handle file uploads
  const handleFileUpload = async (files: File[], type: 'logo' | 'brochure') => {
    try {
      const uploadedFiles: any[] = [];
      
      // Upload files one by one using the same API as step1 component
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        formData.append('is_primary', 'true');
        formData.append('listingId', listingId);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to upload file:', errorText);
          throw new Error(`Upload failed: ${errorText}`);
        }
        
        const result = await response.json();
        uploadedFiles.push(result.file);
      }
      
      if (type === 'logo' && uploadedFiles.length > 0) {
        // Update listing with logo URL
        const supabase = createClientClient();
        const { error } = await supabase
          .from('listings')
          .update({ 
            logo_url: uploadedFiles[0].url,
            updated_at: new Date().toISOString() 
          })
          .eq('id', listingId);

        if (error) throw error;

        // Update local state
        setListingData(prev => prev ? {
          ...prev,
          logoPreview: uploadedFiles[0].url
        } : null);

        toast.success('Logo uploaded successfully!');
      } else if (type === 'brochure') {
        // First, delete existing brochure files to implement replacement logic
        const supabase = createClientClient();
        const existingBrochures = listingData?.brochureFiles || [];
        
        if (existingBrochures.length > 0) {
          // Delete old brochure files from storage and database
          for (const brochure of existingBrochures) {
            try {
              // Delete from storage
              await supabase.storage.from('brochures').remove([brochure.path]);
              
              // Delete from database
              await supabase
                .from('file_uploads')
                .delete()
                .eq('id', brochure.id);
            } catch (error) {
              console.error('Error deleting old brochure:', error);
              // Continue with upload even if deletion fails
            }
          }
        }

        // Update local state with new brochure files (replacement, not append)
        setListingData(prev => prev ? {
          ...prev,
          brochureFiles: uploadedFiles.map(file => ({
            id: file.id,
            name: file.name,
            url: file.url,
            path: file.path,
            type: 'brochure' as const,
            size: file.size,
            mimeType: file.mimeType,
            uploadedAt: new Date(file.uploadedAt)
          }))
        } : null);

        toast.success(`Brochure${uploadedFiles.length > 1 ? 's' : ''} replaced successfully!`);
      }

      // Close the upload modal
      closeQuickAddModal(type === 'logo' ? 'uploadLogo' : 'uploadBrochure');

    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(`Failed to upload ${type}`);
    }
  };

  // Clearbit logo fetching for company profile
  const fetchLogoForDomain = async (domain: string) => {
    if (!domain.trim()) return;

    // Only validate and fetch if it looks like a complete domain
    if (!validateDomain(domain)) {
      return;
    }

    setLogoLoading(true);
    setDomainError('');
    
    try {
      const logoUrl = await fetchCompanyLogo(domain);
      if (logoUrl) {
        // Update editing data immediately for form preview
        setEditingData((prev: any) => ({
          ...prev,
          logoPreview: logoUrl,
          clearbitLogo: true
        }));

        // Save Clearbit logo preference to database
        const supabase = createClientClient();
        
        // Delete any existing uploaded logo files since we're using Clearbit
        const { data: existingLogos } = await supabase
          .from('file_uploads')
          .select('id, file_path, bucket_name')
          .eq('listing_id', listingId)
          .eq('file_type', 'logo');

        if (existingLogos && existingLogos.length > 0) {
          // Delete logo files from storage
          for (const logo of existingLogos) {
            await supabase.storage.from(logo.bucket_name).remove([logo.file_path]);
          }
          
          // Delete logo records from file_uploads table
          await supabase
            .from('file_uploads')
            .delete()
            .eq('listing_id', listingId)
            .eq('file_type', 'logo');
        }

        const { error: dbError } = await supabase
          .from('listings')
          .update({ 
            clearbit_logo: true,
            updated_at: new Date().toISOString() 
          })
          .eq('id', listingId);

        if (dbError) {
          console.error('Database update error:', dbError);
          toast.error('Failed to save logo to listing');
          return;
        }

        // Update listing data state too
        setListingData(prev => prev ? {
          ...prev,
          logoPreview: logoUrl,
          clearbitLogo: true
        } : null);

        setDomainError('');
        toast.success('Logo found and saved!');
      } else {
        setEditingData((prev: any) => ({
          ...prev,
          logoPreview: '',
          clearbitLogo: false
        }));
        setDomainError('No logo found for this domain. Try uploading your own logo instead.');
      }
    } catch (error) {
      setEditingData((prev: any) => ({
        ...prev,
        logoPreview: '',
        clearbitLogo: false
      }));
      if (error instanceof Error) {
        setDomainError(error.message);
      } else {
        setDomainError('Failed to fetch logo. Please try again or upload your own logo.');
      }
    } finally {
      setLogoLoading(false);
    }
  };

  // Debounced logo fetching effect
  useEffect(() => {
    const domain = editingData.companyDomain;
    if (!domain || editingData.logoMethod !== 'clearbit') return;

    const timeoutId = setTimeout(() => {
      fetchLogoForDomain(domain);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [editingData.companyDomain, editingData.logoMethod]);

  // Logo upload handlers for the form
  const handleLogoFileUpload = async (file: File | null) => {
    if (!file) {
      setEditingData((prev: any) => ({ ...prev, logoPreview: '' }));
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');
      formData.append('is_primary', 'true');
      formData.append('listingId', listingId);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      
      // Update editing data immediately for form preview
      setEditingData((prev: any) => ({
        ...prev,
        logoPreview: result.file.url,
        clearbitLogo: false
      }));

      // Clean up old logo files and update database
      const supabase = createClientClient();
      
      // First, get all existing logo files for this listing to delete them
      const { data: existingLogos, error: fetchError } = await supabase
        .from('file_uploads')
        .select('id, file_path, bucket_name')
        .eq('listing_id', listingId)
        .eq('file_type', 'logo')
        .neq('id', result.file.id); // Don't delete the new one

      if (fetchError) {
        console.error('Error fetching existing logos:', fetchError);
      } else if (existingLogos && existingLogos.length > 0) {
        // Delete old logo files from storage
        for (const logo of existingLogos) {
          await supabase.storage.from(logo.bucket_name).remove([logo.file_path]);
        }
        
        // Delete old logo records from file_uploads table
        await supabase
          .from('file_uploads')
          .delete()
          .eq('listing_id', listingId)
          .eq('file_type', 'logo')
          .neq('id', result.file.id);
      }

      // Update listings table to mark as non-Clearbit logo
      const { error: dbError } = await supabase
        .from('listings')
        .update({ 
          clearbit_logo: false,
          updated_at: new Date().toISOString() 
        })
        .eq('id', listingId);

      if (dbError) {
        console.error('Database update error:', dbError);
        toast.error('Failed to save logo to listing');
        return;
      }

      // Update listing data state too (logo URL will be fetched from file_uploads)
      setListingData(prev => prev ? {
        ...prev,
        logoPreview: result.file.url,
        clearbitLogo: false
      } : null);

      toast.success('Logo uploaded successfully!');
      
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    }
  };

  const handleLogoPreviewChange = (preview: string | null) => {
    setEditingData((prev: any) => ({
      ...prev,
      logoPreview: preview || ''
    }));
  };

  // Helper function to get logo URL based on the logic
  const getLogoUrl = async (listing: any) => {
    if (listing.clearbit_logo && listing.company_domain) {
      // Use Clearbit API to get logo
      try {
        const logoUrl = await fetchCompanyLogo(listing.company_domain);
        return logoUrl || '';
      } catch (error) {
        console.error('Error fetching Clearbit logo:', error);
        return '';
      }
    } else {
      // Find the most recent uploaded logo from file_uploads table
      try {
        const supabase = createClientClient();
        const { data: logoFile, error } = await supabase
          .from('file_uploads')
          .select('*')
          .eq('listing_id', listing.id)
          .eq('file_type', 'logo')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !logoFile) {
          return '';
        }

        // Get public URL for the logo file
        const { data: urlData } = supabase.storage
          .from(logoFile.bucket_name)
          .getPublicUrl(logoFile.file_path);

        return urlData.publicUrl;
      } catch (error) {
        console.error('Error fetching uploaded logo:', error);
        return '';
      }
    }
  };

  // Form validation function
  const validateCompanyProfile = (data: any) => {
    const errors: { companyName?: string; companyDomain?: string; propertyPageLink?: string } = {};
    
    // Company name validation
    if (!data.companyName?.trim()) {
      errors.companyName = 'Company name is required';
    } else if (data.companyName.trim().length < 2) {
      errors.companyName = 'Company name must be at least 2 characters';
    } else if (data.companyName.trim().length > 100) {
      errors.companyName = 'Company name must be no more than 100 characters';
    }
    
    // Company domain validation (only required for Clearbit method)
    if (data.logoMethod === 'clearbit' && !data.companyDomain?.trim()) {
      errors.companyDomain = 'Company domain is required when using automatic logo detection';
    } else if (data.companyDomain?.trim() && !validateDomain(data.companyDomain.trim())) {
      errors.companyDomain = 'Please enter a valid domain like "company.com" (without www or https://)';
    }
    
    // Property page link validation
    if (data.propertyPageLink?.trim()) {
      const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
      if (!urlPattern.test(data.propertyPageLink.trim())) {
        errors.propertyPageLink = 'Please enter a valid URL starting with http:// or https://';
      }
    }
    
    return errors;
  };

  // Clear specific field error
  const clearFieldError = (fieldName: string) => {
    setFormErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName as keyof typeof newErrors];
      return newErrors;
    });
  };

  // Save section handler with validation
  const saveSection = async (section: string, data: any) => {
    if (section === 'companyProfile') {
      // Run validation
      const errors = validateCompanyProfile(data);
      setFormErrors(errors);
      
      // If there are validation errors, don't save
      if (Object.keys(errors).length > 0) {
        const errorMessages = Object.values(errors);
        toast.error(errorMessages[0]); // Show first error in toast
        return;
      }

      try {
        const supabase = createClientClient();
        
        // Prepare the update data
        const updateData: any = {
          company_name: data.companyName?.trim(),
          listing_type: data.listingType,
          property_page_link: data.propertyPageLink?.trim() || null,
          updated_at: new Date().toISOString()
        };

        // Only save domain if using Clearbit
        if (data.logoMethod === 'clearbit') {
          updateData.company_domain = data.companyDomain?.trim() || null;
          updateData.clearbit_logo = true;
        } else {
          // If switching from Clearbit to upload, clear domain and set flag
          updateData.company_domain = null;
          updateData.clearbit_logo = false;
        }

        const { error } = await supabase
          .from('listings')
          .update(updateData)
          .eq('id', listingId);

        if (error) throw error;

        // Update local state
        setListingData(prev => prev ? {
          ...prev,
          companyName: data.companyName?.trim(),
          listingType: data.listingType,
          companyDomain: data.logoMethod === 'clearbit' ? data.companyDomain?.trim() || null : null,
          propertyPageLink: data.propertyPageLink?.trim() || null,
          logoMethod: data.logoMethod,
          clearbitLogo: data.logoMethod === 'clearbit'
        } : null);

        // Close editing mode and clear validation errors
        setEditingSection(null);
        setEditingData({});
        setFormErrors({});
        
        toast.success('Company profile updated successfully!');
      } catch (error) {
        console.error('Error saving company profile:', error);
        toast.error('Failed to save company profile');
      }
    }
  };

  // Delete file function
  const deleteFile = async (fileId: string, fileType: 'brochure' | 'logo') => {
    try {
      const supabase = createClientClient();
      
      // First get the file info to delete from storage
      const { data: fileInfo, error: fetchError } = await supabase
        .from('file_uploads')
        .select('file_path, bucket_name')
        .eq('id', fileId)
        .single();

      if (fetchError || !fileInfo) {
        throw new Error('File not found');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(fileInfo.bucket_name)
        .remove([fileInfo.file_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue anyway - remove from database even if storage fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('file_uploads')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      // Update local state
      if (fileType === 'brochure') {
        setListingData(prev => prev ? {
          ...prev,
          brochureFiles: prev.brochureFiles?.filter(f => f.id !== fileId) || []
        } : null);
      }

      toast.success(`${fileType === 'brochure' ? 'Brochure' : 'File'} deleted successfully!`);
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(`Failed to delete ${fileType}`);
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

  // Action buttons are now integrated into the header layout

  return (
    <>
      {/* Fixed Layout Container - Below navbar */}
      <div className="fixed top-16 left-0 right-0 bottom-0 flex">
        {/* Visual Hero Section - Fixed, no scroll */}
        <div className="w-2/5 xl:w-[35%] 2xl:w-[30%] h-full bg-gradient-to-br from-violet-900 to-violet-700 overflow-hidden flex-shrink-0 relative">
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative h-full flex flex-col">

              {/* Main Visual Content Area (matching modal structure) */}
              <div className="flex-1 relative">
                {visualView === 'map' && (
                  <div className="h-full p-6">
                    {listingData.locations && listingData.locations.length > 0 ? (
                      <div className="h-full flex flex-col">
                        {/* Map container */}
                        <div className="flex-1 rounded-lg overflow-hidden shadow-lg">
                          <InteractiveMapView 
                            locations={listingData.locations.map(loc => ({
                              id: loc.id,
                              place_name: loc.place_name || loc.formatted_address || 'Unknown location',
                              coordinates: loc.coordinates
                            }))}
                          />
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex gap-3 justify-center mt-4">
                          <Button 
                            variant="ghost" 
                            className="text-white hover:bg-white/10 border border-white/20 px-6 py-2 backdrop-blur-sm" 
                            onClick={() => setActiveTab('locations')}
                          >
                            View Details
                          </Button>
                          <Button 
                            variant="ghost" 
                            className="text-white hover:bg-white/10 border border-white/20 px-6 py-2 backdrop-blur-sm" 
                            onClick={() => {
                              setEditingSection('locations');
                              setActiveTab('locations');
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add More
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Nationwide coverage display */
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="relative">
                            <div className="w-32 h-32 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                              <div className="text-center">
                                <div className="w-12 h-12 bg-violet-400/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                  <MapPin className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-xs text-violet-200">UK & Ireland</div>
                              </div>
                            </div>
                          </div>
                          
                          <h3 className="text-2xl font-bold text-white mb-3">
                            Nationwide Coverage
                          </h3>
                          <p className="text-violet-200 text-lg mb-6 max-w-sm mx-auto leading-relaxed">
                            Open to opportunities across the UK & Ireland
                          </p>
                          
                          <Button 
                            variant="ghost" 
                            className="text-white hover:bg-white/10 border border-white/20 px-6 py-2 backdrop-blur-sm" 
                            onClick={() => setActiveTab('locations')}
                          >
                            Add Locations
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {visualView === 'siteplans' && (
                  <div className="relative h-full w-full overflow-hidden group">
                    {listingData.sitePlanFiles && listingData.sitePlanFiles.length > 0 ? (
                      <>
                        {/* Main Carousel Image with Proper Aspect Ratio */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative w-full h-full max-h-full">
                            {(() => {
                              const currentFile = listingData.sitePlanFiles?.[sitePlansIndex];
                              return currentFile && currentFile.mimeType?.startsWith('image/') ? (
                                <img
                                  src={currentFile.url}
                                  alt={currentFile.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-violet-800">
                                  <div className="text-center p-8">
                                    <FileText className="w-16 h-16 text-white mx-auto mb-4" />
                                    <p className="text-white font-medium">{currentFile.name}</p>
                                    <p className="text-violet-200 text-sm mt-2">
                                      {(currentFile.size / 1024 / 1024).toFixed(1)} MB
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Overlay controls - Preview Modal Style */}
                            <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-gray-900 bg-white/95 hover:bg-white backdrop-blur-sm rounded-lg shadow-lg font-medium"
                                onClick={() => handleViewFile(listingData.sitePlanFiles?.[sitePlansIndex])}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-red-600 bg-white/95 hover:bg-white backdrop-blur-sm rounded-lg shadow-lg font-medium"
                                onClick={() => handleDeleteFile(listingData.sitePlanFiles?.[sitePlansIndex], 'siteplans')}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>

                            {/* Navigation arrows positioned relative to image */}
                            {listingData.sitePlanFiles.length > 1 && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button
                                  onClick={prevSitePlan}
                                  className="absolute left-6 top-1/2 transform -translate-y-1/2 z-20
                                           bg-white/95 hover:bg-white backdrop-blur-sm rounded-full p-3
                                           text-gray-700 hover:text-gray-900 shadow-lg hover:shadow-xl 
                                           border border-white/20 hover:border-white/40
                                           transition-all duration-200 hover:scale-105"
                                  aria-label="Previous site plan"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                
                                <button
                                  onClick={nextSitePlan}
                                  className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20
                                           bg-white/95 hover:bg-white backdrop-blur-sm rounded-full p-3
                                           text-gray-700 hover:text-gray-900 shadow-lg hover:shadow-xl 
                                           border border-white/20 hover:border-white/40
                                           transition-all duration-200 hover:scale-105"
                                  aria-label="Next site plan"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Content Management Controls - Top Right */}
                        <div className="absolute top-6 right-6 z-20">
                          <div className="flex items-center gap-3">
                            {/* Counter styled like preview modal */}
                            {listingData.sitePlanFiles.length > 1 && (
                              <div className="bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded text-white text-sm font-medium shadow-lg">
                                {sitePlansIndex + 1}/{listingData.sitePlanFiles.length}
                              </div>
                            )}
                            
                            {/* Add Content Button - Preview Modal Style */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="bg-white/95 hover:bg-white text-gray-900 hover:text-gray-900 shadow-lg hover:shadow-xl rounded-lg px-3 py-2 transition-all duration-200 hover:scale-105 font-medium"
                              onClick={() => openQuickAddModal('uploadSitePlans')}
                              title="Add site plans"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              <span className="text-sm font-medium">Add</span>
                            </Button>
                          </div>
                        </div>

                        {/* Progressive Disclosure: Thumbnail strip (shows on hover when multiple images) */}
                        {listingData.sitePlanFiles.length > 1 && (
                          <div className="absolute bottom-6 left-6 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="flex gap-2 justify-center">
                              {listingData.sitePlanFiles.map((file, index) => (
                                <button
                                  key={file.id}
                                  onClick={() => setSitePlansIndex(index)}
                                  className={`w-16 h-12 rounded-lg overflow-hidden transition-all duration-200 backdrop-blur-sm ${
                                    index === sitePlansIndex 
                                      ? 'ring-2 ring-white/90 scale-110 shadow-lg' 
                                      : 'ring-1 ring-white/20 opacity-70 hover:opacity-90 hover:scale-105'
                                  }`}
                                >
                                  {file.mimeType?.startsWith('image/') ? (
                                    <img
                                      src={file.url}
                                      alt={`Site plan ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-violet-600/80 backdrop-blur-sm flex items-center justify-center">
                                      <FileText className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
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
                  <div className="relative h-full w-full overflow-hidden group">
                    {listingData.fitOutFiles && listingData.fitOutFiles.length > 0 ? (
                      <>
                        {/* Main Carousel Image/Video with Proper Aspect Ratio */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative w-full h-full max-h-full">
                            {(() => {
                              const currentFile = listingData.fitOutFiles?.[fitOutsIndex];
                              if (currentFile && currentFile.mimeType?.startsWith('image/')) {
                                return (
                                  <img
                                    src={currentFile.url}
                                    alt={currentFile.name}
                                    className="w-full h-full object-contain"
                                  />
                                );
                              } else if (currentFile.isVideo) {
                                return (
                                  <video 
                                    src={currentFile.url}
                                    className="w-full h-full object-contain"
                                    controls={false}
                                    poster={currentFile.thumbnail}
                                    loop
                                    muted
                                  />
                                );
                              } else {
                                return (
                                  <div className="w-full h-full flex items-center justify-center bg-violet-800">
                                    <div className="text-center p-8">
                                      <FileText className="w-16 h-16 text-white mx-auto mb-4" />
                                      <p className="text-white font-medium">{currentFile.name}</p>
                                      <p className="text-violet-200 text-sm mt-2">
                                        {(currentFile.size / 1024 / 1024).toFixed(1)} MB
                                      </p>
                                    </div>
                                  </div>
                                );
                              }
                            })()}

                            {/* Overlay controls - Preview Modal Style */}
                            <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-gray-900 bg-white/95 hover:bg-white backdrop-blur-sm rounded-lg shadow-lg font-medium"
                                onClick={() => handleViewFile(listingData.fitOutFiles?.[fitOutsIndex])}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                {listingData.fitOutFiles?.[fitOutsIndex]?.isVideo ? 'Play' : 'View'}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-red-600 bg-white/95 hover:bg-white backdrop-blur-sm rounded-lg shadow-lg font-medium"
                                onClick={() => handleDeleteFile(listingData.fitOutFiles?.[fitOutsIndex], 'fitouts')}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>

                            {/* Navigation arrows positioned relative to image */}
                            {listingData.fitOutFiles.length > 1 && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button
                                  onClick={prevFitOut}
                                  className="absolute left-6 top-1/2 transform -translate-y-1/2 z-20
                                           bg-white/95 hover:bg-white backdrop-blur-sm rounded-full p-3
                                           text-gray-700 hover:text-gray-900 shadow-lg hover:shadow-xl 
                                           border border-white/20 hover:border-white/40
                                           transition-all duration-200 hover:scale-105"
                                  aria-label="Previous fit-out"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                
                                <button
                                  onClick={nextFitOut}
                                  className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20
                                           bg-white/95 hover:bg-white backdrop-blur-sm rounded-full p-3
                                           text-gray-700 hover:text-gray-900 shadow-lg hover:shadow-xl 
                                           border border-white/20 hover:border-white/40
                                           transition-all duration-200 hover:scale-105"
                                  aria-label="Next fit-out"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Content Management Controls - Top Right */}
                        <div className="absolute top-6 right-6 z-20">
                          <div className="flex items-center gap-3">
                            {/* Counter styled like preview modal */}
                            {listingData.fitOutFiles.length > 1 && (
                              <div className="bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded text-white text-sm font-medium shadow-lg">
                                {fitOutsIndex + 1}/{listingData.fitOutFiles.length}
                              </div>
                            )}
                            
                            {/* Add Content Button - Preview Modal Style */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="bg-white/95 hover:bg-white text-gray-900 hover:text-gray-900 shadow-lg hover:shadow-xl rounded-lg px-3 py-2 transition-all duration-200 hover:scale-105 font-medium"
                              onClick={() => openQuickAddModal('uploadFitOuts')}
                              title="Add fit-out examples"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              <span className="text-sm font-medium">Add</span>
                            </Button>
                          </div>
                        </div>

                        {/* Progressive Disclosure: Thumbnail strip (shows on hover when multiple images) */}
                        {listingData.fitOutFiles.length > 1 && (
                          <div className="absolute bottom-6 left-6 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="flex gap-2 justify-center">
                              {listingData.fitOutFiles.map((file, index) => (
                                <button
                                  key={file.id}
                                  onClick={() => setFitOutsIndex(index)}
                                  className={`w-16 h-12 rounded-lg overflow-hidden transition-all duration-200 backdrop-blur-sm ${
                                    index === fitOutsIndex 
                                      ? 'ring-2 ring-white/90 scale-110 shadow-lg' 
                                      : 'ring-1 ring-white/20 opacity-70 hover:opacity-90 hover:scale-105'
                                  }`}
                                >
                                  {file.mimeType?.startsWith('image/') ? (
                                    <img
                                      src={file.url}
                                      alt={`Fit-out ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : file.isVideo ? (
                                    <div className="relative w-full h-full">
                                      <video
                                        src={file.url}
                                        className="w-full h-full object-cover"
                                        poster={file.thumbnail}
                                      />
                                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                        <div className="w-4 h-4 bg-white/80 rounded-full flex items-center justify-center">
                                          <div className="w-0 h-0 border-l-2 border-l-black border-y-transparent border-y-[1px] ml-0.5"></div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-full h-full bg-violet-600/80 backdrop-blur-sm flex items-center justify-center">
                                      <FileText className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
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

              {/* Bottom Navigation - Styled like Preview Modal */}
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
                <div className="flex items-center gap-1 p-1.5 bg-black/60 backdrop-blur-lg rounded-lg border border-white/10 shadow-2xl">
                  <button
                    onClick={() => setVisualView('map')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setVisualView('map');
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-transparent ${
                      visualView === 'map'
                        ? 'bg-white text-gray-900 shadow-md'
                        : 'text-white/90 hover:bg-white/15 hover:text-white'
                    }`}
                    title="Switch to map view"
                    aria-pressed={visualView === 'map'}
                    aria-label="Map view toggle"
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="whitespace-nowrap">Coverage</span>
                  </button>
                  <button
                    onClick={() => setVisualView('fitouts')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-transparent ${
                      visualView === 'fitouts'
                        ? 'bg-white text-gray-900 shadow-md'
                        : 'text-white/90 hover:bg-white/15 hover:text-white'
                    }`}
                    title="Switch to fit-out examples view"
                    aria-pressed={visualView === 'fitouts'}
                    aria-label="Fit-out examples view toggle"
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="whitespace-nowrap">Fit-Outs</span>
                    {listingData.fitOutFiles && listingData.fitOutFiles.length > 0 && (
                      <span className="bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded ml-1.5 font-semibold">
                        {listingData.fitOutFiles.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setVisualView('siteplans')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-transparent ${
                      visualView === 'siteplans'
                        ? 'bg-white text-gray-900 shadow-md'
                        : 'text-white/90 hover:bg-white/15 hover:text-white'
                    }`}
                    title="Switch to site plans view"
                    aria-pressed={visualView === 'siteplans'}
                    aria-label="Site plans view toggle"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="whitespace-nowrap">Site-Plans</span>
                    {listingData.sitePlanFiles && listingData.sitePlanFiles.length > 0 && (
                      <span className="bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded ml-1.5 font-semibold">
                        {listingData.sitePlanFiles.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Global Navigation - Preview Modal Style */}
              <div className="absolute top-6 left-6 z-30">
                <Button
                  variant="ghost"
                  size="default"
                  onClick={() => router.push('/occupier/dashboard')}
                  className="text-gray-900 hover:text-gray-900 font-medium bg-white/95 hover:bg-white shadow-lg hover:shadow-xl transition-all duration-200 px-4 py-2.5 rounded-lg border border-white/20"
                >
                  ← Dashboard
                </Button>
              </div>
            </div>
          </div>

        {/* Information Panel - Scrollable */}
        <div className="flex-1 h-full overflow-y-auto bg-white relative z-10">
          {/* Action buttons are now in the header */}
            {/* Company Hero Card - Redesigned for better visual hierarchy */}
            <div className="py-4 px-6 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50">
              <div className="flex items-center gap-5">
                {/* Larger logo for better brand presence */}
                {listingData.logoPreview ? (
                  <img
                    src={listingData.logoPreview}
                    alt={`${companyName} logo`}
                    className="w-16 h-16 object-contain rounded-lg shadow-sm bg-white p-1"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-white font-bold text-xl">
                      {companyName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 leading-tight">
                        {companyName}
                      </h2>
                      <p className="text-sm text-gray-600 mt-0.5">
                        Manage and edit your property listing
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Status Badge */}
                      <div className={`flex items-center gap-1 px-3 py-1.5 rounded-md ${statusInfo.bgColor}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.color}`} />
                        <span className={`text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/occupier/listing/${listingId}/preview`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </Button>
                        {listingData?.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={handleSubmitForReview}
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                          >
                            Submit for Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation with Completion Indicators */}
            <div className="border-b border-gray-200 bg-white sticky top-0 z-30">
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

            {/* Tab Content Container */}
            <div className="max-w-4xl mx-auto px-6 lg:px-8 py-6 lg:py-8" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          
              {/* Company Profile Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Company Profile</h3>
                    <Button 
                      onClick={() => {
                        setEditingSection('companyProfile');
                        setEditingData({
                          companyName: listingData.companyName || '',
                          listingType: listingData.listingType || 'commercial',
                          companyDomain: listingData.companyDomain || '',
                          propertyPageLink: listingData.propertyPageLink || '',
                          logoMethod: listingData.logoMethod || (listingData.companyDomain ? 'clearbit' : 'upload'),
                          logoPreview: listingData.logoPreview || '',
                          clearbitLogo: listingData.clearbitLogo || false
                        });
                      }} 
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                      disabled={editingSection === 'companyProfile'}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      {editingSection === 'companyProfile' ? 'Editing...' : 'Edit Profile'}
                    </Button>
                  </div>

                  {editingSection === 'companyProfile' ? (
                    <div className="space-y-6">
                      {/* Listing Type Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Listing Type</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Select listing type *</label>
                            <div className="space-y-3">
                              {/* Commercial Option */}
                              <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                                <input
                                  type="radio"
                                  id="commercial-edit"
                                  name="listingType"
                                  value="commercial"
                                  checked={editingData.listingType === 'commercial'}
                                  onChange={() => setEditingData((prev: any) => ({ ...prev, listingType: 'commercial' }))}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 space-y-1">
                                  <label htmlFor="commercial-edit" className="text-sm font-medium cursor-pointer">
                                    Commercial
                                  </label>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    Office spaces, retail units, industrial sites, and other business properties
                                  </p>
                                </div>
                              </div>
                              
                              {/* Residential Option */}
                              <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                                <input
                                  type="radio"
                                  id="residential-edit"
                                  name="listingType"
                                  value="residential"
                                  checked={editingData.listingType === 'residential'}
                                  onChange={() => setEditingData((prev: any) => ({ ...prev, listingType: 'residential' }))}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 space-y-1">
                                  <label htmlFor="residential-edit" className="text-sm font-medium cursor-pointer">
                                    Residential
                                  </label>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    Houses, apartments, condos, and other living spaces
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Company Details Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Company Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Company Name */}
                          <div className="space-y-2">
                            <label htmlFor="companyName" className="text-sm font-medium">
                              Company Name *
                            </label>
                            <Input
                              id="companyName"
                              value={editingData.companyName || ''}
                              onChange={(e) => {
                                setEditingData((prev: any) => ({ ...prev, companyName: e.target.value }));
                                clearFieldError('companyName');
                              }}
                              placeholder="Enter your company name"
                              className={cn(
                                "w-full",
                                formErrors.companyName ? "border-red-500 focus:ring-red-500" : ""
                              )}
                            />
                            {formErrors.companyName && (
                              <p className="text-sm text-red-600 mt-1">{formErrors.companyName}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Company Logo Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Company Logo</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Enhanced Logo Method Selection */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium leading-relaxed">How would you like to add your logo?</label>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                We can automatically find your logo, or you can upload your own
                              </p>
                            </div>
                            
                            <RadioGroup
                              value={editingData.logoMethod || 'clearbit'}
                              onValueChange={(value) => setEditingData((prev: any) => ({ ...prev, logoMethod: value as 'clearbit' | 'upload' }))}
                              className="space-y-3"
                            >
                              {/* Clearbit Method Card */}
                              <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                                <RadioGroupItem value="clearbit" id="clearbit-edit" className="mt-0.5" />
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor="clearbit-edit" className="text-sm font-medium cursor-pointer">
                                      Find logo automatically
                                    </Label>
                                    <Badge variant="secondary" className="text-xs ml-2 sm:ml-0">Recommended</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    We'll search for your company's logo using your domain • Usually instant
                                  </p>
                                </div>
                              </div>
                              
                              {/* Upload Method Card */}
                              <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                                <RadioGroupItem value="upload" id="upload-edit" className="mt-0.5" />
                                <div className="flex-1 space-y-1">
                                  <Label htmlFor="upload-edit" className="text-sm font-medium cursor-pointer">
                                    Upload your own logo
                                  </Label>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    Choose a custom logo file • PNG, JPG, or SVG up to 2MB
                                  </p>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* Clearbit Domain Method */}
                          {editingData.logoMethod === 'clearbit' && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <label htmlFor="companyDomain" className="text-sm font-medium leading-relaxed">
                                  Company Domain
                                </label>
                                <Input
                                  id="companyDomain"
                                  value={editingData.companyDomain || ''}
                                  onChange={(e) => {
                                    setEditingData((prev: any) => ({ ...prev, companyDomain: e.target.value }));
                                    clearFieldError('companyDomain');
                                    if (domainError) setDomainError('');
                                  }}
                                  onBlur={(e) => {
                                    // Auto-format and clean the domain when user finishes editing
                                    const rawDomain = e.target.value.trim();
                                    if (rawDomain) {
                                      const normalizedDomain = normalizeDomain(rawDomain);
                                      const formattedDomain = formatDomainWithProtocol(rawDomain);
                                      
                                      // Update the input field to show the cleaned domain (without protocol for Clearbit)
                                      setEditingData((prev: any) => ({ 
                                        ...prev, 
                                        companyDomain: normalizedDomain,
                                        // Store the formatted version for other uses if needed
                                        formattedDomain: formattedDomain
                                      }));
                                      
                                      // Clear any existing errors since we've cleaned the domain
                                      if (domainError) setDomainError('');
                                      clearFieldError('companyDomain');
                                    }
                                  }}
                                  placeholder="e.g., apple.com or https://www.boots.com/products"
                                  className={cn(
                                    'placeholder:text-muted-foreground',
                                    domainError || formErrors.companyDomain ? 'border-red-500 focus:ring-red-500' : ''
                                  )}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Enter any URL format - we'll automatically extract and format the domain for logo lookup
                                </p>
                                {domainError && (
                                  <div className="p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                                    <div className="flex flex-col space-y-2 sm:flex-row sm:items-start sm:space-y-0 sm:space-x-2">
                                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 sm:mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-red-900 break-words">
                                          {domainError.includes('No logo found') ? 
                                            'Logo not found' : 
                                            'Invalid domain format'
                                          }
                                        </p>
                                        <p className="text-xs text-red-600 mt-1 leading-relaxed break-words">
                                          {domainError.includes('No logo found') ? 
                                            'Try uploading your own logo instead, or check if the domain is correct.' :
                                            'Please enter a valid domain like "company.com" (without www or https://)'
                                          }
                                        </p>
                                        {domainError.includes('No logo found') && (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEditingData((prev: any) => ({ ...prev, logoMethod: 'upload' }))}
                                            className="mt-2 text-xs w-full sm:w-auto"
                                          >
                                            Upload logo instead
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Form-level domain validation error (separate from Clearbit-specific errors) */}
                                {formErrors.companyDomain && !domainError && (
                                  <p className="text-sm text-red-600 mt-1">{formErrors.companyDomain}</p>
                                )}
                                {logoLoading && (
                                  <p className="text-sm text-blue-600 flex items-center gap-2">
                                    <span className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></span>
                                    Looking for logo...
                                  </p>
                                )}
                              </div>
                              
                              {/* Enhanced Logo Preview for Clearbit */}
                              {editingData.companyDomain && editingData.logoPreview && editingData.clearbitLogo && (
                                <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
                                    <div className="flex items-center space-x-3 sm:space-x-3">
                                      <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-lg border border-green-300 flex items-center justify-center">
                                        <img
                                          src={editingData.logoPreview}
                                          alt="Company logo"
                                          className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                          <p className="text-sm font-medium text-green-900">Logo found!</p>
                                        </div>
                                        <p className="text-xs text-green-600 break-words leading-relaxed">
                                          We found your logo automatically from {editingData.companyDomain}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingData((prev: any) => ({ ...prev, logoMethod: 'upload' }))}
                                      className="text-xs w-full sm:w-auto sm:flex-shrink-0"
                                    >
                                      Use different logo
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* File Upload Method */}
                          {editingData.logoMethod === 'upload' && (
                            <ImageUpload
                              value={editingData.logoPreview}
                              onChange={handleLogoFileUpload}
                              onPreviewChange={handleLogoPreviewChange}
                              placeholder="Upload your company logo"
                              maxSize={2 * 1024 * 1024} // 2MB
                              acceptedTypes={["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]}
                            />
                          )}
                        </CardContent>
                      </Card>

                      {/* Requirements Material Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Requirements Material</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Requirements Brochure Upload */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Requirements Brochure
                              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
                            </label>
                            <DocumentUpload
                              type="brochure"
                              value={listingData.brochureFiles || []}
                              onChange={(files) => {
                                // Transform UploadedFile[] to the expected format
                                const brochureFiles = files.map(file => ({
                                  id: file.id,
                                  name: file.name,
                                  url: file.url,
                                  path: file.path,
                                  type: 'brochure' as const,
                                  size: file.size,
                                  mimeType: file.mimeType,
                                  uploadedAt: file.uploadedAt
                                }));
                                
                                // Update local state
                                setListingData(prev => prev ? {
                                  ...prev,
                                  brochureFiles
                                } : null);
                              }}
                              acceptedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                              maxFileSize={10 * 1024 * 1024} // 10MB
                              organizationId=""
                              listingId={listingId}
                            />
                            <p className="text-xs text-gray-500">
                              Upload a PDF, DOC, or DOCX file with your property requirements (max 10MB)
                            </p>
                          </div>
                          
                          {/* Property Page Link */}
                          <div className="space-y-2">
                            <label htmlFor="propertyPageLink" className="text-sm font-medium">
                              Property Page Link
                              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
                            </label>
                            <Input
                              id="propertyPageLink"
                              type="url"
                              value={editingData.propertyPageLink || ''}
                              onChange={(e) => {
                                setEditingData((prev: any) => ({ ...prev, propertyPageLink: e.target.value }));
                                clearFieldError('propertyPageLink');
                              }}
                              onBlur={async (e) => {
                                // Save property page link immediately when user finishes editing
                                const newValue = e.target.value.trim();
                                if (newValue !== (listingData.propertyPageLink || '').trim()) {
                                  try {
                                    const supabase = createClientClient();
                                    const { error } = await supabase
                                      .from('listings')
                                      .update({
                                        property_page_link: newValue || null,
                                        updated_at: new Date().toISOString()
                                      })
                                      .eq('id', listingId);
                                    
                                    if (error) throw error;
                                    
                                    // Update local state
                                    setListingData(prev => prev ? {
                                      ...prev,
                                      propertyPageLink: newValue || undefined
                                    } : null);
                                    
                                    if (newValue) {
                                      toast.success('Property page link saved!');
                                    }
                                  } catch (error) {
                                    console.error('Error saving property page link:', error);
                                    toast.error('Failed to save property page link');
                                  }
                                }
                              }}
                              placeholder="https://example.com/property-page"
                              className={cn(
                                "placeholder:text-muted-foreground",
                                formErrors.propertyPageLink ? "border-red-500 focus:ring-red-500" : ""
                              )}
                            />
                            {formErrors.propertyPageLink && (
                              <p className="text-sm text-red-600 mt-1">{formErrors.propertyPageLink}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Link to the occupier's property page or additional information
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-2 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setEditingSection(null);
                            setEditingData({});
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => saveSection('companyProfile', editingData)}
                          className="bg-violet-600 hover:bg-violet-700 text-white"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="space-y-4">
                      {/* Company Details Card */}
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4 mb-4">
                            {listingData.logoPreview ? (
                              <img
                                src={listingData.logoPreview}
                                alt={`${companyName} logo`}
                                className="w-16 h-16 object-contain border rounded-lg"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-semibold text-xl">
                                  {companyName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="text-xl font-semibold text-gray-900">{companyName}</h4>
                              <p className="text-sm text-gray-600">
                                {listingData.listingType === 'residential' ? 'Residential' : 'Commercial'} Listing
                              </p>
                            </div>
                          </div>

                          {/* Property Page Link */}
                          {listingData.propertyPageLink && (
                            <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                                  <ExternalLink className="w-5 h-5 text-violet-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">Property Details Page</p>
                                  <a 
                                    href={listingData.propertyPageLink}
                                    target="_blank"
                                    rel="noopener noreferrer" 
                                    className="text-xs text-violet-600 hover:text-violet-700 underline truncate block"
                                  >
                                    {listingData.propertyPageLink}
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Requirements Brochure */}
                          {listingData.brochureFiles && listingData.brochureFiles.length > 0 && (
                            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 mt-4">
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-600" />
                                Requirements Brochure
                              </h5>
                              {listingData.brochureFiles.map((file) => (
                                <a
                                  key={file.id}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 p-3 rounded-lg bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                                >
                                  <FileText className="w-5 h-5 text-blue-600" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                      <span>Property requirements document</span>
                                      {file.size && (
                                        <span>• {(file.size / (1024 * 1024)).toFixed(1)}MB</span>
                                      )}
                                      {file.uploadedAt && (
                                        <span>• Uploaded {new Date(file.uploadedAt).toLocaleDateString()}</span>
                                      )}
                                    </div>
                                  </div>
                                  <ExternalLink className="w-4 h-4 text-blue-600" />
                                </a>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {/* Requirements Tab Content (matching modal exactly) */}
              {activeTab === 'requirements' && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Requirements</h3>
                  </div>
                  
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
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openModal('siteSize')}
                              >
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
                            <Button size="sm" onClick={() => openModal('siteSize')} className="bg-violet-600 hover:bg-violet-700 text-white">
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
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openModal('siteSize')}
                              >
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
                      ) : listingData.listingType === 'residential' && (!listingData.dwellingCountMin && !listingData.dwellingCountMax) ? (
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 border-dashed">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-violet-500">🏠</span>
                              Dwelling Count
                            </h4>
                            <Button size="sm" onClick={() => openModal('siteSize')} className="bg-violet-600 hover:bg-violet-700 text-white">
                              <Plus className="w-3 h-3 mr-1" />
                              Add Dwelling Range
                            </Button>
                          </div>
                          <p className="text-gray-600 text-sm">Specify the number of residential units you require.</p>
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
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openModal('siteSize')}
                              >
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
                      ) : listingData.listingType === 'residential' && (!listingData.siteAcreageMin && !listingData.siteAcreageMax) ? (
                        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 border-dashed">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-violet-500">🌾</span>
                              Site Acreage
                            </h4>
                            <Button size="sm" onClick={() => openModal('siteSize')} className="bg-violet-600 hover:bg-violet-700 text-white">
                              <Plus className="w-3 h-3 mr-1" />
                              Add Acreage Range
                            </Button>
                          </div>
                          <p className="text-gray-600 text-sm">Specify the land area requirements for your development.</p>
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
                              <Button variant="ghost" size="sm" onClick={() => openModal('sectors')}>
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
                                  {sector?.name ? formatName(sector.name) : sectorId}
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
                            <Button size="sm" onClick={() => openModal('sectors')} className="bg-blue-600 hover:bg-blue-700 text-white">
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
                              <Button variant="ghost" size="sm" onClick={() => openModal('useClasses')}>
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
                                  {useClass?.name ? formatName(useClass.name) : useClassId}
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
                            <Button size="sm" onClick={() => openModal('useClasses')} className="bg-green-600 hover:bg-green-700 text-white">
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
                          <Button onClick={() => openModal('siteSize')} className="bg-violet-600 hover:bg-violet-700 text-white">
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Locations</h3>
                    <Button 
                      size="sm" 
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => openModal('locations')}
                    >
                      {!listingData.locations || listingData.locations.length === 0 ? (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Locations
                        </>
                      ) : (
                        <>
                          <Edit className="w-4 h-4 mr-2" />
                          Manage Locations
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {listingData.locations && listingData.locations.length > 0 ? (
                    <div className="space-y-2">
                      <div className="mb-4">
                        <span className="text-sm text-gray-600">{listingData.locations.length} location(s) specified</span>
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
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
                      <p className="font-medium text-gray-800 flex items-center gap-2 mb-2">
                        <span className="text-xl">🌍</span> Nationwide Coverage
                      </p>
                      <p className="text-gray-600 text-sm">
                        This listing is open to opportunities across the UK & Ireland
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Contact Tab Content (matching modal exactly) */}
              {activeTab === 'contact' && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Contact</h3>
                    <Button 
                      size="sm" 
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => openModal('contacts')}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {/* All Contacts - no separation between primary and additional */}
                    {(() => {
                      // Combine all contacts into one array
                      const allContacts = [];
                      
                      // Add primary contact first if it exists
                      if (listingData.primaryContact?.contactName) {
                        allContacts.push({
                          id: 'primary',
                          contactName: listingData.primaryContact.contactName,
                          contactTitle: listingData.primaryContact.contactTitle,
                          contactEmail: listingData.primaryContact.contactEmail,
                          contactPhone: listingData.primaryContact.contactPhone,
                          contactArea: listingData.primaryContact.contactArea,
                          headshotUrl: listingData.primaryContact.headshotUrl,
                          isPrimary: true
                        });
                      }
                      
                      // Add additional contacts
                      if (listingData.additionalContacts) {
                        allContacts.push(...listingData.additionalContacts.map(contact => ({
                          ...contact,
                          isPrimary: false
                        })));
                      }
                      
                      return allContacts.length > 0 ? (
                        <>
                          {allContacts.map((contact, index) => (
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
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => contact.id && handleEditContact(contact.id, contact)}
                                    >
                                      <Edit className="w-3 h-3 mr-1" />
                                      Edit
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => contact.id && handleDeleteContact(contact.id)}
                                    >
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
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                          <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">No contacts added yet</p>
                          <p className="text-xs text-gray-500 mt-1">Add a contact to help agents reach the right person</p>
                        </div>
                      );
                    })()}

                  </div>
                </div>
              )}

              {/* FAQs Tab Content (accordion style) */}
              {activeTab === 'faqs' && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Frequently Asked Questions ({listingData?.faqs?.length || 0})</h3>
                      <p className="text-sm text-gray-600 mt-1">Help agents understand your requirements by answering common questions</p>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={addNewFAQ}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add FAQ
                    </Button>
                  </div>
                  
                  {listingData?.faqs && listingData.faqs.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        {listingData.faqs.map((faq) => (
                          <div
                            key={faq.id}
                            data-faq-id={faq.id}
                            className={cn(
                              "border border-gray-200 rounded-lg bg-white transition-all",
                              draggedFAQ === faq.id && "opacity-50 scale-95",
                              "hover:shadow-sm"
                            )}
                            draggable
                            onDragStart={(e) => faq.id && handleDragStart(e, faq.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => faq.id && handleDrop(e, faq.id)}
                            onDragEnd={handleDragEnd}
                          >
                            {/* FAQ Header */}
                            <div className="flex items-center">
                              {/* Drag Handle */}
                              <div className="px-2 py-3 cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4 text-gray-400" />
                              </div>
                              
                              {/* FAQ Content */}
                              {editingFAQ === faq.id ? (
                                // Editing mode - show question field only in header
                                <div className="flex-1 px-2 py-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                                    <Input
                                      value={editingFAQData.question}
                                      onChange={(e) => setEditingFAQData(prev => ({ ...prev, question: e.target.value }))}
                                      placeholder="Enter your question..."
                                      className="w-full"
                                    />
                                  </div>
                                </div>
                              ) : (
                                // Display mode
                                <button
                                  onClick={() => faq.id && toggleFAQ(faq.id)}
                                  className="flex-1 px-2 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                                >
                                  <span className="font-medium text-gray-900">{faq.question}</span>
                                  <div className="flex items-center gap-2">
                                    {/* Only show action buttons when not editing any FAQ */}
                                    {!editingFAQ && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEditingFAQ(faq);
                                          }}
                                          className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            faq.id && deleteFAQ(faq.id);
                                          }}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </>
                                    )}
                                    {faq.id && expandedFAQs.has(faq.id) ? (
                                      <ChevronUp className="w-4 h-4 text-gray-400" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-400" />
                                    )}
                                  </div>
                                </button>
                              )}
                            </div>
                            
                            {/* FAQ Answer - always visible when editing, collapsible otherwise */}
                            {faq.id && (expandedFAQs.has(faq.id) || editingFAQ === faq.id) && (
                              <div className="px-4 pb-3 border-t border-gray-100 ml-6">
                                {editingFAQ === faq.id ? (
                                  <div className="pt-3 space-y-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                                      <Textarea
                                        value={editingFAQData.answer}
                                        onChange={(e) => setEditingFAQData(prev => ({ ...prev, answer: e.target.value }))}
                                        placeholder="Enter your answer..."
                                        rows={3}
                                        className="w-full"
                                      />
                                    </div>
                                    {/* Save/Cancel buttons at the bottom after both fields */}
                                    <div className="flex items-center justify-end gap-2 pt-3 border-t">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={cancelEditingFAQ}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={saveEditingFAQ}
                                        disabled={!editingFAQData.question.trim() || !editingFAQData.answer.trim()}
                                        className="bg-violet-600 hover:bg-violet-700 text-white"
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-gray-600 text-sm leading-relaxed pt-3">
                                    {faq.answer}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {/* Reorder tip */}
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700">
                          <strong>Tip:</strong> Use the drag handle (⋮⋮) to reorder your FAQs. The first FAQ will appear at the top when agents view your listing.
                        </p>
                      </div>
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
                        variant="outline" 
                        className="text-violet-600 border-violet-600 hover:bg-violet-50"
                        onClick={addNewFAQ}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First FAQ
                      </Button>
                    </div>
                  )}
                </div>
              )}

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

      {/* CRUD Modals */}
      <OverviewModal
        isOpen={modalStates.overview}
        onClose={() => closeModal('overview')}
        listingId={listingId}
        currentData={{
          brochureFiles: listingData?.brochureFiles || [],
          propertyPageLink: listingData?.propertyPageLink
        }}
        onSave={handleOverviewSave}
      />

      {/* Separate Requirements Modals */}
      <SectorsModal
        isOpen={modalStates.sectors}
        onClose={() => closeModal('sectors')}
        currentData={listingData?.sectors || []}
        onSave={handleSectorsSave}
        sectorsOptions={sectors.map(s => ({ 
          value: s.id, 
          label: formatName(s.name)
        }))}
      />

      <UseClassesModal
        isOpen={modalStates.useClasses}
        onClose={() => closeModal('useClasses')}
        currentData={listingData?.useClassIds || []}
        onSave={handleUseClassesSave}
        useClassesOptions={useClasses.map(uc => ({ 
          value: uc.id, 
          label: formatName(uc.name)
        }))}
      />

      <SiteSizeModal
        isOpen={modalStates.siteSize}
        onClose={() => closeModal('siteSize')}
        listingType={listingData?.listingType || 'commercial'}
        currentData={{
          siteSizeMin: listingData?.siteSizeMin,
          siteSizeMax: listingData?.siteSizeMax,
          dwellingCountMin: listingData?.dwellingCountMin,
          dwellingCountMax: listingData?.dwellingCountMax,
          siteAcreageMin: listingData?.siteAcreageMin,
          siteAcreageMax: listingData?.siteAcreageMax
        }}
        onSave={handleSiteSizeSave}
      />

      <LocationsModal
        isOpen={modalStates.locations}
        onClose={() => closeModal('locations')}
        currentData={{
          locations: listingData?.locations?.map(loc => ({
            id: loc.id,
            name: loc.place_name || loc.formatted_address || 'Unknown location',
            coordinates: loc.coordinates,
            type: loc.type
          })) || []
        }}
        onSave={handleLocationsSave}
      />

      <ContactsModal
        isOpen={modalStates.contacts}
        onClose={() => closeModal('contacts')}
        listingId={listingId}
        currentData={{
          contacts: editingContactData ? [editingContactData] : [] // Pass the editing contact if available
        }}
        onSave={handleContactsSave}
        addOnlyMode={!editingContactData} // Only use add-only mode when not editing
        editingContact={editingContactData}
      />

      <FAQsModal
        isOpen={modalStates.faqs}
        onClose={() => closeModal('faqs')}
        currentData={{
          faqs: (listingData?.faqs || []).filter(faq => faq.id) as any[]
        }}
        onSave={handleFAQsSave}
      />



    </>
  );
}

