// =====================================================
// FAQ Manager Component - Story 3.3 Task 1
// Unified FAQ editing interface with progressive enhancement
// =====================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ChevronUp, ChevronDown, HelpCircle, Edit3, Eye, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// Touch-friendly enhancements
const TOUCH_TARGET_SIZE = 'h-11 w-11 sm:h-8 sm:w-8'; // Larger touch targets on mobile
const MOBILE_SPACING = 'gap-3 sm:gap-2'; // More space on mobile

// =====================================================
// TYPES
// =====================================================

export interface FAQ {
  id?: string;
  question: string;
  answer: string;
  displayOrder: number;
}

type FAQViewMode = 'edit' | 'preview';

interface FAQManagerProps {
  faqs: FAQ[];
  onChange: (faqs: FAQ[]) => void;
  maxFaqs?: number;
  className?: string;
  defaultMode?: FAQViewMode;
}

interface FAQItemState {
  mode: FAQViewMode;
  isDragging: boolean;
  hasUnsavedChanges: boolean;
}

// =====================================================
// FAQ MANAGER COMPONENT
// =====================================================

export function FAQManager({ 
  faqs, 
  onChange, 
  maxFaqs = 10,
  className,
  defaultMode = 'edit'
}: FAQManagerProps) {
  // FAQ states - each FAQ can be in edit or preview mode independently
  const [faqStates, setFaqStates] = useState<Record<string, FAQItemState>>({});
  const [tempFaqData, setTempFaqData] = useState<Record<string, FAQ>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Initialize FAQ states
  useEffect(() => {
    const newStates: Record<string, FAQItemState> = {};
    faqs.forEach((faq, index) => {
      const id = faq.id || index.toString();
      if (!faqStates[id]) {
        newStates[id] = {
          mode: faq.question || faq.answer ? 'preview' : 'edit', // New FAQs start in edit mode
          isDragging: false,
          hasUnsavedChanges: false
        };
      }
    });
    if (Object.keys(newStates).length > 0) {
      setFaqStates(prev => ({ ...prev, ...newStates }));
    }
  }, [faqs.length]);

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
    
    // Set new FAQ to edit mode
    setFaqStates(prev => ({
      ...prev,
      [newFAQ.id!]: {
        mode: 'edit',
        isDragging: false,
        hasUnsavedChanges: false
      }
    }));
  }, [faqs, maxFaqs, onChange]);

  // Enter edit mode and store temporary data
  const enterEditMode = useCallback((faqId: string, index: number) => {
    const faq = faqs[index];
    setTempFaqData(prev => ({
      ...prev,
      [faqId]: { ...faq }
    }));
    setFaqStates(prev => ({
      ...prev,
      [faqId]: {
        ...prev[faqId],
        mode: 'edit'
      }
    }));
  }, [faqs]);

  // Save changes and exit edit mode
  const saveFAQ = useCallback((faqId: string, index: number) => {
    const tempData = tempFaqData[faqId];
    if (!tempData || !tempData.question.trim() || !tempData.answer.trim()) return;

    // Update the FAQ in the main array
    const updatedFaqs = faqs.map((faq, i) => 
      i === index ? tempData : faq
    );
    onChange(updatedFaqs);

    // Clean up temp data and switch to preview mode
    setTempFaqData(prev => {
      const newTemp = { ...prev };
      delete newTemp[faqId];
      return newTemp;
    });
    setFaqStates(prev => ({
      ...prev,
      [faqId]: {
        ...prev[faqId],
        mode: 'preview'
      }
    }));

    // Clear any errors for this FAQ
    const newErrors = { ...errors };
    delete newErrors[`faq_${index}_question`];
    delete newErrors[`faq_${index}_answer`];
    setErrors(newErrors);
  }, [faqs, tempFaqData, onChange, errors]);

  // Cancel edit mode and discard changes
  const cancelEditMode = useCallback((faqId: string) => {
    // Clean up temp data
    setTempFaqData(prev => {
      const newTemp = { ...prev };
      delete newTemp[faqId];
      return newTemp;
    });
    // Switch back to preview mode
    setFaqStates(prev => ({
      ...prev,
      [faqId]: {
        ...prev[faqId],
        mode: 'preview'
      }
    }));
  }, []);

  const removeFAQ = useCallback((index: number) => {
    const faqToRemove = faqs[index];
    const updatedFaqs = faqs
      .filter((_, i) => i !== index)
      .map((faq, i) => ({ ...faq, displayOrder: i }));
    
    onChange(updatedFaqs);
    
    // Clean up FAQ state
    if (faqToRemove?.id) {
      setFaqStates(prev => {
        const newStates = { ...prev };
        delete newStates[faqToRemove.id!];
        return newStates;
      });
    }
    
    // Clear any errors for the removed FAQ
    const newErrors = { ...errors };
    delete newErrors[`faq_${index}_question`];
    delete newErrors[`faq_${index}_answer`];
    setErrors(newErrors);
  }, [faqs, onChange, errors]);

  const updateFAQ = useCallback((index: number, field: 'question' | 'answer', value: string) => {
    const faq = faqs[index];
    const faqId = faq.id || index.toString();
    
    // Update temporary data if in edit mode
    if (faqStates[faqId]?.mode === 'edit') {
      setTempFaqData(prev => ({
        ...prev,
        [faqId]: {
          ...prev[faqId],
          [field]: value
        }
      }));
    } else {
      // Direct update if not in edit mode (shouldn't happen with new flow)
      const updatedFaqs = faqs.map((faq, i) => 
        i === index ? { ...faq, [field]: value } : faq
      );
      onChange(updatedFaqs);
    }

    // Clear error for this field
    const errorKey = `faq_${index}_${field}`;
    if (errors[errorKey]) {
      const newErrors = { ...errors };
      delete newErrors[errorKey];
      setErrors(newErrors);
    }
  }, [faqs, onChange, errors, faqStates]);

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

  // Enhanced drag and drop with better mobile support
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // Update drag state
    const faq = faqs[index];
    if (faq?.id) {
      setFaqStates(prev => ({
        ...prev,
        [faq.id!]: { ...prev[faq.id!], isDragging: true }
      }));
    }
  }, [faqs]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null) {
      const faq = faqs[draggedIndex];
      if (faq?.id) {
        setFaqStates(prev => ({
          ...prev,
          [faq.id!]: { ...prev[faq.id!], isDragging: false }
        }));
      }
    }
    setDraggedIndex(null);
    dragCounter.current = 0;
  }, [draggedIndex, faqs]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    
    const newFaqs = [...faqs];
    const draggedFaq = newFaqs[draggedIndex];
    
    // Remove dragged item and insert at new position
    newFaqs.splice(draggedIndex, 1);
    newFaqs.splice(dropIndex, 0, draggedFaq);
    
    // Update display orders
    newFaqs.forEach((faq, i) => {
      faq.displayOrder = i;
    });
    
    onChange(newFaqs);
  }, [draggedIndex, faqs, onChange]);

  // Keyboard navigation for reordering
  const handleKeyboardReorder = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveFAQ(index, 'up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFAQ(index, 'down');
          break;
      }
    }
  }, [moveFAQ]);

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
          <Label className="text-base font-medium">Frequently Asked Questions (Optional)</Label>
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
          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const faqId = faq.id || index.toString();
              const faqState = faqStates[faqId] || { mode: 'preview', isDragging: false, hasUnsavedChanges: false };
              const isEditing = faqState.mode === 'edit';
              const isDragging = faqState.isDragging;
              const displayFaq = isEditing && tempFaqData[faqId] ? tempFaqData[faqId] : faq;
              
              return (
                <Card
                  key={faqId}
                  className={cn(
                    "group transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500/20",
                    isDragging && "opacity-50 scale-95 shadow-lg",
                    isEditing && "ring-2 ring-blue-500/20 shadow-md",
                    !isEditing && "hover:shadow-sm"
                  )}
                  draggable={!isEditing}
                  onDragStart={(e) => !isEditing && handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onKeyDown={(e) => handleKeyboardReorder(e, index)}
                  tabIndex={0}
                  role="article"
                  aria-label={`FAQ ${index + 1}: ${faq.question || 'New FAQ'}`}
                >
                  {/* Header with controls */}
                  <div className="flex items-center gap-3 p-4 pb-2">
                    {/* Drag handle (only visible when not editing) */}
                    {!isEditing && (
                      <div 
                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-manipulation"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}
                    
                    {/* FAQ number badge */}
                    <span className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded-md font-medium shrink-0">
                      #{index + 1}
                    </span>
                    
                    {/* Mode toggle and actions */}
                    <div className="flex items-center gap-2 ml-auto">
                      {/* Mobile-friendly reorder buttons (always visible on small screens) */}
                      <div className={cn("flex items-center", MOBILE_SPACING, "sm:opacity-0 sm:group-hover:opacity-100 transition-opacity")}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveFAQ(index, 'up')}
                          disabled={index === 0}
                          className={cn(
                            TOUCH_TARGET_SIZE,
                            "p-0 hover:bg-gray-100 transition-colors touch-manipulation",
                            index === 0 && "opacity-30 cursor-not-allowed"
                          )}
                          title={index === 0 ? "Already at the top" : "Move up (Ctrl+↑)"}
                          aria-label={index === 0 ? "Already at the top" : "Move up"}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveFAQ(index, 'down')}
                          disabled={index === faqs.length - 1}
                          className={cn(
                            TOUCH_TARGET_SIZE,
                            "p-0 hover:bg-gray-100 transition-colors touch-manipulation",
                            index === faqs.length - 1 && "opacity-30 cursor-not-allowed"
                          )}
                          title={index === faqs.length - 1 ? "Already at the bottom" : "Move down (Ctrl+↓)"}
                          aria-label={index === faqs.length - 1 ? "Already at the bottom" : "Move down"}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Edit/Preview toggle */}
                      {!isEditing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => enterEditMode(faqId, index)}
                          className={cn(
                            TOUCH_TARGET_SIZE,
                            "p-0 transition-colors touch-manipulation",
                            "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                          )}
                          title="Edit FAQ"
                          aria-label="Edit FAQ"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {/* Delete button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFAQ(index)}
                        className={cn(
                          TOUCH_TARGET_SIZE,
                          "p-0 hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors touch-manipulation"
                        )}
                        title="Delete FAQ"
                        aria-label="Delete FAQ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Content area */}
                  <CardContent className="pt-0 space-y-4">
                    {isEditing ? (
                      // Edit mode - always visible form
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`question-${index}`} className="text-sm font-medium flex items-center gap-2">
                            Question *
                            <span className="text-xs text-gray-500">({displayFaq.question.length}/150)</span>
                          </Label>
                          <Input
                            id={`question-${index}`}
                            value={displayFaq.question}
                            onChange={(e) => updateFAQ(index, 'question', e.target.value)}
                            placeholder="Enter your question..."
                            maxLength={150}
                            className={cn(
                              "text-base",
                              errors[`faq_${index}_question`] && 'border-red-500 focus:ring-red-500'
                            )}
                          />
                          {errors[`faq_${index}_question`] && (
                            <p className="text-sm text-red-600">{errors[`faq_${index}_question`]}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`answer-${index}`} className="text-sm font-medium flex items-center gap-2">
                            Answer *
                            <span className="text-xs text-gray-500">({displayFaq.answer.length}/500)</span>
                          </Label>
                          <Textarea
                            id={`answer-${index}`}
                            value={displayFaq.answer}
                            onChange={(e) => updateFAQ(index, 'answer', e.target.value)}
                            placeholder="Provide a detailed answer..."
                            rows={4}
                            maxLength={500}
                            className={cn(
                              "text-base resize-none",
                              errors[`faq_${index}_answer`] && 'border-red-500 focus:ring-red-500'
                            )}
                          />
                          {errors[`faq_${index}_answer`] && (
                            <p className="text-sm text-red-600">{errors[`faq_${index}_answer`]}</p>
                          )}
                        </div>
                        {/* Action buttons at the bottom in edit mode */}
                        <div className="flex items-center justify-end gap-2 pt-4 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => cancelEditMode(faqId)}
                            className="px-4"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveFAQ(faqId, index)}
                            disabled={!displayFaq.question.trim() || !displayFaq.answer.trim()}
                            className="bg-violet-600 hover:bg-violet-700 text-white px-4"
                          >
                            Save
                          </Button>
                        </div>
                      </>
                    ) : (
                      // Preview mode - clean display
                      <>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2 text-base leading-relaxed">
                            {faq.question || <span className="text-gray-400 italic">No question yet</span>}
                          </h4>
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {faq.answer || <span className="text-gray-400 italic">No answer yet</span>}
                          </p>
                        </div>
                        
                        {(!faq.question.trim() || !faq.answer.trim()) && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                            <p className="text-sm text-amber-700">
                              <strong>Incomplete:</strong> This FAQ needs both a question and answer to be visible to users.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
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