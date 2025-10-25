# Project Members Migration Guide

## ⚠️ IMPORTANT: Manual Migration Required

The `project_members` table must be created before using the Project Members API endpoints.

## Prerequisites

- Access to Neon PostgreSQL database
- `psql` client installed, OR access to Neon SQL Editor in web dashboard

## Option 1: Using psql Command Line

### Step 1: Get Connection String

From your Neon dashboard or `.env` file:

```bash
# Example connection string
postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/plantracker?sslmode=require
```

### Step 2: Run Migration

```bash
# Connect and run migration in one command
psql "your-connection-string-here" -f prisma/migrations/manual_add_project_members.sql

# OR connect first, then run
psql "your-connection-string-here"
# Then in psql shell:
\i prisma/migrations/manual_add_project_members.sql
```

### Step 3: Verify Migration

```sql
-- Check enum was created
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'project_role'::regtype 
ORDER BY enumsortorder;

-- Expected output:
--  enumlabel 
-- -----------
--  OWNER
--  ADMIN
--  MEMBER
--  VIEWER
-- (4 rows)

-- Check table was created
\d project_members

-- Expected: Shows table structure with columns:
-- id, project_id, user_id, role, added_by, created_at

-- Check indexes
\di project_members*

-- Expected: Shows 3 indexes:
-- - project_members_pkey (PRIMARY KEY)
-- - project_members_project_id_user_id_key (UNIQUE)
-- - idx_project_members_project
-- - idx_project_members_user

-- Count migrated members from PERSONAL projects
SELECT COUNT(*) FROM project_members;

-- Check distribution by project type
SELECT 
  p.type,
  COUNT(DISTINCT pm.project_id) as projects_with_members,
  COUNT(pm.id) as total_members
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
GROUP BY p.type;
```

## Option 2: Using Neon SQL Editor (Web)

### Step 1: Access SQL Editor

1. Go to https://console.neon.tech
2. Select your project
3. Click "SQL Editor" in left sidebar

### Step 2: Copy Migration Script

1. Open `prisma/migrations/manual_add_project_members.sql` in your code editor
2. Copy the ENTIRE content (including comments)
3. Paste into Neon SQL Editor
4. Click "Run" button

### Step 3: Verify (Run Each Query Separately)

```sql
-- 1. Check enum
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'project_role'::regtype;

-- 2. Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'project_members';

-- 3. Count members
SELECT COUNT(*) FROM project_members;

-- 4. Sample data
SELECT 
  pm.id,
  pm.role,
  u.email as user_email,
  p.name as project_name,
  p.type as project_type
FROM project_members pm
JOIN users u ON u.id = pm.user_id
JOIN projects p ON p.id = pm.project_id
LIMIT 10;
```

## What the Migration Does

### 1. Creates Enum Type

```sql
CREATE TYPE project_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
```

### 2. Creates Table

```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'MEMBER',
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
```

### 3. Adds Indexes

```sql
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

### 4. Migrates Existing Data

**For all PERSONAL projects:**
- Finds workspace members
- Adds them to project with matching role:
  - Workspace OWNER → Project OWNER
  - Workspace ADMIN → Project ADMIN
  - Workspace MEMBER/VIEWER → Project MEMBER

Example: If workspace has 3 members, and 5 PERSONAL projects, this creates 15 project_members records (3 × 5).

## After Migration

### Step 1: Regenerate Prisma Client

```bash
cd /home/sakana/Code/plantracker-backend
npx prisma generate
```

Expected output:
```
✔ Generated Prisma Client (v6.15.0) to ./node_modules/@prisma/client
```

### Step 2: Rebuild Application

```bash
npm run build
```

Expected: Build completes without errors.

### Step 3: Test API Endpoints

Use Postman or HTTP client to test:

```http
### List members of a project
GET http://localhost:3000/projects/{{projectId}}/members
Authorization: Bearer {{jwt_token}}

### Invite member (user must exist in DB)
POST http://localhost:3000/projects/{{projectId}}/members/invite
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "email": "user@example.com",
  "role": "MEMBER"
}

### Update member role
PATCH http://localhost:3000/projects/{{projectId}}/members/{{memberId}}
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "role": "ADMIN"
}
```

## Troubleshooting

### Error: "type project_role already exists"

**Cause:** Migration was run before and failed mid-process.

**Solution:**
```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'project_members';

-- If table exists but is broken, drop everything and start over:
DROP TABLE IF EXISTS project_members CASCADE;
DROP TYPE IF EXISTS project_role CASCADE;

