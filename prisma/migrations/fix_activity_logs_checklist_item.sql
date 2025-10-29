-- Check if checklist_item_id column exists in activity_logs table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'activity_logs' 
  AND column_name = 'checklist_item_id';

-- If the above query returns no rows, run this migration:
-- Step 1: Add checklist_item_id column to activity_logs
ALTER TABLE activity_logs 
  ADD COLUMN IF NOT EXISTS checklist_item_id UUID REFERENCES checklist_items(id) ON DELETE CASCADE;

-- Step 2: Create index for checklist_item_id
CREATE INDEX IF NOT EXISTS idx_activity_checklist_item ON activity_logs(checklist_item_id, created_at);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'activity_logs' 
  AND column_name = 'checklist_item_id';
