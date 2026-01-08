'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, X, User, Building, Briefcase } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import { toast } from 'sonner';

interface ProfileFormData {
  full_name: string;
  job_title: string;
  phone_number: string;
  professional_bio: string;
  headshot_url: string;
  company_name: string;
  company_website: string;
  company_logo_url: string;
  linkedin_url: string;
  years_experience: number | null;
  specializations: string[];
  service_areas: string[];
  primary_services: string[];
}

interface ConsultantProfileEditorProps {
  initialData: any;
  className?: string;
}

const SPECIALIZATIONS = [
  'Office', 'Retail', 'Industrial', 'Leisure', 'Healthcare', 'Education', 'Mixed Use', 'Other'
];

const PRIMARY_SERVICES = [
  'Property Search', 'Market Analysis', 'Lease Negotiation', 'Investment Advice', 'Development Consulting', 'Other'
];

const SERVICE_AREAS = [
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh', 'Bristol', 'Liverpool', 
  'Sheffield', 'Newcastle', 'Nottingham', 'Leicester', 'Coventry', 'Bradford', 'Cardiff', 'Belfast',
  'South East', 'South West', 'North West', 'North East', 'Midlands', 'Yorkshire', 'Scotland', 'Wales',
  'Northern Ireland', 'Nationwide'
];

