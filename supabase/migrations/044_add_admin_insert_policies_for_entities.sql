-- Migration: Add admin INSERT policies for brands, fascias, and categories
-- Purpose: Allow admins to create new brands, fascias, and categories during store imports

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Admins can insert brands" ON brands;
DROP POLICY IF EXISTS "Admins can insert fascias" ON fascias;
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins can insert fascia categories" ON fascia_categories;
DROP POLICY IF EXISTS "Admins can update fascia categories" ON fascia_categories;
DROP POLICY IF EXISTS "Admins can insert stores" ON stores;

-- Brands: Allow admins to insert
CREATE POLICY "Admins can insert brands"
  ON brands
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Fascias: Allow admins to insert
CREATE POLICY "Admins can insert fascias"
  ON fascias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Categories: Allow admins to insert
CREATE POLICY "Admins can insert categories"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Fascia Categories: Allow admins to insert/upsert
CREATE POLICY "Admins can insert fascia categories"
  ON fascia_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Fascia Categories: Allow admins to update (needed for upsert)
CREATE POLICY "Admins can update fascia categories"
  ON fascia_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Stores: Allow admins to insert
CREATE POLICY "Admins can insert stores"
  ON stores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Add comments
COMMENT ON POLICY "Admins can insert brands" ON brands IS 'Allows admin users to create new brands during store imports';
COMMENT ON POLICY "Admins can insert fascias" ON fascias IS 'Allows admin users to create new fascias during store imports';
COMMENT ON POLICY "Admins can insert categories" ON categories IS 'Allows admin users to create new categories during store imports';
COMMENT ON POLICY "Admins can insert fascia categories" ON fascia_categories IS 'Allows admin users to link fascias to categories during store imports';
COMMENT ON POLICY "Admins can update fascia categories" ON fascia_categories IS 'Allows admin users to update fascia-category links during upsert operations';
COMMENT ON POLICY "Admins can insert stores" ON stores IS 'Allows admin users to import stores in bulk';
