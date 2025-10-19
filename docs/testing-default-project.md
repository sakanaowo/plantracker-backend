# Testing Default Project Creation

## 🎯 Mục Đích

Kiểm tra logic tạo workspace và default project cho user mới.

## 🚀 Cách Chạy Test

### Option 1: Chạy test script

```bash
npx ts-node test-scripts/test-default-project.ts
```

### Option 2: Chạy queries trực tiếp

```bash
npx prisma studio
```

Sau đó chạy các queries SQL trong docs.

## 📋 Test Cases

### 1. Empty Workspaces

Tìm workspaces không có projects (có thể cần tạo default project):

```sql
SELECT w.id, w.name, w.type, COUNT(p.id) as project_count
FROM workspaces w
LEFT JOIN projects p ON w.id = p.workspace_id
WHERE w.type = 'PERSONAL'
GROUP BY w.id, w.name, w.type
HAVING COUNT(p.id) = 0;
```

### 2. Projects Without Boards

Tìm projects không có boards (board creation failed):

```sql
SELECT p.id, p.name, p.key, w.name as workspace_name, COUNT(b.id) as board_count
FROM projects p
LEFT JOIN boards b ON p.id = b.project_id
JOIN workspaces w ON p.workspace_id = w.id
GROUP BY p.id, p.name, p.key, w.name
HAVING COUNT(b.id) = 0;
```

### 3. Duplicate MFP Keys

Tìm workspaces có nhiều projects với key "MFP":

```sql
SELECT workspace_id, COUNT(*) as mfp_count
FROM projects
WHERE key LIKE 'MFP%'
GROUP BY workspace_id
HAVING COUNT(*) > 1;
```

### 4. Default Project Structure

Verify structure của default projects:

```sql
SELECT
  p.id,
  p.name,
  p.key,
  w.name as workspace_name,
  COUNT(b.id) as board_count,
  STRING_AGG(b.name, ', ' ORDER BY b.order) as board_names
FROM projects p
JOIN workspaces w ON p.workspace_id = w.id
LEFT JOIN boards b ON p.id = b.project_id
WHERE p.name = 'My First Project'
GROUP BY p.id, p.name, p.key, w.name;
```

### 5. Workspaces Without Owner

Tìm workspaces không có OWNER membership:

```sql
SELECT w.id, w.name, w.type, COUNT(m.user_id) as owner_count
FROM workspaces w
LEFT JOIN memberships m ON w.id = m.workspace_id AND m.role = 'OWNER'
WHERE w.type = 'PERSONAL'
GROUP BY w.id, w.name, w.type
HAVING COUNT(m.user_id) = 0;
```

## 🐛 Common Issues & Fixes

### Issue 1: Workspace có nhưng không có project

**Nguyên nhân:**

- Default project creation failed
- Graceful degradation đã catch error

**Fix:**

```typescript
// Run manually trong console hoặc API endpoint
await workspacesService.createDefaultProjectForWorkspace(workspaceId);
```

### Issue 2: Project có nhưng không có boards

**Nguyên nhân:**

- Board creation transaction failed
- Database timeout

**Fix:**

```sql
-- Tạo boards manually
INSERT INTO boards (id, project_id, name, "order", created_at, updated_at)
VALUES
  (uuid_generate_v4(), '<project_id>', 'To Do', 1, NOW(), NOW()),
  (uuid_generate_v4(), '<project_id>', 'In Progress', 2, NOW(), NOW()),
  (uuid_generate_v4(), '<project_id>', 'Done', 3, NOW(), NOW());
```

### Issue 3: Duplicate MFP keys trong cùng workspace

**Nguyên nhân:**

- Race condition (nhiều requests cùng lúc)
- Retry logic failed

**Fix:**

```sql
-- Rename duplicate projects
UPDATE projects
SET key = 'MFP2'
WHERE id = '<duplicate_project_id>';
```

### Issue 4: Workspace không có owner membership

**Nguyên nhân:**

- Transaction rollback
- Membership creation failed

**Fix:**

```sql
INSERT INTO memberships (id, user_id, workspace_id, role, created_at)
VALUES (uuid_generate_v4(), '<user_id>', '<workspace_id>', 'OWNER', NOW());
```

## 📊 Monitoring Queries

### Check Recent User Registrations

```sql
SELECT
  u.id,
  u.email,
  u.name,
  u.created_at,
  COUNT(DISTINCT w.id) as workspace_count,
  COUNT(DISTINCT p.id) as project_count
FROM users u
LEFT JOIN workspaces w ON u.id = w.owner_id AND w.type = 'PERSONAL'
LEFT JOIN projects p ON w.id = p.workspace_id
WHERE u.created_at > NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email, u.name, u.created_at
ORDER BY u.created_at DESC;
```

### Check Default Projects Created Today

```sql
SELECT
  p.id,
  p.name,
  p.key,
  p.created_at,
  w.name as workspace_name,
  u.email as owner_email,
  COUNT(b.id) as board_count
FROM projects p
JOIN workspaces w ON p.workspace_id = w.id
JOIN users u ON w.owner_id = u.id
LEFT JOIN boards b ON p.id = b.project_id
WHERE p.name = 'My First Project'
  AND p.created_at > NOW() - INTERVAL '24 hours'
GROUP BY p.id, p.name, p.key, p.created_at, w.name, u.email
ORDER BY p.created_at DESC;
```

## 🔍 Debug Logs

Khi test, quan sát các logs sau:

### Success Logs

```
Workspace <id> already has projects, skipping default project creation
```

### Retry Logs

```
Key conflict for workspace <id>, trying with auto-generated key
```

### Error Logs

```
Failed to create default project for workspace <id>: <error>
```

## ✅ Expected Results

Sau khi user mới đăng ký:

1. ✅ User record trong `users` table
2. ✅ Personal workspace trong `workspaces` table
3. ✅ OWNER membership trong `memberships` table
4. ✅ "My First Project" trong `projects` table với key "MFP" (hoặc MFP2, MFP3)
5. ✅ 3 boards: "To Do" (order 1), "In Progress" (order 2), "Done" (order 3)

## 🚨 Alert Thresholds

Set up monitoring alerts cho:

- **Empty workspaces > 5**: Có thể có issue với default project creation
- **Projects without boards > 5**: Board creation đang fail
- **Duplicate MFP keys > 0**: Race condition đang xảy ra
- **Workspaces without owner > 0**: Membership creation failed
