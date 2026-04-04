-- Migration: Add phone logging columns to outreach_log for debugging.
-- This helps verify the effectiveness of the normalization utility.

ALTER TABLE outreach_log 
ADD COLUMN IF NOT EXISTS original_phone text,
ADD COLUMN IF NOT EXISTS normalized_phone text;
