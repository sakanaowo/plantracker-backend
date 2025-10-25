-- Migration: Add Project Members Support
-- Purpose: Enable project-level access control and team collaboration
-- Date: 2025-10-25

-- ============================================================================
-- STEP 1: Create project_role enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE project_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: Create project_members table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'MEMBER',
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_project_user UNIQUE(project_id, user_id)
);

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_members_project 
  ON project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user 
  ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_role 
  ON project_members(project_id, role);

-- ============================================================================
-- STEP 4: Migrate existing PERSONAL projects
-- Auto-add workspace members to personal projects with appropriate roles
-- ============================================================================

INSERT INTO project_members (project_id, user_id, role, created_at)
SELECT 
  p.id AS project_id,
  m.user_id,
  CASE 
    WHEN m.role = 'OWNER' THEN 'OWNER'::project_role
    WHEN m.role = 'ADMIN' THEN 'ADMIN'::project_role
    ELSE 'MEMBER'::project_role
  END AS role,
  NOW() AS created_at
FROM projects p
JOIN workspaces w ON p.workspace_id = w.id
JOIN memberships m ON m.workspace_id = w.id
WHERE p.type = 'PERSONAL'
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ============================================================================
-- STEP 5: Verification Queries
-- ============================================================================

-- Check project members distribution
SELECT 
  p.name AS project_name,
  p.type AS project_type,
  COUNT(pm.*) AS member_count,
  STRING_AGG(DISTINCT pm.role::text, ', ') AS roles
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id
GROUP BY p.id, p.name, p.type
ORDER BY p.created_at DESC;

-- Check users with project access
SELECT 
  u.name AS user_name,
  u.email,
  COUNT(pm.*) AS projects_count,
  STRING_AGG(DISTINCT pm.role::text, ', ') AS roles_held
FROM users u
LEFT JOIN project_members pm ON pm.user_id = u.id
GROUP BY u.id, u.name, u.email
ORDER BY projects_count DESC;

-- Summary statistics
SELECT 
  'Total Projects' AS metric,
  COUNT(*)::text AS value
FROM projects
UNION ALL
SELECT 
  'Projects with Members' AS metric,
  COUNT(DISTINCT project_id)::text AS value
FROM project_members
UNION ALL
SELECT 
  'Total Project Members' AS metric,
  COUNT(*)::text AS value
FROM project_members
UNION ALL
SELECT 
  'Average Members per Project' AS metric,
  ROUND(AVG(member_count), 2)::text AS value
FROM (
  SELECT project_id, COUNT(*) AS member_count
  FROM project_members
  GROUP BY project_id
) AS stats;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- DROP TABLE IF EXISTS project_members CASCADE;
-- DROP TYPE IF EXISTS project_role;
