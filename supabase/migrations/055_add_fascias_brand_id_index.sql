-- Add index on fascias.brand_id for optimal query performance
-- Uses IF NOT EXISTS to safely handle case where index may already exist

CREATE INDEX IF NOT EXISTS idx_fascias_brand_id ON fascias(brand_id);
