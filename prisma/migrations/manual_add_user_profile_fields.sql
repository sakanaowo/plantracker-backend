-- Migration: Add user profile fields
-- Date: 2024-12-02
-- Description: Add bio, job_title, phone_number, and last_seen_at to users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN users.bio IS 'User biography/about text';
COMMENT ON COLUMN users.job_title IS 'User job title or position';
COMMENT ON COLUMN users.phone_number IS 'User phone number';
COMMENT ON COLUMN users.last_seen_at IS 'Last time user was active';
