'use client'

import React, { useState, useRef } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, X, Link as LinkIcon } from 'lucide-react';
import { uploadFiles } from '@/lib/file-upload';
import { useAuth } from '@/contexts/auth-context';

interface OverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  currentData?: {
    brochureFiles?: Array<{
      id: string;
      name: string;
      url: string;
      size: number;
    }>;
    propertyPageLink?: string;
  };
  onSave: (data: { brochureFiles?: any[]; propertyPageLink?: string }) => void;
}

export function OverviewModal({ 
  isOpen, 
  onClose, 
  listingId,
  currentData,
  onSave 
}: OverviewModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [propertyPageLink, setPropertyPageLink] = useState(currentData?.propertyPageLink || '');
  const [brochureFiles, setBrochureFiles] = useState(currentData?.brochureFiles || []);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const uploadedFiles = await uploadFiles(
        Array.from(files), 
        'brochure', 
        user?.id!, 
        listingId,
        (progress) => console.log(`Upload progress: ${progress}%`)
      );

      const transformedFiles = uploadedFiles.map(file => ({
        id: file.id,
        name: file.name,
        url: file.url,
        size: file.size
      }));

      setBrochureFiles(prev => [...prev, ...transformedFiles]);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploadingFiles(false);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setBrochureFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        brochureFiles,
        propertyPageLink: propertyPageLink.trim() || undefined
      });
      onClose();
    } catch (error) {
      console.error('Error saving overview data:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Overview Information"
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-3xl"
    >
      <div className="p-6 space-y-8">
        {/* Requirements Brochure Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Requirements Brochure</h3>
              <p className="text-sm text-gray-600">Upload detailed property requirements documents</p>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploadingFiles ? 'Uploading...' : 'Upload Files'}
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Uploaded Files List */}
          {brochureFiles.length > 0 && (
            <div className="space-y-2">
              {brochureFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(file.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-500">
            Supported formats: PDF, DOC, DOCX. Maximum file size: 10MB per file.
          </div>
        </div>

        {/* Property Page Link Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Property Page Link</h3>
            <p className="text-sm text-gray-600">Link to your existing property details page or requirements document</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="propertyPageLink" className="block text-sm font-medium text-gray-700">
              Website URL
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="propertyPageLink"
                type="url"
                value={propertyPageLink}
                onChange={(e) => setPropertyPageLink(e.target.value)}
                placeholder="https://example.com/property-requirements"
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500">
              This link will be displayed to agents as "View Requirement Details"
            </p>
          </div>
        </div>

        {/* Preview Section */}
        {(brochureFiles.length > 0 || propertyPageLink.trim()) && (
          <div className="border-t pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Preview</h4>
            <div className="text-xs text-gray-500 mb-3">This is how your overview will appear to agents:</div>
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              {brochureFiles.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">📋 Requirements Brochure</span>
                  <span className="text-gray-600 ml-2">({brochureFiles.length} file{brochureFiles.length > 1 ? 's' : ''})</span>
                </div>
              )}
              {propertyPageLink.trim() && (
                <div className="text-sm">
                  <span className="font-medium">🔗 Property Page</span>
                  <span className="text-gray-600 ml-2">View Requirement Details</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseCrudModal>
  );
}