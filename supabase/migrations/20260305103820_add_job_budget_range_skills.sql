/*
  # Add Budget Range and Skills Context to Jobs

  1. Changes
    - Add `min_budget` (numeric, replaces single budget)
    - Add `max_budget` (numeric, replaces single budget)
    - Add `required_skills` (text, comma separated list) to jobs table
*/

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS min_budget numeric,
  ADD COLUMN IF NOT EXISTS max_budget numeric,
  ADD COLUMN IF NOT EXISTS required_skills text;

-- Backfill data: Move existing budget to min_budget & max_budget
UPDATE jobs 
SET 
  min_budget = budget,
  max_budget = budget 
WHERE min_budget IS NULL;

-- Make them required moving forward implicitly through app code (or you can add NOT NULL if you are sure)
-- For safety on existing data, leaving them nullable in schema but enforcing in app.
