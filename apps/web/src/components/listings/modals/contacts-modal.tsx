'use client'

import React, { useState, useRef } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUpload } from '@/components/ui/image-upload';
import { User, Plus, Edit, Trash2, Mail, Phone, MapPin } from 'lucide-react';
import { uploadFiles } from '@/lib/file-upload';
import { useAuth } from '@/contexts/auth-context';

interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone?: string;
  area?: string;
  headshotUrl?: string;
  isPrimary?: boolean;
}

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  currentData?: {
    primaryContact?: Contact;
    additionalContacts?: Contact[];
  };
  onSave: (data: { primaryContact?: Contact; additionalContacts: Contact[] }) => void;
}

export function ContactsModal({ 
  isOpen, 
  onClose, 
  listingId,
  currentData,
  onSave 
}: ContactsModalProps) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  const [primaryContact, setPrimaryContact] = useState<Contact | undefined>(currentData?.primaryContact);
  const [additionalContacts, setAdditionalContacts] = useState<Contact[]>(currentData?.additionalContacts || []);

  const [formData, setFormData] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    area: '',
    headshotUrl: ''
  });

  const handleStartEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      title: contact.title,
      email: contact.email,
      phone: contact.phone || '',
      area: contact.area || '',
      headshotUrl: contact.headshotUrl || ''
    });
    setIsAddingNew(false);
  };

  const handleStartAdd = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      title: '',
      email: '',
      phone: '',
      area: '',
      headshotUrl: ''
    });
    setIsAddingNew(true);
  };

  const handleCancelEdit = () => {
    setEditingContact(null);
    setIsAddingNew(false);
    setFormData({
      name: '',
      title: '',
      email: '',
      phone: '',
      area: '',
      headshotUrl: ''
    });
  };

  const handleSaveContact = () => {
    if (!formData.name.trim() || !formData.title.trim() || !formData.email.trim()) {
      return; // Basic validation
    }

    const contactData: Contact = {
      id: editingContact?.id || `contact_${Date.now()}`,
      name: formData.name.trim(),
      title: formData.title.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || undefined,
      area: formData.area.trim() || undefined,
      headshotUrl: formData.headshotUrl || undefined,
      isPrimary: editingContact?.isPrimary || false
    };

    if (isAddingNew) {
      // Add new contact
      setAdditionalContacts(prev => [...prev, contactData]);
    } else if (editingContact) {
      // Update existing contact
      if (editingContact.isPrimary) {
        setPrimaryContact(contactData);
      } else {
        setAdditionalContacts(prev => 
          prev.map(contact => contact.id === editingContact.id ? contactData : contact)
        );
      }
    }

    handleCancelEdit();
  };

  const handleDeleteContact = (contactId: string) => {
    setAdditionalContacts(prev => prev.filter(contact => contact.id !== contactId));
  };

  const handleHeadshotUpload = async (file: File) => {
    try {
      const uploadedFiles = await uploadFiles([file], 'headshot', user?.id!, listingId);
      if (uploadedFiles.length > 0) {
        setFormData(prev => ({ ...prev, headshotUrl: uploadedFiles[0].url }));
      }
    } catch (error) {
      console.error('Error uploading headshot:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        primaryContact,
        additionalContacts
      });
      onClose();
    } catch (error) {
      console.error('Error saving contacts:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getContactInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const ContactCard = ({ contact, showActions = true }: { contact: Contact; showActions?: boolean }) => (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {contact.headshotUrl ? (
          <img
            src={contact.headshotUrl}
            alt={contact.name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {getContactInitials(contact.name)}
            </span>
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900">{contact.name}</h4>
          {contact.isPrimary && (
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-medium">
              Primary
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">{contact.title}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {contact.email}
          </div>
          {contact.phone && (
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {contact.phone}
            </div>
          )}
          {contact.area && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {contact.area}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStartEdit(contact)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          {!contact.isPrimary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteContact(contact.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Contact Information"
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-4xl"
    >
      <div className="p-6 space-y-8">
        {(editingContact || isAddingNew) ? (
          /* Edit/Add Form */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {isAddingNew ? 'Add New Contact' : `Edit ${editingContact?.name}`}
              </h3>
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>

            {/* Headshot Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Profile Photo</label>
              <ImageUpload
                onUpload={handleHeadshotUpload}
                currentImageUrl={formData.headshotUrl}
                accept="image/*"
                maxSize={5 * 1024 * 1024} // 5MB
                className="w-24 h-24 rounded-full"
              />
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Job title"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+44 20 1234 5678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coverage Area
              </label>
              <Input
                value={formData.area}
                onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                placeholder="e.g., London, South East England"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveContact}
                disabled={!formData.name.trim() || !formData.title.trim() || !formData.email.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isAddingNew ? 'Add Contact' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          /* Contact List View */
          <>
            {/* Primary Contact */}
            {primaryContact && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Primary Contact</h3>
                <ContactCard contact={primaryContact} />
              </div>
            )}

            {/* Additional Contacts */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Additional Contacts ({additionalContacts.length})
                </h3>
                <Button onClick={handleStartAdd} className="bg-violet-600 hover:bg-violet-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </div>

              {additionalContacts.length > 0 ? (
                <div className="space-y-3">
                  {additionalContacts.map((contact) => (
                    <ContactCard key={contact.id} contact={contact} />
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                  <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No additional contacts added yet</p>
                  <p className="text-xs text-gray-500 mt-1">Add team members to help agents reach the right person</p>
                </div>
              )}
            </div>

            {/* Preview Section */}
            <div className="border-t pt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Preview</h4>
              <div className="text-xs text-gray-500 mb-3">This is how your contacts will appear to agents:</div>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                {primaryContact && (
                  <ContactCard contact={primaryContact} showActions={false} />
                )}
                {additionalContacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} showActions={false} />
                ))}
                {!primaryContact && additionalContacts.length === 0 && (
                  <div className="text-sm text-gray-500 italic">No contacts configured</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </BaseCrudModal>
  );
}