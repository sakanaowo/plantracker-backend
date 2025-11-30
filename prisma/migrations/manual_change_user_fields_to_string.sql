-- Manual migration: Change user_id related fields from UUID to String
-- This migration converts user_id fields to support Firebase UID (string format)
-- Author: Database Migration
-- Date: 2025-11-29

BEGIN;

-- Step 1: Change uploaded_by in attachments from UUID to TEXT
ALTER TABLE attachments 
  ALTER COLUMN uploaded_by TYPE TEXT USING uploaded_by::TEXT;

-- Step 2: Change added_by in project_members from UUID to TEXT
ALTER TABLE project_members 
  ALTER COLUMN added_by TYPE TEXT USING added_by::TEXT;

-- Step 3: Change assigned_by in task_assignees from UUID to TEXT
ALTER TABLE task_assignees 
  ALTER COLUMN assigned_by TYPE TEXT USING assigned_by::TEXT;

COMMIT;

-- Verification queries (run these to verify the changes):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attachments' AND column_name = 'uploaded_by';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'project_members' AND column_name = 'added_by';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'task_assignees' AND column_name = 'assigned_by';
