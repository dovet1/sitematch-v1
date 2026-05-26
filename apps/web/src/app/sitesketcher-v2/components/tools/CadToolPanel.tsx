'use client';

import { useState, useRef } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Upload, FileImage } from 'lucide-react';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

export function CadToolPanel() {
  const { cadImages } = useSketchStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PNG and JPG images are allowed');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 20MB)');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/sitesketcher-v2/upload-cad', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const result = await response.json();

      // TODO: Open calibration modal with result
      // For now, just log success
      console.log('CAD uploaded successfully:', result);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload CAD image');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium text-sm-ink">CAD Overlay</h3>
          <Badge variant="violet">Pro</Badge>
        </div>
        <p className="text-xs text-sm-ink/60 mb-4">
          Upload a CAD or site plan image (PNG/JPG) to overlay on the map. You'll calibrate the scale after upload.
        </p>
      </div>

      {cadImages.length === 0 ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full p-6 border-2 border-dashed border-sm-border rounded-lg hover:border-sm-violet/40 hover:bg-sm-violet/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-sm-violet/10 rounded-full">
                <Upload className="w-5 h-5 text-sm-violet" />
              </div>
              <div className="text-sm font-medium text-sm-ink">
                {uploading ? 'Uploading...' : 'Drop CAD image here'}
              </div>
              <div className="text-xs text-sm-ink/50">
                or click to browse
              </div>
              <div className="text-[10px] text-sm-ink/40 mt-1">
                PNG or JPG, max 20MB
              </div>
            </div>
          </button>

          {error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-medium text-sm-ink mb-2">
            Uploaded Images ({cadImages.length})
          </div>
          {cadImages.map((cad) => (
            <div
              key={cad.id}
              className="flex items-center gap-2 p-2 bg-sm-bg border border-sm-border rounded"
            >
              <FileImage className="w-4 h-4 text-sm-ink/50 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-sm-ink truncate">{cad.fileName}</div>
                <div className="text-[10px] text-sm-ink/50">
                  {new Date(cad.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full mt-2"
            size="sm"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload Another
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-sm-border">
        <h4 className="text-xs font-medium text-sm-ink mb-2">Shortcuts</h4>
        <ul className="space-y-1 text-xs text-sm-ink/60">
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              C
            </kbd>{' '}
            CAD tool
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              V
            </kbd>{' '}
            Switch to select
          </li>
        </ul>
      </div>
    </div>
  );
}