export default function ConsultantProfileEditor({ initialData, className }: ConsultantProfileEditorProps) {
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: initialData?.full_name || '',
    job_title: initialData?.job_title || '',
    phone_number: initialData?.phone_number || '',
    professional_bio: initialData?.professional_bio || '',
    headshot_url: initialData?.headshot_url || '',
    company_name: initialData?.company_name || '',
    company_website: initialData?.company_website || '',
    company_logo_url: initialData?.company_logo_url || '',
    linkedin_url: initialData?.linkedin_url || '',
    years_experience: initialData?.years_experience || null,
    specializations: initialData?.specializations || [],
    service_areas: initialData?.service_areas || [],
    primary_services: initialData?.primary_services || []
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const updateFormData = (field: keyof ProfileFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.job_title.trim()) newErrors.job_title = 'Job title is required';
    if (!formData.phone_number.trim()) newErrors.phone_number = 'Phone number is required';
    else if (!/^(\+44|0)[1-9]\d{8,9}$/.test(formData.phone_number)) {
      newErrors.phone_number = 'Invalid UK phone number format';
    }
    if (!formData.company_name.trim()) newErrors.company_name = 'Company name is required';
    if (formData.specializations.length === 0) {
      newErrors.specializations = 'At least one specialization is required';
    }
    if (formData.service_areas.length === 0) {
      newErrors.service_areas = 'At least one service area is required';
    }

    // Optional field validations
    if (formData.professional_bio.length > 500) {
      newErrors.professional_bio = 'Professional bio must be less than 500 characters';
    }
    if (formData.company_website && !/^https?:\/\/.+/.test(formData.company_website)) {
      newErrors.company_website = 'Invalid website URL';
    }
    if (formData.linkedin_url && !/^https:\/\/(www\.)?linkedin\.com\/.*$/.test(formData.linkedin_url)) {
      newErrors.linkedin_url = 'Must be a valid LinkedIn URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/consultant/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Profile updated successfully!');
        router.push('/new-dashboard');
      } else {
        toast.error(data.message || 'Failed to update profile');
        if (data.errors) {
          setErrors(data.errors.reduce((acc: any, error: any) => ({
            ...acc,
            [error.path[0]]: error.message
          }), {}));
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'headshot' | 'logo') => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/consultant/profile/upload-${type}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const fieldName = type === 'headshot' ? 'headshot_url' : 'company_logo_url';
        updateFormData(fieldName, data.data.url);
        toast.success(`${type === 'headshot' ? 'Headshot' : 'Logo'} updated successfully`);
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Upload failed. Please try again.');
    }
  };

  const toggleArraySelection = (array: string[], value: string, field: keyof ProfileFormData) => {
    const newArray = array.includes(value)
      ? array.filter(item => item !== value)
      : [...array, value];
    
    updateFormData(field, newArray);
  };

  const handleBack = () => {
    router.push('/new-dashboard');
  };

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          onClick={handleBack}
          className="violet-bloom-button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex-1">
          <h1 className="heading-3 text-foreground">Edit Profile</h1>
          <p className="text-muted-foreground">Update your professional information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Details */}
          <Card className="violet-bloom-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => updateFormData('full_name', e.target.value)}
                    placeholder="John Smith"
                    className={errors.full_name ? 'border-red-500' : ''}
                  />
                  {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>}
                </div>

                <div>
                  <Label htmlFor="job_title">Job Title *</Label>
                  <Input
                    id="job_title"
                    value={formData.job_title}
                    onChange={(e) => updateFormData('job_title', e.target.value)}
                    placeholder="Senior Property Consultant"
                    className={errors.job_title ? 'border-red-500' : ''}
                  />
                  {errors.job_title && <p className="text-red-500 text-sm mt-1">{errors.job_title}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="phone_number">Phone Number *</Label>
                <Input
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => updateFormData('phone_number', e.target.value)}
                  placeholder="+44 7700 900123"
                  className={errors.phone_number ? 'border-red-500' : ''}
                />
                {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>}
              </div>

              <div>
                <Label htmlFor="professional_bio">Professional Bio</Label>
                <Textarea
                  id="professional_bio"
                  value={formData.professional_bio}
                  onChange={(e) => updateFormData('professional_bio', e.target.value)}
                  placeholder="Tell potential clients about your expertise and experience..."
                  rows={4}
                  className={errors.professional_bio ? 'border-red-500' : ''}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.professional_bio.length}/500 characters
                </p>
                {errors.professional_bio && <p className="text-red-500 text-sm mt-1">{errors.professional_bio}</p>}
              </div>

              <div>
                <Label>Professional Headshot</Label>
                <ImageUpload
                  value={formData.headshot_url}
                  onChange={(file) => {
                    if (file) {
                      handleImageUpload(file, 'headshot');
                    } else {
                      updateFormData('headshot_url', '');
                    }
                  }}
                  acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
                  maxSize={5 * 1024 * 1024}
                  placeholder="Upload photo"
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card className="violet-bloom-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => updateFormData('company_name', e.target.value)}
                  placeholder="ABC Property Consultants"
                  className={errors.company_name ? 'border-red-500' : ''}
                />
                {errors.company_name && <p className="text-red-500 text-sm mt-1">{errors.company_name}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company_website">Company Website</Label>
                  <Input
                    id="company_website"
                    value={formData.company_website}
                    onChange={(e) => updateFormData('company_website', e.target.value)}
                    placeholder="https://www.example.com"
                    className={errors.company_website ? 'border-red-500' : ''}
                  />
                  {errors.company_website && <p className="text-red-500 text-sm mt-1">{errors.company_website}</p>}
                </div>

                <div>
                  <Label htmlFor="years_experience">Years of Experience</Label>
                  <Select 
                    value={formData.years_experience?.toString() || ''}
                    onValueChange={(value) => updateFormData('years_experience', value ? parseInt(value) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select years of experience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Not specified</SelectItem>
                      {Array.from({ length: 30 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1} year{i + 1 === 1 ? '' : 's'}
                        </SelectItem>
                      ))}
                      <SelectItem value="30">30+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
                <Input
                  id="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={(e) => updateFormData('linkedin_url', e.target.value)}
                  placeholder="https://www.linkedin.com/in/yourprofile"
                  className={errors.linkedin_url ? 'border-red-500' : ''}
                />
                {errors.linkedin_url && <p className="text-red-500 text-sm mt-1">{errors.linkedin_url}</p>}
              </div>

              <div>
                <Label>Company Logo</Label>
                <ImageUpload
                  value={formData.company_logo_url}
                  onChange={(file) => {
                    if (file) {
                      handleImageUpload(file, 'logo');
                    } else {
                      updateFormData('company_logo_url', '');
                    }
                  }}
                  acceptedTypes={['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']}
                  maxSize={2 * 1024 * 1024}
                  placeholder="Upload company logo"
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Professional Details */}
          <Card className="violet-bloom-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Professional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Specializations *</Label>
                <p className="text-sm text-muted-foreground mb-3">Select your areas of expertise</p>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATIONS.map((spec) => (
                    <Badge
                      key={spec}
                      variant={formData.specializations.includes(spec) ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary-50"
                      onClick={() => toggleArraySelection(formData.specializations, spec, 'specializations')}
                    >
                      {spec}
                      {formData.specializations.includes(spec) && (
                        <X className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
                {errors.specializations && <p className="text-red-500 text-sm mt-1">{errors.specializations}</p>}
              </div>

              <div>
                <Label>Service Areas *</Label>
                <p className="text-sm text-muted-foreground mb-3">Select your geographical coverage</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_AREAS.map((area) => (
                    <Badge
                      key={area}
                      variant={formData.service_areas.includes(area) ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary-50"
                      onClick={() => toggleArraySelection(formData.service_areas, area, 'service_areas')}
                    >
                      {area}
                      {formData.service_areas.includes(area) && (
                        <X className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
                {errors.service_areas && <p className="text-red-500 text-sm mt-1">{errors.service_areas}</p>}
              </div>

              <div>
                <Label>Primary Services</Label>
                <p className="text-sm text-muted-foreground mb-3">What services do you provide?</p>
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_SERVICES.map((service) => (
                    <Badge
                      key={service}
                      variant={formData.primary_services.includes(service) ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary-50"
                      onClick={() => toggleArraySelection(formData.primary_services, service, 'primary_services')}
                    >
                      {service}
                      {formData.primary_services.includes(service) && (
                        <X className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="violet-bloom-card">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto">
                  <Save className="w-8 h-8 text-primary-400" />
                </div>
                <div>
                  <h3 className="heading-4 text-foreground mb-2">Ready to save?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your changes will be reflected in the agent directory immediately.
                  </p>
                  <Button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full violet-bloom-button violet-bloom-touch"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}