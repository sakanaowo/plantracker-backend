-- Migration: Update activity logs to support checklist items and new actions
-- This migration adds support for tracking checklist item activities

-- Step 1: Add new enum values to activity_action
ALTER TYPE activity_action ADD VALUE 'CHECKED';
ALTER TYPE activity_action ADD VALUE 'UNCHECKED';
ALTER TYPE activity_action ADD VALUE 'DUPLICATED';
ALTER TYPE activity_action ADD VALUE 'LINKED';
ALTER TYPE activity_action ADD VALUE 'UNLINKED';

-- Step 2: Rename enum values in entity_type
-- Note: PostgreSQL doesn't support renaming enum values directly
-- We need to create a new enum and migrate

-- Create new enum with updated values
CREATE TYPE entity_type_new AS ENUM (
  'WORKSPACE',
  'PROJECT',
  'BOARD',
  'TASK',
  'TASK_CHECKLIST_ITEM',  -- Changed from CHECKLIST_ITEM
  'COMMENT',
  'ATTACHMENT',
  'LABEL',
  'SPRINT',
  'EVENT',
  'TIME_ENTRY',           -- New
  'WATCHER',              -- New
  'MEMBERSHIP'            -- New
);

-- Migrate existing data
-- Map old values to new ones
ALTER TABLE activity_logs 
  ALTER COLUMN entity_type TYPE entity_type_new 
  USING (
    CASE entity_type::text
      WHEN 'CHECKLIST' THEN 'TASK_CHECKLIST_ITEM'::entity_type_new
      WHEN 'CHECKLIST_ITEM' THEN 'TASK_CHECKLIST_ITEM'::entity_type_new
      ELSE entity_type::text::entity_type_new
    END
  );

-- Drop old enum
DROP TYPE entity_type;

-- Rename new enum to original name
ALTER TYPE entity_type_new RENAME TO entity_type;

-- Step 3: Add checklist_item_id column to activity_logs
ALTER TABLE activity_logs 
  ADD COLUMN checklist_item_id UUID REFERENCES task_checklist_items(id) ON DELETE CASCADE;

-- Step 4: Create index for checklist_item_id
CREATE INDEX idx_activity_checklist_item ON activity_logs(checklist_item_id, created_at);

-- Step 5: Migrate existing checklist activity data (if any)
-- Update entity_type for existing checklist-related activities
UPDATE activity_logs
SET entity_type = 'TASK_CHECKLIST_ITEM'
WHERE entity_type IN ('CHECKLIST', 'CHECKLIST_ITEM');

-- Step 6: Add comments for documentation
COMMENT ON COLUMN activity_logs.checklist_item_id IS 'Reference to checklist item when entity_type is TASK_CHECKLIST_ITEM';
COMMENT ON TYPE activity_action IS 'Actions that can be performed on entities. CHECKED/UNCHECKED for checklist items.';
COMMENT ON TYPE entity_type IS 'Types of entities that can have activity logs. Updated to use TASK_CHECKLIST_ITEM instead of CHECKLIST/CHECKLIST_ITEM.';

-- Verification queries
-- 1. Check new enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'activity_action'::regtype
ORDER BY enumsortorder;

-- 2. Check updated entity_type enum
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'entity_type'::regtype
ORDER BY enumsortorder;

-- 3. Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'activity_logs' 
  AND column_name = 'checklist_item_id';

-- 4. Verify index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'activity_logs'
  AND indexname = 'idx_activity_checklist_item';
