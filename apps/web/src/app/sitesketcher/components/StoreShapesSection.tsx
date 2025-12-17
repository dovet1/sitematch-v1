'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronRight, Building2, Info, Loader2 } from 'lucide-react';
import type { StoreShapeMetadata, StoreShape } from '@/types/sitesketcher';
import { fetchStoreShapesMetadata, fetchStoreShapeDetail } from '@/lib/sitesketcher/store-shapes-service';
import { cn } from '@/lib/utils';
import { TouchOptimizedButton } from './TouchOptimizedButton';

interface StoreShapesSectionProps {
  onShapeSelect: (shape: StoreShape) => void;
  isMobile?: boolean;
}

export function StoreShapesSection({ onShapeSelect, isMobile = false }: StoreShapesSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [metadataList, setMetadataList] = useState<StoreShapeMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [loadingShapeId, setLoadingShapeId] = useState<string | null>(null);

  // Cache for full shapes (id -> StoreShape)
  const [shapeCache, setShapeCache] = useState<Map<string, StoreShape>>(new Map());

  // Lazy load: Only fetch when user opens the collapsible
  useEffect(() => {
    if (isOpen && metadataList.length === 0 && !loading) {
      const loadMetadata = async () => {
        setLoading(true);
        try {
          const metadata = await fetchStoreShapesMetadata();
          setMetadataList(metadata);
          setError(null);
        } catch (err) {
          console.error('Failed to load store shapes metadata:', err);
          setError('Failed to load store shapes');
        } finally {
          setLoading(false);
        }
      };

      loadMetadata();
    }
  }, [isOpen, metadataList.length, loading]);

  const handleShapeClick = async (metadata: StoreShapeMetadata) => {
    setSelectedShapeId(metadata.id);

    // Check cache first
    const cachedShape = shapeCache.get(metadata.id);
    if (cachedShape) {
      onShapeSelect(cachedShape);
      return;
    }

    // Fetch full shape with GeoJSON
    setLoadingShapeId(metadata.id);
    try {
      const fullShape = await fetchStoreShapeDetail(metadata.id);

      // Cache it
      setShapeCache(prev => new Map(prev).set(metadata.id, fullShape));

      // Notify parent
      onShapeSelect(fullShape);
    } catch (err) {
      console.error('Failed to load shape detail:', err);
      setError(`Failed to load ${metadata.name}`);
    } finally {
      setLoadingShapeId(null);
    }
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
              {metadataList.length > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  {metadataList.length}
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
              <div className="text-center py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading shapes...
              </div>
            )}

            {error && (
              <div className="text-center py-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {!loading && !error && metadataList.length === 0 && (
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

            {!loading && !error && metadataList.length > 0 && (
              <div className="space-y-2">
                {metadataList.map((metadata) => (
                  <ButtonComponent
                    key={metadata.id}
                    variant={selectedShapeId === metadata.id ? "default" : "outline"}
                    className={cn(
                      "w-full justify-start text-left h-auto py-3",
                      selectedShapeId === metadata.id && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => handleShapeClick(metadata)}
                    disabled={loadingShapeId === metadata.id}
                    minSize={isMobile ? 48 : undefined}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {loadingShapeId === metadata.id ? (
                        <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
                      ) : (
                        <Building2 className="h-5 w-5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{metadata.name}</div>
                        {metadata.description && (
                          <div className="text-xs opacity-80 mt-0.5 truncate">
                            {metadata.description}
                          </div>
                        )}
                        {metadata.company_name && metadata.company_name !== metadata.name && (
                          <div className="text-xs opacity-70 mt-0.5">
                            {metadata.company_name}
                          </div>
                        )}
                        {loadingShapeId === metadata.id && (
                          <div className="text-xs opacity-70 mt-0.5">
                            Loading details...
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
