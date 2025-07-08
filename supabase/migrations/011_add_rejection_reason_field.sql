-- Migration: Add rejection_reason field to listings table
-- Story: 5.0 - Admin Moderation System
-- Task: 4 - Moderation Actions Implementation

-- Add rejection_reason field to store rejection reasons for moderation
ALTER TABLE listings 
ADD COLUMN rejection_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN listings.rejection_reason IS 'Reason for rejection when listing status is set to rejected. Required when status = rejected.';

-- Add check constraint to ensure rejection_reason is provided when status is rejected
-- This will be enforced at the application level initially, but we can add DB constraints later if needed