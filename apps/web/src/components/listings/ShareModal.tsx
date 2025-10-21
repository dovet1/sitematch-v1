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
  AlertTriangle,
  Sparkles,
  Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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
      toast.success('Link Copied!', {
        icon: '✨',
        style: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
        },
      });
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const generateSocialMessage = () => {
    return `Check out this site requirement from ${companyName} on SiteMatcher here:`;
  };

  const shareToWhatsApp = () => {
    if (!shareData?.share_url) return;
    
    const message = generateSocialMessage();
    const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(`${message} ${shareData.share_url}`)}`;
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
      <DialogContent className="w-[calc(100vw-16px)] max-w-2xl sm:w-full max-h-[90vh] sm:max-h-[80vh] !border-0 !outline-0 !ring-0 bg-transparent shadow-2xl p-0 gap-0 overflow-hidden rounded-lg flex flex-col [&>button]:!opacity-100 [&>button]:bg-transparent [&>button]:w-8 [&>button]:h-8 [&>button]:right-3 [&>button]:top-3 [&>button]:focus:ring-white/50 [&>button]:focus:ring-2 [&>button]:focus:ring-offset-0 [&>button>svg]:text-white [&>button>svg]:w-4 [&>button>svg]:h-4 [&>button>svg]:stroke-2" style={{ border: 'none', outline: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', margin: '0' }}>
        {/* Premium Header with Gradient */}
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 px-6 py-6 sm:py-8 pr-14 text-white flex-shrink-0">
          <DialogHeader className="space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <Share2 className="h-6 w-6" />
              <div>
                <DialogTitle className="text-xl font-bold">Share Your Requirement</DialogTitle>
                <DialogDescription className="text-violet-100 mt-1">
                  Share this site requirement from {companyName} for maximum exposure
                </DialogDescription>
              </div>
            </motion.div>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6 bg-white flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
                  <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-violet-500/20"></div>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-600">Creating your share link...</p>
                <p className="text-xs text-gray-400">This will only take a moment</p>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
              >
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Unable to generate share link</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </motion.div>
            )}

            {shareData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* Primary Share Link Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-violet-600" />
                    <Label className="font-medium text-gray-900">Your Shareable Link</Label>
                  </div>
                  
                  <div className="group relative">
                    <Input
                      value={shareData.share_url}
                      readOnly
                      className="pr-24 font-mono text-sm border-gray-200 bg-gray-50/50 focus:bg-white transition-colors"
                    />
                    <Button
                      onClick={copyToClipboard}
                      size="sm"
                      className={`absolute right-1 top-1/2 -translate-y-1/2 h-7 transition-all duration-300 ${
                        copySuccess
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-violet-600 hover:bg-violet-700'
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        {copySuccess ? (
                          <motion.div
                            key="success"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex items-center gap-1"
                          >
                            <Check className="h-3 w-3" />
                            <span className="text-xs hidden sm:inline">Copied!</span>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="copy"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            <span className="text-xs hidden sm:inline">Copy</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </div>
                </div>

                <Separator className="bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                {/* Quick Share Options */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-violet-600" />
                    <Label className="font-medium text-gray-900">Quick Share</Label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      onClick={copyToClipboard}
                      variant="outline"
                      className={`group flex h-14 flex-col items-center justify-center gap-1.5 border-2 transition-all duration-200 ${
                        copySuccess
                          ? 'border-green-500 bg-green-50'
                          : 'border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/50 hover:border-violet-300 hover:from-violet-100 hover:to-purple-100/50'
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        {copySuccess ? (
                          <motion.div
                            key="success"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex flex-col items-center gap-1"
                          >
                            <Check className="h-5 w-5 text-green-600" />
                            <span className="text-xs font-medium text-green-900">Copied!</span>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="copy"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex flex-col items-center gap-1"
                          >
                            <Copy className="h-5 w-5 text-violet-600" />
                            <span className="text-xs font-medium text-violet-900">Copy Link</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>

                    <Button
                      onClick={shareToWhatsApp}
                      variant="outline"
                      className="group flex h-14 flex-col items-center justify-center gap-1.5 border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50/50 hover:border-green-300 hover:from-green-100 hover:to-emerald-100/50 transition-all duration-200"
                    >
                      <div className="flex items-center justify-center w-5 h-5">
                        <MessageCircle className="w-full h-full text-[#25D366] fill-current" strokeWidth={2} />
                      </div>
                      <span className="text-xs font-medium text-green-900">WhatsApp</span>
                    </Button>
                  </div>
                </div>

                {/* Message Preview */}
                <div className="space-y-3">
                  <Label className="font-medium text-gray-900">Message Preview</Label>
                  <div className="rounded-lg border-l-4 border-l-violet-500 bg-violet-50/50 p-4">
                    <p className="text-sm text-gray-700 italic">
                      "{generateSocialMessage()}"
                    </p>
                  </div>
                </div>

                {/* Enhanced Privacy Notice */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-amber-200 p-1">
                      <AlertTriangle className="h-3 w-3 text-amber-700" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-amber-900">Privacy & Control</p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Anyone with this link can view your requirement. To remove from public view, 
                        contact us at <span className="font-medium">rob@sitematcher.co.uk</span>
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Enhanced Footer */}
        <div className="flex flex-col-reverse gap-3 border-t bg-gray-50/50 px-6 py-4 sm:flex-row sm:justify-between sm:items-center flex-shrink-0">
          <Button variant="ghost" onClick={handleClose} className="text-gray-600 hover:text-gray-900">
            Close
          </Button>
          
          {shareData && (
            <Button 
              onClick={copyToClipboard} 
              className={`gap-2 transition-all duration-300 ${
                copySuccess 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700'
              }`}
            >
              <AnimatePresence mode="wait">
                {copySuccess ? (
                  <motion.div
                    key="copied"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    <span>Successfully Copied!</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy Share Link</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}