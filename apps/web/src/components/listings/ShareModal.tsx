'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  MessageCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle?: string;
  companyName?: string;
}

interface ShareData {
  share_token: string;
  share_url: string;
  is_public_shareable: boolean;
}

export function ShareModal({ 
  isOpen, 
  onClose, 
  listingId, 
  listingTitle = 'Commercial Requirement',
  companyName = 'Company' 
}: ShareModalProps) {
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Generate share token when modal opens
  useEffect(() => {
    if (isOpen && !shareData) {
      generateShareToken();
    }
  }, [isOpen, shareData]);

  const generateShareToken = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/listings/${listingId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const data: ShareData = await response.json();
      setShareData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
      console.error('Error generating share token:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareData?.share_url) return;
    
    try {
      await navigator.clipboard.writeText(shareData.share_url);
      setCopySuccess(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const generateSocialMessage = () => {
    return `Check out this commercial property requirement from ${companyName}: "${listingTitle}"`;
  };

  const shareToLinkedIn = () => {
    if (!shareData?.share_url) return;
    
    const message = generateSocialMessage();
    const linkedInUrl = `https://www.linkedin.com/feed/update/urn:li:share:?text=${encodeURIComponent(`${message} ${shareData.share_url}`)}`;
    window.open(linkedInUrl, '_blank');
  };

  const shareToWhatsApp = () => {
    if (!shareData?.share_url) return;
    
    const message = generateSocialMessage();
    const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(`${message}\n\n${shareData.share_url}`)}`;
    window.open(whatsAppUrl, '_blank');
  };

  const handleClose = () => {
    setShareData(null);
    setError(null);
    setCopySuccess(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Requirement
          </DialogTitle>
          <DialogDescription>
            Share this property requirement with others. Anyone with the link can view it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Generating share link...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {shareData && (
            <>
              {/* Share Link Section */}
              <div className="space-y-2">
                <Label htmlFor="share-link">Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    id="share-link"
                    value={shareData.share_url}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                  >
                    {copySuccess ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Social Media Sharing */}
              <div className="space-y-3">
                <Label>Share on Social Media</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={shareToLinkedIn}
                    variant="outline"
                    className="flex items-center gap-2 justify-start"
                  >
                    <div className="w-4 h-4 bg-[#0A66C2] rounded-sm flex items-center justify-center">
                      <span className="text-white text-xs font-bold">in</span>
                    </div>
                    LinkedIn
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>

                  <Button
                    onClick={shareToWhatsApp}
                    variant="outline"
                    className="flex items-center gap-2 justify-start"
                  >
                    <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    WhatsApp
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>
                </div>
              </div>

              {/* Preview Message */}
              <div className="space-y-2">
                <Label>Message Preview</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {generateSocialMessage()}
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                <p className="font-medium mb-1">Privacy Notice:</p>
                <p>
                  This link allows anyone to view your commercial property requirement. 
                  To remove the requirement from public view contact us using rob@sitematcher.co.uk
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          {shareData && (
            <Button onClick={copyToClipboard} className="gap-2">
              {copySuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}