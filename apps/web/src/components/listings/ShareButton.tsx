'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Loader2 } from 'lucide-react';
import { ShareModal } from './ShareModal';

interface ShareButtonProps {
  listingId: string;
  listingTitle?: string;
  companyName?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
}

export function ShareButton({ 
  listingId, 
  listingTitle, 
  companyName,
  className = '',
  variant = 'outline',
  size = 'default'
}: ShareButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleShare = async () => {
    setIsGenerating(true);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setIsGenerating(false);
  };

  return (
    <>
      <Button
        onClick={handleShare}
        disabled={isGenerating}
        variant={variant}
        size={size}
        className={`${className} flex items-center gap-2`}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        Share
      </Button>
      
      <ShareModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        listingId={listingId}
        listingTitle={listingTitle}
        companyName={companyName}
      />
    </>
  );
}