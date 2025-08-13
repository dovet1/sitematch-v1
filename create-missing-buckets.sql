-- Create missing storage buckets for agency files
-- Only run this if the buckets don't already exist

-- Create logos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'logos', 'logos', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE name = 'logos'
);

-- Create headshots bucket if it doesn't exist  
INSERT INTO storage.buckets (id, name, public)
SELECT 'headshots', 'headshots', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE name = 'headshots'
);

-- Create RLS policies for logos bucket
CREATE POLICY "Public can view logos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can upload logos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Users can update their own logos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own logos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create RLS policies for headshots bucket
CREATE POLICY "Public can view headshots" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'headshots');

CREATE POLICY "Authenticated users can upload headshots" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'headshots');

CREATE POLICY "Users can update their own headshots" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'headshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own headshots" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'headshots' AND auth.uid()::text = (storage.foldername(name))[1]);