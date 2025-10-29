-- Migration: Change labels from workspace-level to project-level
-- Date: 2025-10-26

-- Step 1: Add project_id column (nullable first)
ALTER TABLE labels ADD COLUMN project_id UUID;

-- Step 2: Populate project_id from existing workspace_id
-- For each label, assign it to all projects in that workspace
-- (This is a data migration - you may need to customize this based on your needs)
-- Option 1: Duplicate labels for each project in the workspace
INSERT INTO labels (workspace_id, project_id, name, color, created_at, updated_at)
SELECT 
  l.workspace_id,
  p.id as project_id,
  l.name,
  l.color,
  l.created_at,
  l.updated_at
FROM labels l
CROSS JOIN projects p
WHERE p.workspace_id = l.workspace_id
  AND l.project_id IS NULL;

-- Step 3: Delete old labels (without project_id)
DELETE FROM labels WHERE project_id IS NULL;

-- Step 4: Make project_id NOT NULL
ALTER TABLE labels ALTER COLUMN project_id SET NOT NULL;

-- Step 5: Drop workspace_id foreign key constraint
ALTER TABLE labels DROP CONSTRAINT IF EXISTS labels_workspace_id_fkey;

-- Step 6: Drop workspace_id column
ALTER TABLE labels DROP COLUMN workspace_id;

-- Step 7: Add foreign key constraint for project_id
ALTER TABLE labels ADD CONSTRAINT labels_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Step 8: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_labels_project ON labels(project_id, created_at);

-- Step 9: Add unique constraint for name within project (optional, recommended)
-- Uncomment if you want unique label names per project
-- ALTER TABLE labels ADD CONSTRAINT labels_project_name_unique UNIQUE (project_id, name);
