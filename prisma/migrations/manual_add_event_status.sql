-- Migration: Add event status and soft delete fields
-- Created: 2025-12-05

-- Step 1: Create event_status enum
CREATE TYPE event_status AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- Step 2: Add new columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS status event_status DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_events_status_start ON events(status, start_at);

-- Step 4: Update existing events to ACTIVE status
UPDATE events 
SET status = 'ACTIVE' 
WHERE status IS NULL;

-- Verification query
SELECT 
  COUNT(*) as total_events,
  SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_events,
  SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_events
FROM events;
