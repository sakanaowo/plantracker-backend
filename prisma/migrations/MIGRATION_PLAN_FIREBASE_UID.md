# Migration Plan: Chuyển User ID sang Firebase UID

## 📋 Mục Tiêu

Thay đổi `users.id` từ auto-generated UUID sang Firebase UID được gán thủ công.

### Trước:
- `users.id`: UUID auto-generated bởi PostgreSQL
- `users.firebase_uid`: String unique (Firebase UID)
- FK columns: `@db.Uuid` type

### Sau:
- `users.id`: String (Firebase UID) - gán thủ công
- ❌ Xóa column `firebase_uid`
- FK columns: String type (bỏ `@db.Uuid`)

---

## 🎯 Migration Strategy

### Option 1: Clean Slate (Recommended cho DB mới/ít data)
- Drop toàn bộ data
- Tạo lại schema mới
- Users đăng ký lại

### Option 2: Data Preservation (Cho production có data)
- Migrate existing users
- Update tất cả FK references
- Downtime: 30 phút - 2 giờ

---

## 📝 Step-by-Step Migration (Option 2)

### Phase 1: Preparation

**1.1. Backup Database**
```bash
# Sử dụng Neon Dashboard để tạo backup
# Hoặc export data
pg_dump "$NEON_DATABASE_URL" > backup_before_migration.sql
```

**1.2. Verify Data Integrity**
```sql
-- Check NULL firebase_uid
SELECT COUNT(*) FROM users WHERE firebase_uid IS NULL;
-- Phải = 0

-- Check duplicates
SELECT firebase_uid, COUNT(*) 
FROM users 
GROUP BY firebase_uid 
HAVING COUNT(*) > 1;
-- Phải empty

-- Check FK integrity
SELECT 'activity_logs' as table_name, COUNT(*) FROM activity_logs WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'memberships', COUNT(*) FROM memberships WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'project_members', COUNT(*) FROM project_members WHERE user_id NOT IN (SELECT id FROM users);
-- Tất cả phải = 0
```

---

### Phase 2: Database Migration

**2.1. Add Temporary Columns**
```sql
-- Tạo temp columns để giữ Firebase UID
ALTER TABLE users ADD COLUMN id_new TEXT;
UPDATE users SET id_new = firebase_uid;

-- Tạo temp FK columns
ALTER TABLE activity_logs ADD COLUMN user_id_new TEXT;
ALTER TABLE attachments ADD COLUMN uploaded_by_new TEXT;
ALTER TABLE events ADD COLUMN created_by_new TEXT;
ALTER TABLE integration_tokens ADD COLUMN user_id_new TEXT;
ALTER TABLE memberships ADD COLUMN user_id_new TEXT;
ALTER TABLE notifications ADD COLUMN user_id_new TEXT;
ALTER TABLE notifications ADD COLUMN created_by_new TEXT;
ALTER TABLE participants ADD COLUMN user_id_new TEXT;
ALTER TABLE project_members ADD COLUMN user_id_new TEXT;
ALTER TABLE project_invitations ADD COLUMN user_id_new TEXT;
ALTER TABLE project_invitations ADD COLUMN invited_by_new TEXT;
ALTER TABLE task_assignees ADD COLUMN user_id_new TEXT;
ALTER TABLE task_assignees ADD COLUMN assigned_by_new TEXT;
ALTER TABLE task_comments ADD COLUMN user_id_new TEXT;
ALTER TABLE tasks ADD COLUMN created_by_new TEXT;
ALTER TABLE time_entries ADD COLUMN user_id_new TEXT;
ALTER TABLE user_devices ADD COLUMN user_id_new TEXT;
ALTER TABLE watchers ADD COLUMN user_id_new TEXT;
ALTER TABLE workspaces ADD COLUMN owner_id_new TEXT;
```

**2.2. Migrate Foreign Key Data**
```sql
-- Map UUID -> Firebase UID for all FK columns
UPDATE activity_logs SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE attachments SET uploaded_by_new = (SELECT firebase_uid FROM users WHERE id = uploaded_by) WHERE uploaded_by IS NOT NULL;
UPDATE events SET created_by_new = (SELECT firebase_uid FROM users WHERE id = created_by) WHERE created_by IS NOT NULL;
UPDATE integration_tokens SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE memberships SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE notifications SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE notifications SET created_by_new = (SELECT firebase_uid FROM users WHERE id = created_by) WHERE created_by IS NOT NULL;
UPDATE participants SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id) WHERE user_id IS NOT NULL;
UPDATE project_members SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE project_invitations SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE project_invitations SET invited_by_new = (SELECT firebase_uid FROM users WHERE id = invited_by);
UPDATE task_assignees SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE task_assignees SET assigned_by_new = (SELECT firebase_uid FROM users WHERE id = assigned_by) WHERE assigned_by IS NOT NULL;
UPDATE task_comments SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE tasks SET created_by_new = (SELECT firebase_uid FROM users WHERE id = created_by) WHERE created_by IS NOT NULL;
UPDATE time_entries SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE user_devices SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE watchers SET user_id_new = (SELECT firebase_uid FROM users WHERE id = user_id);
UPDATE workspaces SET owner_id_new = (SELECT firebase_uid FROM users WHERE id = owner_id);
```

