-- Migration: Change labels from workspace-level to project-level
-- Date: 2025-10-26
-- Description: Labels now belong to projects instead of workspaces

BEGIN;

-- Step 1: Add project_id column (nullable first)
ALTER TABLE labels ADD COLUMN IF NOT EXISTS project_id UUID;

-- Step 2: Create a temporary mapping table to help with data migration
CREATE TEMP TABLE label_project_mapping AS
SELECT 
  l.id as label_id,
  l.workspace_id,
  p.id as project_id
FROM labels l
CROSS JOIN projects p
WHERE p.workspace_id = l.workspace_id
  AND l.project_id IS NULL;

-- Step 3: For each existing label, duplicate it for each project in the workspace
-- This ensures all projects get copies of workspace-wide labels
INSERT INTO labels (project_id, name, color, created_at, updated_at)
SELECT 
  lpm.project_id,
  l.name,
  l.color,
  l.created_at,
  NOW()
FROM labels l
INNER JOIN label_project_mapping lpm ON l.id = lpm.label_id
WHERE l.project_id IS NULL;

-- Step 4: Update task_labels to point to the new project-scoped labels
-- Match tasks to their corresponding project labels
UPDATE task_labels tl
SET label_id = nl.id
FROM tasks t
INNER JOIN labels l ON tl.label_id = l.id
INNER JOIN labels nl ON nl.project_id = t.project_id AND nl.name = l.name AND nl.color = l.color
WHERE tl.task_id = t.id
  AND l.project_id IS NULL
  AND nl.project_id IS NOT NULL;

-- Step 5: Delete old workspace-level labels (without project_id)
DELETE FROM labels WHERE project_id IS NULL;

-- Step 6: Make project_id NOT NULL and add constraint
ALTER TABLE labels ALTER COLUMN project_id SET NOT NULL;

-- Step 7: Drop old workspace_id foreign key constraint
ALTER TABLE labels DROP CONSTRAINT IF EXISTS labels_workspace_id_fkey;

-- Step 8: Drop workspace_id column
ALTER TABLE labels DROP COLUMN IF EXISTS workspace_id;

-- Step 9: Add foreign key constraint for project_id
ALTER TABLE labels DROP CONSTRAINT IF EXISTS labels_project_id_fkey;
ALTER TABLE labels ADD CONSTRAINT labels_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Step 10: Create index for better query performance
DROP INDEX IF EXISTS idx_labels_project;
CREATE INDEX idx_labels_project ON labels(project_id, created_at);

-- Step 11: Add unique constraint for name within project (recommended)
-- This prevents duplicate label names within the same project
ALTER TABLE labels DROP CONSTRAINT IF EXISTS labels_project_name_unique;
ALTER TABLE labels ADD CONSTRAINT labels_project_name_unique UNIQUE (project_id, name);

COMMIT;

-- Verification queries (run these after migration)
-- Check label distribution across projects:
-- SELECT p.name as project_name, COUNT(l.id) as label_count 
-- FROM projects p 
-- LEFT JOIN labels l ON l.project_id = p.id 
-- GROUP BY p.id, p.name;

-- Check task_labels are still valid:
-- SELECT COUNT(*) FROM task_labels tl
-- INNER JOIN tasks t ON tl.task_id = t.id
-- INNER JOIN labels l ON tl.label_id = l.id
-- WHERE t.project_id = l.project_id;
