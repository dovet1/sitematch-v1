// =====================================================
// FAQ Manager Component - Story 3.3 Task 1
// Dynamic FAQ creation and management with accordion UI
// =====================================================

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, ChevronUp, ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// TYPES
// =====================================================

export interface FAQ {
  id?: string;
  question: string;
  answer: string;
  displayOrder: number;
}

interface FAQManagerProps {
  faqs: FAQ[];
  onChange: (faqs: FAQ[]) => void;
  maxFaqs?: number;
  className?: string;
}

// =====================================================
// FAQ MANAGER COMPONENT
// =====================================================

export function FAQManager({ 
  faqs, 
  onChange, 
  maxFaqs = 10,
  className 
}: FAQManagerProps) {
  const [openItem, setOpenItem] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // =====================================================
  // FAQ MANAGEMENT FUNCTIONS
  // =====================================================

  const addFAQ = useCallback(() => {
    if (faqs.length >= maxFaqs) return;

    const newFAQ: FAQ = {
      id: `faq-${Date.now()}`,
      question: '',
      answer: '',
      displayOrder: faqs.length
    };

    const updatedFaqs = [...faqs, newFAQ];
    onChange(updatedFaqs);
    setOpenItem(newFAQ.id!);
  }, [faqs, maxFaqs, onChange]);

  const removeFAQ = useCallback((index: number) => {
    const updatedFaqs = faqs
      .filter((_, i) => i !== index)
      .map((faq, i) => ({ ...faq, displayOrder: i }));
    
    onChange(updatedFaqs);
    
    // Clear any errors for the removed FAQ
    const newErrors = { ...errors };
    delete newErrors[`faq_${index}_question`];
    delete newErrors[`faq_${index}_answer`];
    setErrors(newErrors);
  }, [faqs, onChange, errors]);

  const updateFAQ = useCallback((index: number, field: 'question' | 'answer', value: string) => {
    const updatedFaqs = faqs.map((faq, i) => 
      i === index ? { ...faq, [field]: value } : faq
    );
    onChange(updatedFaqs);

    // Clear error for this field
    const errorKey = `faq_${index}_${field}`;
    if (errors[errorKey]) {
      const newErrors = { ...errors };
      delete newErrors[errorKey];
      setErrors(newErrors);
    }
  }, [faqs, onChange, errors]);

  const moveFAQ = useCallback((index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === faqs.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedFaqs = [...faqs];
    
    // Swap the FAQs
    [updatedFaqs[index], updatedFaqs[newIndex]] = [updatedFaqs[newIndex], updatedFaqs[index]];
    
    // Update display orders
    updatedFaqs.forEach((faq, i) => {
      faq.displayOrder = i;
    });

    onChange(updatedFaqs);
  }, [faqs, onChange]);

  // =====================================================
  // VALIDATION
  // =====================================================

  const validateFAQs = useCallback(() => {
    const newErrors: Record<string, string> = {};

    faqs.forEach((faq, index) => {
      if (!faq.question.trim()) {
        newErrors[`faq_${index}_question`] = `Question ${index + 1} is required`;
      }
      if (!faq.answer.trim()) {
        newErrors[`faq_${index}_answer`] = `Answer ${index + 1} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [faqs]);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Frequently Asked Questions</Label>
          <p className="text-sm text-gray-600 mt-1">
            Add questions and answers that might help potential partners understand your requirements
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFAQ}
          disabled={faqs.length >= maxFaqs}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add FAQ
        </Button>
      </div>

      <div className="mt-6">
        {faqs.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-200 bg-gray-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center text-gray-500">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No FAQs added yet</p>
              <p className="text-xs mt-2 text-gray-500 max-w-sm">
                Help potential partners by adding common questions and detailed answers about your requirements
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addFAQ}
                className="mt-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add your first FAQ
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={openItem}
          onValueChange={setOpenItem}
          className="space-y-2"
        >
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.id || index}
              value={faq.id || index.toString()}
              className="border rounded-lg group"
            >
              <Card className="border-none shadow-none">
                <AccordionTrigger className="hover:no-underline px-4 py-3">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-left">
                        {faq.question || `FAQ ${index + 1}`}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded-md font-medium">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {/* Move Up Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFAQ(index, 'up');
                        }}
                        disabled={index === 0}
                        className={cn(
                          "h-7 w-7 p-0 hover:bg-gray-100 transition-colors",
                          index === 0 && "opacity-30 cursor-not-allowed"
                        )}
                        title={index === 0 ? "Already at the top" : "Move up"}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      
                      {/* Move Down Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFAQ(index, 'down');
                        }}
                        disabled={index === faqs.length - 1}
                        className={cn(
                          "h-7 w-7 p-0 hover:bg-gray-100 transition-colors",
                          index === faqs.length - 1 && "opacity-30 cursor-not-allowed"
                        )}
                        title={index === faqs.length - 1 ? "Already at the bottom" : "Move down"}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      
                      {/* Delete Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFAQ(index);
                        }}
                        className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors ml-2"
                        title="Delete FAQ"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <CardContent className="space-y-4 pt-0">
                    {/* Question Field */}
                    <div className="space-y-2">
                      <Label htmlFor={`question-${index}`} className="text-sm font-medium">
                        Question *
                      </Label>
                      <Input
                        id={`question-${index}`}
                        value={faq.question}
                        onChange={(e) => updateFAQ(index, 'question', e.target.value)}
                        placeholder="Enter your question..."
                        className={cn(
                          errors[`faq_${index}_question`] && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                      {errors[`faq_${index}_question`] && (
                        <p className="text-sm text-red-600">{errors[`faq_${index}_question`]}</p>
                      )}
                    </div>

                    {/* Answer Field */}
                    <div className="space-y-2">
                      <Label htmlFor={`answer-${index}`} className="text-sm font-medium">
                        Answer *
                      </Label>
                      <Textarea
                        id={`answer-${index}`}
                        value={faq.answer}
                        onChange={(e) => updateFAQ(index, 'answer', e.target.value)}
                        placeholder="Provide a detailed answer..."
                        rows={4}
                        className={cn(
                          errors[`faq_${index}_answer`] && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                      {errors[`faq_${index}_answer`] && (
                        <p className="text-sm text-red-600">{errors[`faq_${index}_answer`]}</p>
                      )}
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
        )}
      </div>

      {faqs.length > 0 && (
        <div className="text-xs text-gray-500 text-center">
          {faqs.length} of {maxFaqs} FAQs added
        </div>
      )}
    </div>
  );
}