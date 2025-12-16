'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, XCircle, Loader2, FileText, Zap, Database, Building2 } from 'lucide-react';

interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  message?: string;
  icon: any;
}

export default function StoreShapesAdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    description: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'upload', name: 'Upload DXF file', status: 'pending', icon: Upload },
    { id: 'convert', name: 'Convert to GeoJSON', status: 'pending', icon: FileText },
    { id: 'optimize', name: 'Optimize geometry', status: 'pending', icon: Zap },
    { id: 'insert', name: 'Insert to database', status: 'pending', icon: Database },
  ]);
  const [completedShape, setCompletedShape] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.dxf')) {
        setError('Please select a DXF file');
        return;
      }
      setFile(selectedFile);
      setError(null);

      // Auto-fill name from filename if empty
      if (!formData.name) {
        const baseName = selectedFile.name.replace('.dxf', '').replace(/[-_]/g, ' ');
        setFormData(prev => ({ ...prev, name: baseName }));
      }
    }
  };

  const updateStep = (stepId: string, status: ProcessingStep['status'], message?: string) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status, message } : step
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a DXF file');
      return;
    }

    if (!formData.name || !formData.company) {
      setError('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCompletedShape(null);

    try {
      // Step 1: Upload file
      updateStep('upload', 'processing', 'Uploading DXF file...');
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const uploadResponse = await fetch('/api/admin/store-shapes/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      updateStep('upload', 'complete', 'File uploaded successfully');

      // Step 2: Convert to GeoJSON
      updateStep('convert', 'processing', 'Converting DXF to GeoJSON...');
      const convertResponse = await fetch('/api/admin/store-shapes/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadResult.filename,
        }),
      });

      if (!convertResponse.ok) {
        const error = await convertResponse.json();
        console.error('Conversion error details:', error);
        const errorMsg = typeof error.error === 'string'
          ? error.error
          : JSON.stringify(error.error || 'Conversion failed');
        throw new Error(errorMsg);
      }

      const convertResult = await convertResponse.json();
      updateStep('convert', 'complete', `Converted ${convertResult.featureCount} features`);

      // Step 3: Optimize
      updateStep('optimize', 'processing', 'Optimizing GeoJSON...');
      const optimizeResponse = await fetch('/api/admin/store-shapes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: convertResult.geojsonFile,
        }),
      });

      if (!optimizeResponse.ok) {
        const error = await optimizeResponse.json();
        throw new Error(error.error || 'Optimization failed');
      }

      const optimizeResult = await optimizeResponse.json();
      updateStep('optimize', 'complete', `Reduced by ${optimizeResult.reductionPercent}%`);

      // Step 4: Insert to database
      updateStep('insert', 'processing', 'Inserting to database...');
      const insertResponse = await fetch('/api/admin/store-shapes/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          company: formData.company,
          description: formData.description,
          geojsonFile: optimizeResult.optimizedFile,
          metadataFile: optimizeResult.metadataFile,
        }),
      });

      if (!insertResponse.ok) {
        const error = await insertResponse.json();
        throw new Error(error.error || 'Database insertion failed');
      }

      const insertResult = await insertResponse.json();
      updateStep('insert', 'complete', 'Store shape created successfully');
      setCompletedShape(insertResult.shape);

      // Reset form
      setFile(null);
      setFormData({ name: '', company: '', description: '' });

    } catch (err: any) {
      const failedStep = steps.find(s => s.status === 'processing');
      if (failedStep) {
        updateStep(failedStep.id, 'error', err.message);
      }
      setError(err.message || 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetProcess = () => {
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined })));
    setCompletedShape(null);
    setError(null);
  };

  const progressPercentage = (steps.filter(s => s.status === 'complete').length / steps.length) * 100;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Store Shapes Admin</h1>
        <p className="text-muted-foreground">
          Upload and process DXF architectural files to create store shapes
        </p>
      </div>

      <div className="grid gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Upload DXF File</CardTitle>
            <CardDescription>
              Upload a DXF file exported from your DWG. The system will automatically convert, optimize, and add it to the database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="file">DXF File *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".dxf"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  className="cursor-pointer"
                />
                {file && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Shape Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Lidl Site Plan"
                    disabled={isProcessing}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="company">Company Name *</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="e.g., Lidl, Tesco"
                    disabled={isProcessing}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Complete site plan including parking and landscaping"
                  disabled={isProcessing}
                  rows={3}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={isProcessing || !file}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Process & Upload
                    </>
                  )}
                </Button>

                {(completedShape || error) && (
                  <Button type="button" variant="outline" onClick={resetProcess}>
                    Upload Another
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Processing Steps */}
        {(isProcessing || steps.some(s => s.status !== 'pending')) && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Status</CardTitle>
              <Progress value={progressPercentage} className="mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {steps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className={`mt-0.5 ${
                        step.status === 'complete' ? 'text-green-600' :
                        step.status === 'processing' ? 'text-blue-600' :
                        step.status === 'error' ? 'text-red-600' :
                        'text-gray-400'
                      }`}>
                        {step.status === 'complete' && <CheckCircle className="h-5 w-5" />}
                        {step.status === 'processing' && <Loader2 className="h-5 w-5 animate-spin" />}
                        {step.status === 'error' && <XCircle className="h-5 w-5" />}
                        {step.status === 'pending' && <Icon className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          step.status === 'error' ? 'text-red-600' : ''
                        }`}>
                          {step.name}
                        </p>
                        {step.message && (
                          <p className="text-sm text-muted-foreground">{step.message}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Message */}
        {completedShape && (
          <Alert className="border-green-600 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="font-medium text-green-900 mb-2">Store shape created successfully!</div>
              <div className="text-sm text-green-800 space-y-1">
                <p><strong>ID:</strong> {completedShape.id}</p>
                <p><strong>Name:</strong> {completedShape.name}</p>
                <p><strong>Company:</strong> {completedShape.company_name}</p>
                {completedShape.metadata?.scale_factor && (
                  <p><strong>Scale Factor:</strong> {completedShape.metadata.scale_factor.toExponential(2)}</p>
                )}
                <p className="mt-2">
                  The shape is now available in the SiteSketcher "Store Shapes" section.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <strong className="text-foreground">1. Upload:</strong> Select your DXF file (exported from DWG using ODA File Converter with ASCII DXF 2018 format)
            </div>
            <div>
              <strong className="text-foreground">2. Convert:</strong> The system extracts unit metadata ($INSUNITS) from the DXF and calculates the scale based on actual real-world dimensions
            </div>
            <div>
              <strong className="text-foreground">3. Optimize:</strong> Coordinates are simplified and normalized for efficient storage and rendering
            </div>
            <div>
              <strong className="text-foreground">4. Insert:</strong> The shape is added to the database with metadata for automatic scaling on the map
            </div>
            <p className="mt-4 pt-3 border-t">
              <strong className="text-foreground">Automatic Sizing:</strong> The building will appear at its actual real-world size as defined in the DXF file.
              No manual sizing needed - the system reads the dimensions directly from the file metadata!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