-- Then re-run the migration
```

### Error: "relation project_members does not exist"

**Cause:** Migration not run yet.

**Solution:** Run the migration script (see Option 1 or 2 above).

### Error: "column project_members.role does not exist"

**Cause:** Prisma client not regenerated after migration.

**Solution:**
```bash
npx prisma generate
npm run build
```

### Error: "User not found with email: xxx"

**Cause:** Trying to invite user who doesn't exist in database.

**Fix:** User must sign up first, or create user manually:
```sql
INSERT INTO users (id, email, name) 
VALUES (gen_random_uuid(), 'user@example.com', 'User Name');
```

### Error: "Can only invite members to TEAM projects"

**Cause:** Trying to invite to PERSONAL project.

**Solution:** Convert project to TEAM first:
```http
POST http://localhost:3000/projects/{{projectId}}/convert-to-team
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "keepCurrentMembers": true
}
```

## Rollback (If Needed)

To completely remove project members feature:

```sql
-- Drop table and enum
DROP TABLE IF EXISTS project_members CASCADE;
DROP TYPE IF EXISTS project_role CASCADE;

-- Regenerate Prisma client
-- Run in terminal:
-- npx prisma db pull
-- npx prisma generate
```

## Verification Queries

### Summary Statistics

```sql
-- Overall stats
SELECT 
  (SELECT COUNT(*) FROM project_members) as total_members,
  (SELECT COUNT(DISTINCT project_id) FROM project_members) as projects_with_members,
  (SELECT COUNT(DISTINCT user_id) FROM project_members) as unique_users;
```

### Members by Role

```sql
SELECT 
  role,
  COUNT(*) as count
FROM project_members
GROUP BY role
ORDER BY 
  CASE role
    WHEN 'OWNER' THEN 1
    WHEN 'ADMIN' THEN 2
    WHEN 'MEMBER' THEN 3
    WHEN 'VIEWER' THEN 4
  END;
```

### Projects by Type

```sql
SELECT 
  p.type,
  COUNT(DISTINCT pm.project_id) as projects_with_members,
  AVG(member_count) as avg_members_per_project
FROM (
  SELECT project_id, COUNT(*) as member_count
  FROM project_members
  GROUP BY project_id
) pm_counts
JOIN projects p ON p.id = pm_counts.project_id
GROUP BY p.type;
```

### Users with Most Projects

```sql
SELECT 
  u.name,
  u.email,
  COUNT(DISTINCT pm.project_id) as project_count,
  array_agg(DISTINCT pm.role) as roles
FROM project_members pm
JOIN users u ON u.id = pm.user_id
GROUP BY u.id, u.name, u.email
ORDER BY project_count DESC
LIMIT 10;
```

## Migration Complete Checklist

- [ ] Migration script executed successfully
- [ ] Enum `project_role` created (4 values: OWNER, ADMIN, MEMBER, VIEWER)
- [ ] Table `project_members` created with correct schema
- [ ] Indexes created (project_id, user_id, unique constraint)
- [ ] Existing PERSONAL projects have members migrated
- [ ] Verification queries return expected results
- [ ] Prisma client regenerated (`npx prisma generate`)
- [ ] Application builds successfully (`npm run build`)
- [ ] API endpoints tested with valid JWT token
- [ ] Can invite members to TEAM projects
- [ ] Can convert PERSONAL → TEAM projects
- [ ] Activity logs working for member actions

## Next Steps After Migration

1. **Test Frontend Integration:**
   - Update API client with new endpoints
   - Build team management UI
   - Test permission-based UI rendering

2. **Create Test Data:**
   ```sql
   -- Convert a project to TEAM for testing
   UPDATE projects SET type = 'TEAM' WHERE id = 'your-project-id';
   
   -- Add test members with different roles
   INSERT INTO project_members (project_id, user_id, role, added_by)
   VALUES 
     ('project-id', 'user1-id', 'OWNER', 'user1-id'),
     ('project-id', 'user2-id', 'ADMIN', 'user1-id'),
     ('project-id', 'user3-id', 'MEMBER', 'user1-id'),
     ('project-id', 'user4-id', 'VIEWER', 'user1-id');
   ```

3. **Monitor Performance:**
   - Check query execution plans
   - Monitor index usage
   - Optimize if needed

---

**Status:** Migration must be run manually before using Project Members feature  
**Impact:** Adds team collaboration features without breaking existing functionality  
**Rollback:** Fully reversible (see Rollback section above)
