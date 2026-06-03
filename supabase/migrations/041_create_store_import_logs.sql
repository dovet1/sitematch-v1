-- Migration: Create store_import_logs table
-- Purpose: Track all store imports with detailed error reports and audit trail

CREATE TABLE store_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  inserted_rows INTEGER NOT NULL,
  skipped_rows INTEGER NOT NULL,
  blocked_rows INTEGER NOT NULL,
  error_report JSONB,
  is_dry_run BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_store_import_logs_user_id ON store_import_logs(user_id);
CREATE INDEX idx_store_import_logs_created_at ON store_import_logs(created_at DESC);
CREATE INDEX idx_store_import_logs_dry_run ON store_import_logs(is_dry_run);

-- Enable RLS
ALTER TABLE store_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can see all import logs
CREATE POLICY "Admins can view all import logs"
  ON store_import_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- RLS Policy: Admins can insert import logs
CREATE POLICY "Admins can insert import logs"
  ON store_import_logs
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
COMMENT ON TABLE store_import_logs IS 'Audit log of all store imports including errors and statistics';
COMMENT ON COLUMN store_import_logs.error_report IS 'JSONB containing detailed error information for skipped and blocked rows';
COMMENT ON COLUMN store_import_logs.is_dry_run IS 'True if this was a dry run (no actual data inserted)';
