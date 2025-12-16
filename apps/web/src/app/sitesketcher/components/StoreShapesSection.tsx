'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronRight, Building2, Info } from 'lucide-react';
import type { StoreShape } from '@/types/sitesketcher';
import { fetchStoreShapes } from '@/lib/sitesketcher/store-shapes-service';
import { cn } from '@/lib/utils';
import { TouchOptimizedButton } from './TouchOptimizedButton';

interface StoreShapesSectionProps {
  onShapeSelect: (shape: StoreShape) => void;
  isMobile?: boolean;
}

export function StoreShapesSection({ onShapeSelect, isMobile = false }: StoreShapesSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shapes, setShapes] = useState<StoreShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  useEffect(() => {
    const loadShapes = async () => {
      try {
        const fetchedShapes = await fetchStoreShapes();
        setShapes(fetchedShapes);
        setError(null);
      } catch (err) {
        console.error('Failed to load store shapes:', err);
        setError('Failed to load store shapes');
      } finally {
        setLoading(false);
      }
    };

    loadShapes();
  }, []);

  const handleShapeClick = (shape: StoreShape) => {
    setSelectedShapeId(shape.id);
    onShapeSelect(shape);
  };

  const ButtonComponent = isMobile ? TouchOptimizedButton : Button;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">Store Shapes</span>
              {shapes.length > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  {shapes.length}
                </span>
              )}
            </div>
            <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {/* Contact message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Want your store shape added?</p>
                  <p className="text-xs">
                    Contact{' '}
                    <a href="mailto:rob@sitematcher.co.uk" className="underline font-medium">
                      rob@sitematcher.co.uk
                    </a>{' '}
                    for free inclusion in the library.
                  </p>
                </div>
              </div>
            </div>

            {loading && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Loading shapes...
              </div>
            )}

            {error && (
              <div className="text-center py-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {!loading && !error && shapes.length === 0 && (
              <div className="text-center py-6 px-2">
                <Building2 className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  No shapes available yet
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Contact us to add your store shape to the library
                </p>
              </div>
            )}

            {!loading && !error && shapes.length > 0 && (
              <div className="space-y-2">
                {shapes.map((shape) => (
                  <ButtonComponent
                    key={shape.id}
                    variant={selectedShapeId === shape.id ? "default" : "outline"}
                    className={cn(
                      "w-full justify-start text-left h-auto py-3",
                      selectedShapeId === shape.id && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => handleShapeClick(shape)}
                    minSize={isMobile ? 48 : undefined}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Building2 className="h-5 w-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{shape.name}</div>
                        {shape.description && (
                          <div className="text-xs opacity-80 mt-0.5 truncate">
                            {shape.description}
                          </div>
                        )}
                        {shape.company_name && shape.company_name !== shape.name && (
                          <div className="text-xs opacity-70 mt-0.5">
                            {shape.company_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </ButtonComponent>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
