-- Create table for LSOA neighbor relationships
-- This table stores which LSOAs are adjacent to each other (share a boundary)
-- Data generated from Python spatial analysis of LSOA boundaries

CREATE TABLE IF NOT EXISTS lsoa_neighbors (
  id BIGSERIAL PRIMARY KEY,
  lsoa_code TEXT NOT NULL,
  neighbor_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for fast lookups
CREATE INDEX idx_lsoa_neighbors_lsoa_code ON lsoa_neighbors(lsoa_code);
CREATE INDEX idx_lsoa_neighbors_neighbor_code ON lsoa_neighbors(neighbor_code);

-- Ensure no duplicate pairs
CREATE UNIQUE INDEX idx_lsoa_neighbors_unique_pair ON lsoa_neighbors(lsoa_code, neighbor_code);

-- Add comment
COMMENT ON TABLE lsoa_neighbors IS 'Adjacency relationships between LSOAs (Lower Layer Super Output Areas). Each row represents a shared boundary between two LSOAs.';
