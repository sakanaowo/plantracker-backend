-- Migration: Simplify checklist structure
-- Merge `checklists` and `checklist_items` into single table `task_checklist_items`

-- Step 1: Create new simplified table
CREATE TABLE task_checklist_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  is_done    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Migrate existing data
-- Combine data from checklists + checklist_items
INSERT INTO task_checklist_items (id, task_id, content, is_done, created_at)
SELECT 
  ci.id,
  c.task_id,
  -- Optionally include checklist title in content for context
  CASE 
    WHEN c.title IS NOT NULL AND c.title != '' 
    THEN c.title || ': ' || ci.content
    ELSE ci.content
  END as content,
  ci.is_done,
  ci.created_at
FROM checklist_items ci
INNER JOIN checklists c ON ci.checklist_id = c.id
ORDER BY c.created_at, ci.position;

-- Step 3: Create index for performance
CREATE INDEX idx_task_checklist_task ON task_checklist_items(task_id, created_at);

-- Step 4: Drop old tables
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS checklists CASCADE;

-- Verification query (run after migration)
-- SELECT task_id, COUNT(*) as checklist_count 
-- FROM task_checklist_items 
-- GROUP BY task_id;