**2.3. Verify Migration**
```sql
-- Check NULLs (should be 0)
SELECT COUNT(*) FROM activity_logs WHERE user_id_new IS NULL;
SELECT COUNT(*) FROM memberships WHERE user_id_new IS NULL;
-- ... kiểm tra tất cả tables
```

**2.4. Drop Old Constraints and Indexes**
```sql
-- Drop all FK constraints
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_uploaded_by_fkey;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE integration_tokens DROP CONSTRAINT IF EXISTS integration_tokens_user_id_fkey;
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_user_id_fkey;
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS project_invitations_user_id_fkey;
ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS project_invitations_invited_by_fkey;
ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_user_id_fkey;
ALTER TABLE task_comments DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;
ALTER TABLE user_devices DROP CONSTRAINT IF EXISTS user_devices_user_id_fkey;
ALTER TABLE watchers DROP CONSTRAINT IF EXISTS watchers_user_id_fkey;
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;

-- Drop indexes
DROP INDEX IF EXISTS idx_activity_user;
DROP INDEX IF EXISTS idx_integration_user_provider;
DROP INDEX IF EXISTS idx_notifications_user_sched;
DROP INDEX IF EXISTS idx_project_members_user;
DROP INDEX IF EXISTS idx_project_invitations_user;
DROP INDEX IF EXISTS idx_task_assignees_user;
DROP INDEX IF EXISTS idx_time_entries_user_start;
DROP INDEX IF EXISTS idx_user_devices_user_active;

-- Drop composite unique constraints
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_user_id_workspace_id_key;
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_id_user_id_key;
ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS project_invitations_project_id_user_id_key;
ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_pkey;
ALTER TABLE watchers DROP CONSTRAINT IF EXISTS watchers_pkey;
ALTER TABLE integration_tokens DROP CONSTRAINT IF EXISTS user_id_provider;
```

**2.5. Swap Columns**
```sql
-- Users table
ALTER TABLE users DROP CONSTRAINT users_pkey;
ALTER TABLE users DROP COLUMN id;
ALTER TABLE users RENAME COLUMN id_new TO id;
ALTER TABLE users DROP COLUMN firebase_uid;
ALTER TABLE users ADD PRIMARY KEY (id);

-- All FK tables
ALTER TABLE activity_logs DROP COLUMN user_id;
ALTER TABLE activity_logs RENAME COLUMN user_id_new TO user_id;
ALTER TABLE activity_logs ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE attachments DROP COLUMN uploaded_by;
ALTER TABLE attachments RENAME COLUMN uploaded_by_new TO uploaded_by;

ALTER TABLE events DROP COLUMN created_by;
ALTER TABLE events RENAME COLUMN created_by_new TO created_by;

ALTER TABLE integration_tokens DROP COLUMN user_id;
ALTER TABLE integration_tokens RENAME COLUMN user_id_new TO user_id;
ALTER TABLE integration_tokens ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE memberships DROP COLUMN user_id;
ALTER TABLE memberships RENAME COLUMN user_id_new TO user_id;
ALTER TABLE memberships ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE notifications DROP COLUMN user_id;
ALTER TABLE notifications RENAME COLUMN user_id_new TO user_id;
ALTER TABLE notifications ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE notifications DROP COLUMN created_by;
ALTER TABLE notifications RENAME COLUMN created_by_new TO created_by;

ALTER TABLE participants DROP COLUMN user_id;
ALTER TABLE participants RENAME COLUMN user_id_new TO user_id;

ALTER TABLE project_members DROP COLUMN user_id;
ALTER TABLE project_members RENAME COLUMN user_id_new TO user_id;
ALTER TABLE project_members ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE project_invitations DROP COLUMN user_id;
ALTER TABLE project_invitations RENAME COLUMN user_id_new TO user_id;
ALTER TABLE project_invitations ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE project_invitations DROP COLUMN invited_by;
ALTER TABLE project_invitations RENAME COLUMN invited_by_new TO invited_by;
ALTER TABLE project_invitations ALTER COLUMN invited_by SET NOT NULL;

ALTER TABLE task_assignees DROP COLUMN user_id;
ALTER TABLE task_assignees RENAME COLUMN user_id_new TO user_id;
ALTER TABLE task_assignees ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE task_assignees DROP COLUMN assigned_by;
ALTER TABLE task_assignees RENAME COLUMN assigned_by_new TO assigned_by;

ALTER TABLE task_comments DROP COLUMN user_id;
ALTER TABLE task_comments RENAME COLUMN user_id_new TO user_id;
ALTER TABLE task_comments ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE tasks DROP COLUMN created_by;
ALTER TABLE tasks RENAME COLUMN created_by_new TO created_by;

ALTER TABLE time_entries DROP COLUMN user_id;
ALTER TABLE time_entries RENAME COLUMN user_id_new TO user_id;
ALTER TABLE time_entries ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE user_devices DROP COLUMN user_id;
ALTER TABLE user_devices RENAME COLUMN user_id_new TO user_id;
ALTER TABLE user_devices ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE watchers DROP COLUMN user_id;
ALTER TABLE watchers RENAME COLUMN user_id_new TO user_id;
ALTER TABLE watchers ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE workspaces DROP COLUMN owner_id;
ALTER TABLE workspaces RENAME COLUMN owner_id_new TO owner_id;
ALTER TABLE workspaces ALTER COLUMN owner_id SET NOT NULL;
```

