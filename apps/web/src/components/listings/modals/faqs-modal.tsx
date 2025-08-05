'use client'

import React, { useState } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, ChevronUp, ChevronDown, HelpCircle } from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
}

interface FAQsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData?: {
    faqs?: FAQ[];
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
  const [faqs, setFaqs] = useState<FAQ[]>(
    currentData?.faqs?.sort((a, b) => a.order - b.order) || []
  );
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  const [formData, setFormData] = useState({
    question: '',
    answer: ''
  });

  const handleStartEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer
    });
    setIsAddingNew(false);
  };

  const handleStartAdd = () => {
    setEditingFaq(null);
    setFormData({
      question: '',
      answer: ''
    });
    setIsAddingNew(true);
  };

  const handleCancelEdit = () => {
    setEditingFaq(null);
    setIsAddingNew(false);
    setFormData({
      question: '',
      answer: ''
    });
  };

  const handleSaveFaq = () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      return; // Basic validation
    }

    if (isAddingNew) {
      // Add new FAQ
      const newFaq: FAQ = {
        id: `faq_${Date.now()}`,
        question: formData.question.trim(),
        answer: formData.answer.trim(),
        order: faqs.length
      };
      setFaqs(prev => [...prev, newFaq]);
    } else if (editingFaq) {
      // Update existing FAQ
      setFaqs(prev => 
        prev.map(faq => 
          faq.id === editingFaq.id 
            ? { ...faq, question: formData.question.trim(), answer: formData.answer.trim() }
            : faq
        )
      );
    }

    handleCancelEdit();
  };

  const handleDeleteFaq = (faqId: string) => {
    setFaqs(prev => {
      const filtered = prev.filter(faq => faq.id !== faqId);
      // Reorder remaining FAQs
      return filtered.map((faq, index) => ({ ...faq, order: index }));
    });
  };

  const handleMoveFaq = (faqId: string, direction: 'up' | 'down') => {
    setFaqs(prev => {
      const currentIndex = prev.findIndex(faq => faq.id === faqId);
      if (currentIndex === -1) return prev;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newFaqs = [...prev];
      [newFaqs[currentIndex], newFaqs[newIndex]] = [newFaqs[newIndex], newFaqs[currentIndex]];
      
      // Update order numbers
      return newFaqs.map((faq, index) => ({ ...faq, order: index }));
    });
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

  const FAQCard = ({ faq, index, showActions = true }: { faq: FAQ; index: number; showActions?: boolean }) => (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 mb-2">{faq.question}</h4>
            <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
          </div>
          
          {showActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveFaq(faq.id, 'up')}
                disabled={index === 0}
                className="p-1"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveFaq(faq.id, 'down')}
                disabled={index === faqs.length - 1}
                className="p-1"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStartEdit(faq)}
                className="p-1"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteFaq(faq.id)}
                className="p-1 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Frequently Asked Questions"
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-4xl"
    >
      <div className="p-6 space-y-8">
        {(editingFaq || isAddingNew) ? (
          /* Edit/Add Form */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {isAddingNew ? 'Add New FAQ' : 'Edit FAQ'}
              </h3>
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question *
                </label>
                <Input
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="What would you like to know about this property?"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ask questions that potential agents or partners might have
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Answer *
                </label>
                <Textarea
                  value={formData.answer}
                  onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                  placeholder="Provide a detailed answer to help agents understand your requirements..."
                  rows={4}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide clear, detailed answers to help agents better understand your needs
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveFaq}
                disabled={!formData.question.trim() || !formData.answer.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isAddingNew ? 'Add FAQ' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          /* FAQ List View */
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Frequently Asked Questions ({faqs.length})
                  </h3>
                  <p className="text-sm text-gray-600">
                    Help agents understand your requirements by answering common questions
                  </p>
                </div>
                <Button onClick={handleStartAdd} className="bg-violet-600 hover:bg-violet-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </Button>
              </div>

              {faqs.length > 0 ? (
                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <FAQCard key={faq.id} faq={faq} index={index} />
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                  <HelpCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No FAQs added yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Add frequently asked questions to help agents understand your requirements
                  </p>
                </div>
              )}
            </div>

            {faqs.length > 0 && (
              <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                <strong>Tip:</strong> Use the arrow buttons to reorder your FAQs. The first FAQ will appear at the top when agents view your listing.
              </div>
            )}

            {/* Preview Section */}
            {faqs.length > 0 && (
              <div className="border-t pt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Preview</h4>
                <div className="text-xs text-gray-500 mb-3">This is how your FAQs will appear to agents:</div>
                
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  {faqs.map((faq, index) => (
                    <FAQCard key={faq.id} faq={faq} index={index} showActions={false} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </BaseCrudModal>
  );
}