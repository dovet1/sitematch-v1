'use client'

import React, { useState, useRef, useEffect } from 'react';
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
    contacts?: Contact[];
  };
  onSave: (data: { contacts: Contact[] }) => void;
  addOnlyMode?: boolean;
  editingContact?: Contact | null;
}

export function ContactsModal({ 
  isOpen, 
  onClose, 
  listingId,
  currentData,
  onSave,
  addOnlyMode = false,
  editingContact
}: ContactsModalProps) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [internalEditingContact, setInternalEditingContact] = useState<Contact | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  const [contacts, setContacts] = useState<Contact[]>(currentData?.contacts || []);

  // Auto-start adding mode when addOnlyMode is true, or editing mode when editingContact is provided
  useEffect(() => {
    if (isOpen) {
      if (editingContact) {
        // Start editing mode with the provided contact
        setInternalEditingContact(editingContact);
        setIsAddingNew(false);
        setFormData({
          name: editingContact.name || '',
          title: editingContact.title || '',
          email: editingContact.email || '',
          phone: editingContact.phone || '',
          area: editingContact.area || '',
          headshotUrl: editingContact.headshotUrl || ''
        });
      } else if (addOnlyMode && !isAddingNew && !internalEditingContact) {
        handleStartAdd();
      }
    } else {
      // Clear state when modal closes
      setInternalEditingContact(null);
      setIsAddingNew(false);
      setFormData({
        name: '',
        title: '',
        email: '',
        phone: '',
        area: '',
        headshotUrl: ''
      });
    }
  }, [addOnlyMode, isOpen, editingContact]);

  const [formData, setFormData] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    area: '',
    headshotUrl: ''
  });

  const handleStartEdit = (contact: Contact) => {
    setInternalEditingContact(contact);
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
    setInternalEditingContact(null);
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
    setInternalEditingContact(null);
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

  const handleSaveContact = async () => {
    if (!formData.name.trim() || !formData.title.trim() || !formData.email.trim()) {
      return; // Basic validation
    }

    const contactData: Contact = {
      id: (internalEditingContact?.id || editingContact?.id) || '',
      name: formData.name.trim(),
      title: formData.title.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || undefined,
      area: formData.area.trim() || undefined,
      headshotUrl: formData.headshotUrl || undefined,
      isPrimary: internalEditingContact?.isPrimary || editingContact?.isPrimary || false
    };

    if (isAddingNew || addOnlyMode) {
      // Add new contact
      if (addOnlyMode && !editingContact) {
        // In add-only mode, directly save the single contact
        try {
          await onSave({ contacts: [contactData] });
          onClose();
          return;
        } catch (error) {
          console.error('Error saving contact:', error);
          return;
        }
      } else {
        setContacts(prev => [...prev, contactData]);
      }
    } else if (internalEditingContact || editingContact) {
      // Update existing contact (either from internal state or external prop)
      const contactToUpdate = internalEditingContact || editingContact;
      if (editingContact) {
        // If editing from external prop, save directly
        try {
          await onSave({ contacts: [contactData] });
          onClose();
          return;
        } catch (error) {
          console.error('Error saving contact:', error);
          return;
        }
      } else {
        // Internal editing mode
        setContacts(prev => 
          prev.map(contact => contact.id === contactToUpdate?.id ? contactData : contact)
        );
      }
    }

    handleCancelEdit();
  };

  const handleDeleteContact = (contactId: string) => {
    setContacts(prev => prev.filter(contact => contact.id !== contactId));
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
        contacts
      });
      onClose();
    } catch (error) {
      console.error('Error saving contacts:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getContactInitials = (name: string) => {
    if (!name || typeof name !== 'string') {
      return '??';
    }
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteContact(contact.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title={addOnlyMode || isAddingNew ? "Add New Contact" : (editingContact || internalEditingContact ? "Edit Contact Information" : "Contact")}
      onSave={handleSave}
      isSaving={isSaving}
      showActions={!internalEditingContact && !editingContact && !isAddingNew && !addOnlyMode}
      className="max-w-4xl"
    >
      <div className="p-6 space-y-6">
        {(internalEditingContact || editingContact || isAddingNew || addOnlyMode) ? (
          /* Edit/Add Form */
          <div className="space-y-6">

            {/* Headshot Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Profile Photo</label>
              <ImageUpload
                value={formData.headshotUrl}
                onChange={(file) => {
                  if (file) {
                    handleHeadshotUpload(file);
                  } else {
                    // Handle removal - clear the headshot URL
                    setFormData(prev => ({ ...prev, headshotUrl: '' }));
                  }
                }}
                acceptedTypes={["image/png", "image/jpeg", "image/jpg"]}
                maxSize={5 * 1024 * 1024} // 5MB
                placeholder="Upload profile photo"
                className="max-w-sm"
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
                {isAddingNew || addOnlyMode ? 'Add Contact' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          /* Contact List View */
          <div className="space-y-4">
            {contacts.length > 0 ? (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No contacts added yet</p>
                <p className="text-xs text-gray-500 mt-1">Add team members to help agents reach the right person</p>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseCrudModal>
  );
}