**2.6. Recreate Constraints and Indexes**
```sql
-- Recreate FK constraints
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE integration_tokens ADD CONSTRAINT integration_tokens_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE memberships ADD CONSTRAINT memberships_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE participants ADD CONSTRAINT participants_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE project_members ADD CONSTRAINT project_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE project_invitations ADD CONSTRAINT project_invitations_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE project_invitations ADD CONSTRAINT project_invitations_invited_by_fkey 
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE task_assignees ADD CONSTRAINT task_assignees_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE task_comments ADD CONSTRAINT task_comments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tasks ADD CONSTRAINT tasks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE time_entries ADD CONSTRAINT time_entries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_devices ADD CONSTRAINT user_devices_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE watchers ADD CONSTRAINT watchers_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE workspaces ADD CONSTRAINT workspaces_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

-- Recreate indexes
CREATE INDEX idx_activity_user ON activity_logs(user_id, created_at);
CREATE INDEX idx_integration_user_provider ON integration_tokens(user_id, provider);
CREATE INDEX idx_notifications_user_sched ON notifications(user_id, status, scheduled_at);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_invitations_user ON project_invitations(user_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_time_entries_user_start ON time_entries(user_id, start_at);
CREATE INDEX idx_user_devices_user_active ON user_devices(user_id, is_active);

-- Recreate unique constraints
ALTER TABLE memberships ADD CONSTRAINT memberships_user_id_workspace_id_key 
  UNIQUE (user_id, workspace_id);

ALTER TABLE project_members ADD CONSTRAINT project_members_project_id_user_id_key 
  UNIQUE (project_id, user_id);

ALTER TABLE project_invitations ADD CONSTRAINT project_invitations_project_id_user_id_key 
  UNIQUE (project_id, user_id);

ALTER TABLE task_assignees ADD PRIMARY KEY (task_id, user_id);
ALTER TABLE watchers ADD PRIMARY KEY (task_id, user_id);

ALTER TABLE integration_tokens ADD CONSTRAINT user_id_provider 
  UNIQUE (user_id, provider);
```

---

### Phase 3: Prisma Schema Update

Xem file `schema.prisma.new` trong cùng thư mục này.

---

### Phase 4: Code Updates

Xem file `CODE_CHANGES.md` trong cùng thư mục này.

---

## 🚀 Execution Plan

### Timeline (Production)
1. **Announcement:** 1 tuần trước - Thông báo maintenance window
2. **Staging Test:** 3 ngày trước - Test full migration trên staging
3. **Backup:** 1 ngày trước - Full database backup
4. **Migration Day:**
   - 00:00 - Bật maintenance mode
   - 00:05 - Run Phase 2 scripts (30-120 phút)
   - 01:30 - Deploy code updates (Phase 4)
   - 02:00 - Testing & verification
   - 02:30 - Tắt maintenance mode
   - 03:00 - Monitor

### Rollback Plan
```sql
-- Restore from backup
psql "$NEON_DATABASE_URL" < backup_before_migration.sql
```

---

## ✅ Verification Checklist

Sau migration, test:
- [ ] User registration (email/password)
- [ ] User login (email/password)  
- [ ] Google Sign-In
- [ ] Get user profile (`GET /users/me`)
- [ ] Create project
- [ ] Invite member to project
- [ ] Create task
- [ ] Assign task
- [ ] Add comment
- [ ] Activity logs
- [ ] Notifications
- [ ] All FK relationships intact
- [ ] No NULL user_id trong bất kỳ table nào

---

## 📊 Expected Impact

**Database:**
- Users table: -1 column (`firebase_uid`)
- All FK columns: UUID → TEXT (slightly larger)
- Total size change: ~+5-10% (TEXT > UUID)

**Performance:**
- Auth: **+50% faster** (no DB lookup trong guard)
- Queries: ~same (indexes rebuilt)

**Code:**
- Backend: ~20 files modified
- Frontend: ~15 files modified
- Total LOC removed: ~200 lines

---

## 🎯 Success Criteria

1. ✅ All existing users migrated successfully
2. ✅ All FK relationships intact
3. ✅ Zero data loss
4. ✅ Application works normally
5. ✅ No NULL foreign keys
6. ✅ Auth faster than before
