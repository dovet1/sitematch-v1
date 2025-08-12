'use client'

import React, { useState, useEffect } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { FAQManager, type FAQ } from '../faq-manager';
import { Button } from '@/components/ui/button';

interface FAQsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData?: {
    faqs?: Array<{
      id: string;
      question: string;
      answer: string;
      order?: number;
      displayOrder?: number;
    }>;
  };
  onSave: (data: { faqs: FAQ[] }) => void;
}

export function FAQsModal({ 
  isOpen, 
  onClose, 
  currentData,
  onSave 
}: FAQsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  // Convert incoming data to FAQ format
  useEffect(() => {
    if (currentData?.faqs) {
      const convertedFaqs: FAQ[] = currentData.faqs.map((faq, index) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        displayOrder: faq.displayOrder ?? faq.order ?? index
      })).sort((a, b) => a.displayOrder - b.displayOrder);
      
      setFaqs(convertedFaqs);
    } else {
      setFaqs([]);
    }
  }, [currentData]);

  const handleFAQsChange = (newFaqs: FAQ[]) => {
    setFaqs(newFaqs);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ faqs });
      onClose();
    } catch (error) {
      console.error('Error saving FAQs:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Frequently Asked Questions"
      showActions={false}
      className="max-w-4xl"
    >
      <div className="p-6">
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Help agents understand your requirements by answering common questions. You can edit FAQs inline or switch to preview mode.
          </p>
        </div>
        
        <FAQManager
          faqs={faqs}
          onChange={handleFAQsChange}
          maxFaqs={10}
          defaultMode="edit"
        />
        
        {faqs.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>💡 Pro tip:</strong> Use the eye/edit button to toggle between editing and preview modes. 
              Drag the grip handle or use Ctrl+↑/↓ to reorder FAQs.
            </p>
          </div>
        )}
        
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isSaving ? 'Saving...' : 'Done'}
          </Button>
        </div>
      </div>
    </BaseCrudModal>
  );
}