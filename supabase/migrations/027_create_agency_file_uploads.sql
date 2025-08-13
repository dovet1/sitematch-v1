-- Create separate agency_file_uploads table for cleaner separation
-- This keeps agency files separate from listing files

CREATE TABLE public.agency_file_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  display_order INTEGER NULL DEFAULT 0,
  caption TEXT NULL,
  is_primary BOOLEAN NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  
  CONSTRAINT agency_file_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT agency_file_uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT agency_file_uploads_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies (id) ON DELETE CASCADE,
  
  -- File size must be positive
  CONSTRAINT agency_file_size_positive CHECK (file_size > 0),
  
  -- Valid bucket names for agency files
  CONSTRAINT agency_valid_bucket CHECK (
    bucket_name = ANY (
      ARRAY[
        'logos'::text,
        'headshots'::text
      ]
    )
  ),
  
  -- Valid file types for agency files
  CONSTRAINT agency_valid_file_type CHECK (
    file_type = ANY (
      ARRAY[
        'logo'::text,
        'headshot'::text
      ]
    )
  )
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agency_file_uploads_user_id ON public.agency_file_uploads USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_agency_file_uploads_agency_id ON public.agency_file_uploads USING btree (agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_file_uploads_file_type ON public.agency_file_uploads USING btree (file_type);
CREATE INDEX IF NOT EXISTS idx_agency_file_uploads_created_at ON public.agency_file_uploads USING btree (created_at);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_agency_file_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_agency_file_uploads_updated_at 
    BEFORE UPDATE ON agency_file_uploads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_agency_file_uploads_updated_at();

-- Create RLS policies
ALTER TABLE agency_file_uploads ENABLE ROW LEVEL SECURITY;

-- Users can manage files for agencies they created
CREATE POLICY "Agency creators can manage their files" 
ON agency_file_uploads FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM agencies 
    WHERE agencies.id = agency_file_uploads.agency_id 
    AND agencies.created_by = auth.uid()
  )
);

-- Agency admins can manage files
CREATE POLICY "Agency admins can manage files" 
ON agency_file_uploads FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE agency_agents.agency_id = agency_file_uploads.agency_id 
    AND agency_agents.user_id = auth.uid() 
    AND agency_agents.role = 'admin'
  )
);

-- Public can view files from approved agencies
CREATE POLICY "Public can view approved agency files" 
ON agency_file_uploads FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM agencies 
    WHERE agencies.id = agency_file_uploads.agency_id 
    AND agencies.status = 'approved'
  )
);