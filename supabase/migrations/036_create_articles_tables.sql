-- =====================================================
-- ARTICLES FEATURE MIGRATION
-- =====================================================
-- Create articles table for blog functionality
-- Create article_images table for article gallery
-- Set up RLS policies for public viewing and admin management
-- Create storage bucket for article images

-- =====================================================
-- ARTICLES TABLE
-- =====================================================
CREATE TABLE public.articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL,
  body text NOT NULL, -- Markdown content
  author_name text NOT NULL,
  author_title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create indexes for articles
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_created_at ON articles(created_at DESC);

-- =====================================================
-- ARTICLE IMAGES TABLE
-- =====================================================
CREATE TABLE public.article_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  bucket_name text NOT NULL DEFAULT 'article-images',
  caption text,
  display_order integer NOT NULL DEFAULT 0,
  is_featured boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for article_images
CREATE INDEX idx_article_images_article_id ON article_images(article_id);
CREATE INDEX idx_article_images_display_order ON article_images(article_id, display_order);

-- =====================================================
-- RLS POLICIES FOR ARTICLES
-- =====================================================
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Public read access for published articles
CREATE POLICY "Anyone can view published articles" ON articles
  FOR SELECT
  USING (status = 'published' AND published_at IS NOT NULL);

-- Admins can do everything
CREATE POLICY "Admins can manage all articles" ON articles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES FOR ARTICLE IMAGES
-- =====================================================
ALTER TABLE article_images ENABLE ROW LEVEL SECURITY;

-- Public read access for images of published articles
CREATE POLICY "Anyone can view published article images" ON article_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = article_images.article_id
        AND articles.status = 'published'
        AND articles.published_at IS NOT NULL
    )
  );

-- Admins can manage all article images
CREATE POLICY "Admins can manage all article images" ON article_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- =====================================================
-- STORAGE BUCKET FOR ARTICLE IMAGES
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for article images bucket
CREATE POLICY "Anyone can view article images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'article-images');

CREATE POLICY "Authenticated users can upload article images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'article-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can delete article images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'article-images'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for articles table
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE articles IS 'Blog articles for commercial property insights';
COMMENT ON TABLE article_images IS 'Image gallery for articles (2-3 images per article)';
COMMENT ON COLUMN articles.body IS 'Article content in Markdown format';
COMMENT ON COLUMN articles.status IS 'Article publication status: draft, published, or archived';
COMMENT ON COLUMN article_images.is_featured IS 'First image displayed as featured/hero image';
COMMENT ON COLUMN article_images.display_order IS 'Order of images in the gallery';
