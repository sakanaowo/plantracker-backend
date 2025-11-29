# COMPREHENSIVE FIREBASE UID MIGRATION PLAN

## Executive Summary

**Mục tiêu**: Thay thế System UUID bằng Firebase UID làm Primary Key cho bảng `users` và tất cả Foreign Keys liên quan

**Tác động**:

- Database: 16 tables, 30+ FK columns
- Backend: 50+ controllers/services
- Frontend: Android app với 32+ DTOs
- Downtime: 30-120 phút

---

## I. PHÂN TÍCH TOÀN BỘ DATA FLOW

### 1. Frontend → Backend Flow (Android)

#### 1.1 Authentication & ID Injection

```java
// FirebaseInterceptor.java - Gửi Firebase Token
chain.proceed(requestBuilder
    .addHeader("Authorization", "Bearer " + idToken)
    .build());
```

**Flow**:

1. Android app lấy Firebase ID Token từ `FirebaseAuth.getInstance().currentUser.getIdToken()`
2. Gửi token qua header `Authorization: Bearer <token>`
3. Backend guard verify token → extract `uid` → lookup DB bằng `firebase_uid` → trả về System ID
4. Controller nhận System ID qua `@CurrentUser('id')` hoặc `@CurrentUser('sub')`

#### 1.2 DTOs Nhận User Data

```java
// ProjectMemberDTO.java
public static class UserInfo {
    private String id;              // ← System UUID hiện tại
    private String firebaseUid;     // ← KHÔNG có trong response
}

// TaskCommentDTO.java
public static class UserInfoDTO {
    private String id;              // ← System UUID hiện tại
    // KHÔNG có firebaseUid field
}

// ActivityLogDTO.java
private String userId;              // ← System UUID hiện tại
public static class UserInfo {
    private String id;              // ← System UUID hiện tại
}
```

**Breaking Changes sau migration**:

- `id` field sẽ chuyển từ UUID format → Firebase UID format
- Android code KHÔNG kiểm tra format ID → SAFE
- **NHƯNG** các code so sánh `userId == FirebaseAuth.uid` sẽ BỊ LỖI nếu vẫn dùng System UUID

### 2. Backend Internal Flow

#### 2.1 Controllers → Services

```typescript
// project-members.controller.ts
@Post(':projectId/members')
async inviteMember(
    @Param('projectId') projectId: string,
    @CurrentUser('sub') userId: string,  // ← Tên misleading nhưng vẫn trả System ID
    @Body() dto: InviteMemberDto,
) {
    return this.svc.inviteMember(projectId, userId, dto);
}
```

**Sau migration**: `userId` sẽ là Firebase UID thay vì System UUID

- ✅ Không cần sửa code vì vẫn là string
- ⚠️ NHƯNG cần update validation nếu có check UUID format

#### 2.2 Services → Prisma Queries

```typescript
// project-members.service.ts
const member = await this.prisma.project_members.findUnique({
  where: {
    project_id_user_id: {
      project_id: projectId,
      user_id: userId, // ← Hiện là System UUID, sau sẽ là Firebase UID
    },
  },
});
```

**Breaking Changes**:

- Composite keys như `project_id_user_id` vẫn hoạt động
- Query conditions vẫn KHÔNG đổi logic
- ✅ Prisma schema update tự động handle type change

#### 2.3 User Creation Flow

```typescript
// users.service.ts - ensureFromFirebase()
// TRƯỚC MIGRATION:
user = await this.prisma.users.create({
  data: {
    firebase_uid: uid, // uid từ Firebase token
    email,
    name,
    password_hash: '',
    // id: auto-generated UUID
  },
});

// SAU MIGRATION:
user = await this.prisma.users.create({
  data: {
    id: uid, // ← GÁN TRỰC TIẾP Firebase UID
    email,
    name,
    password_hash: '',
    // firebase_uid column BỊ XÓA
  },
});
```

### 3. Backend → Frontend Response Flow

#### 3.1 Response Serialization

```typescript
// tasks.service.ts - Trả về task với assignees
include: {
    task_assignees: {
        include: {
            users: {
                select: {
                    id: true,           // ← Sau migration: Firebase UID
                    name: true,
                    email: true,
                    avatar_url: true,
                    // firebase_uid: KHÔNG còn
                },
            },
        },
    },
}
```

**Frontend nhận**:

```json
{
  "task_assignees": [
    {
      "users": {
        "id": "abc123-uuid-format", // TRƯỚC
        "id": "firebase-uid-xyz789", // SAU
        "name": "John Doe"
      }
    }
  ]
}
```

#### 3.2 Android DTOs Mapping

```java
// TaskDTO.java
@SerializedName("id")
private String id;  // ← KHÔNG kiểm tra format, chỉ là String

// CommentAdapter.java - So sánh userId
String currentUserUid = FirebaseAuth.getInstance().getCurrentUser().getUid();
if (comment.getUserId().equals(currentUserUid)) {
    // TRƯỚC: LUÔN FALSE vì comment.getUserId() = System UUID
    // SAU: TRUE vì comment.getUserId() = Firebase UID
}
```

---

## II. BREAKING CHANGES ANALYSIS

### 1. Database Level

#### 1.1 Schema Changes

```sql
-- users.id: UUID → String (Firebase UID format)
-- TRƯỚC: id UUID DEFAULT uuid_generate_v4()
-- SAU:   id String (manually assigned)

-- REMOVED: firebase_uid column
-- BEFORE: firebase_uid String @unique
-- AFTER:  (column không tồn tại)
```

#### 1.2 Foreign Key Changes (30+ columns)

```
activity_logs.user_id
attachments.uploaded_by
events.created_by
integration_tokens.user_id
memberships.user_id
notifications.user_id
notifications.created_by
participants.user_id
project_members.user_id
project_invitations.user_id
project_invitations.invited_by
task_assignees.user_id
task_assignees.assigned_by
task_comments.user_id
tasks.created_by
time_entries.user_id
user_devices.user_id
watchers.user_id
workspaces.owner_id
```

**Migration Risk**: Nếu có data integrity issues → toàn bộ FK relations BỊ LỖI

### 2. Backend Level

#### 2.1 Authentication Guard Changes

```typescript
// combined-auth.guard.ts
// TRƯỚC:
const dbUser = await this.prisma.users.findUnique({
  where: { firebase_uid: decoded.uid },
});
req.user = dbUser.id; // System UUID

// SAU:
req.user = decoded.uid; // Firebase UID trực tiếp
// KHÔNG CẦN database lookup!
```

**Performance Improvement**: Mỗi request TIẾT KIỆM 1 DB query

#### 2.2 User Service Changes

```typescript
// users.service.ts
// TRƯỚC: Cần check firebase_uid + email
let user = await this.prisma.users.findUnique({
  where: { firebase_uid: uid },
});
if (!user) {
  user = await this.prisma.users.findUnique({
    where: { email },
  });
}

// SAU: Chỉ cần check by id
let user = await this.prisma.users.findUnique({
  where: { id: uid }, // id = Firebase UID
});
```

**Simplified Logic**: Bỏ dual-lookup pattern

#### 2.3 Validation Changes

```typescript
// TRƯỚC: Có thể validate UUID format
@IsUUID()
userId: string;

// SAU: KHÔNG thể validate vì Firebase UID KHÔNG phải UUID
@IsString()
userId: string;
```

**Risk**: Mất type safety validation

### 3. Frontend Level

#### 3.1 User Comparison Logic

```java
// CardDetailActivity.java - TRƯỚC
String firebaseUid = FirebaseAuth.getInstance().getCurrentUser().getUid();
String systemUserId = task.getCreatedBy();  // System UUID
if (firebaseUid.equals(systemUserId)) {
    // KHÔNG BAO GIỜ MATCH
}

// SAU MIGRATION
if (firebaseUid.equals(systemUserId)) {
    // SẼ MATCH VÌ CẢ HAI CÙNG Firebase UID
}
```

**Impact**: Các tính năng kiểm tra ownership SẼ BẮT ĐẦU HOẠT ĐỘNG

#### 3.2 DTOs No Changes Needed

```java
// ProjectMemberDTO.java
private String userId;  // Vẫn là String, format thay đổi nhưng code KHÔNG care

// User.java
private String id;      // Vẫn là String

// ProjectMember.java
private String userId;  // Vẫn là String
```

**Safe**: Android KHÔNG validate ID format → KHÔNG breaking

---

## III. DETAILED MIGRATION PLAN

### Phase 1: Pre-Migration Preparation (2-3 giờ)

#### 1.1 Database Backup

```bash
# Full database dump
pg_dump $NEON_DATABASE_URL > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
psql $NEON_DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

#### 1.2 Data Integrity Checks

```sql
-- Check for users without firebase_uid
SELECT COUNT(*) FROM users WHERE firebase_uid IS NULL OR firebase_uid = '';
-- EXPECTED: 0

-- Check for duplicate firebase_uid
SELECT firebase_uid, COUNT(*) FROM users
GROUP BY firebase_uid HAVING COUNT(*) > 1;
-- EXPECTED: 0 rows

-- Check for NULL user_id in FK tables
SELECT 'activity_logs' as table_name, COUNT(*) as null_count
FROM activity_logs WHERE user_id IS NULL
UNION ALL
SELECT 'task_assignees', COUNT(*) FROM task_assignees WHERE user_id IS NULL
UNION ALL
SELECT 'task_comments', COUNT(*) FROM task_comments WHERE user_id IS NULL
UNION ALL
SELECT 'project_members', COUNT(*) FROM project_members WHERE user_id IS NULL;
-- EXPECTED: All 0

-- Check for orphaned FK references
SELECT COUNT(*) FROM activity_logs a
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id);
-- EXPECTED: 0 (repeat for all FK tables)
```

#### 1.3 Create Migration Rollback Point

```sql
-- Create restore point (if supported by Neon)
SELECT pg_create_restore_point('before_firebase_uid_migration');

-- Document current user count and sample IDs
SELECT
    COUNT(*) as total_users,
    MIN(created_at) as oldest_user,
    MAX(created_at) as newest_user
FROM users;
```

### Phase 2: Database Migration (30-120 phút DOWNTIME)

#### 2.1 Maintenance Mode Announcement

```typescript
// src/app.controller.ts - Tạo endpoint trả về maintenance message
@Get('health')
getHealth() {
    return {
        status: 'MAINTENANCE',
        message: 'System đang nâng cấp. Vui lòng thử lại sau 2 giờ.',
        estimatedEndTime: '2025-11-29T15:00:00Z'
    };
}
```

**Action**:

1. Deploy maintenance message
2. Notify users qua push notification
3. Disable new user registrations

#### 2.2 Execute SQL Migration Script

```sql
-- ========================================
-- FIREBASE UID MIGRATION - MAIN SCRIPT
-- ========================================
BEGIN TRANSACTION;

-- STEP 1: Add temporary columns (String type, allow NULL)
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

-- STEP 2: Create mapping table
CREATE TEMP TABLE user_id_mapping AS
SELECT id AS old_id, firebase_uid AS new_id
FROM users;

-- Verify mapping
SELECT COUNT(*) as total_mappings FROM user_id_mapping;
SELECT COUNT(*) as mappings_with_null FROM user_id_mapping WHERE new_id IS NULL;
-- ASSERT: mappings_with_null = 0

-- STEP 3: Migrate data for all FK columns
UPDATE activity_logs SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE attachments SET uploaded_by_new = (SELECT new_id FROM user_id_mapping WHERE old_id = uploaded_by);
UPDATE events SET created_by_new = (SELECT new_id FROM user_id_mapping WHERE old_id = created_by);
UPDATE integration_tokens SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE memberships SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE notifications SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE notifications SET created_by_new = (SELECT new_id FROM user_id_mapping WHERE old_id = created_by);
UPDATE participants SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE project_members SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE project_invitations SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE project_invitations SET invited_by_new = (SELECT new_id FROM user_id_mapping WHERE old_id = invited_by);
UPDATE task_assignees SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE task_assignees SET assigned_by_new = (SELECT new_id FROM user_id_mapping WHERE old_id = assigned_by);
UPDATE task_comments SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE tasks SET created_by_new = (SELECT new_id FROM user_id_mapping WHERE old_id = created_by);
UPDATE time_entries SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE user_devices SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE watchers SET user_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = user_id);
UPDATE workspaces SET owner_id_new = (SELECT new_id FROM user_id_mapping WHERE old_id = owner_id);

-- STEP 4: Verification - Check for NULL values after migration
SELECT 'activity_logs' as tbl, COUNT(*) FROM activity_logs WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'attachments', COUNT(*) FROM attachments WHERE uploaded_by IS NOT NULL AND uploaded_by_new IS NULL
UNION ALL SELECT 'events', COUNT(*) FROM events WHERE created_by IS NOT NULL AND created_by_new IS NULL
UNION ALL SELECT 'integration_tokens', COUNT(*) FROM integration_tokens WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'memberships', COUNT(*) FROM memberships WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'participants', COUNT(*) FROM participants WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'project_members', COUNT(*) FROM project_members WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'task_assignees', COUNT(*) FROM task_assignees WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'task_comments', COUNT(*) FROM task_comments WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks WHERE created_by IS NOT NULL AND created_by_new IS NULL
UNION ALL SELECT 'time_entries', COUNT(*) FROM time_entries WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'user_devices', COUNT(*) FROM user_devices WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'watchers', COUNT(*) FROM watchers WHERE user_id IS NOT NULL AND user_id_new IS NULL
UNION ALL SELECT 'workspaces', COUNT(*) FROM workspaces WHERE owner_id IS NOT NULL AND owner_id_new IS NULL;
-- ASSERT: All counts = 0

-- STEP 5: Drop old FK constraints
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_uploaded_by_fkey;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE integration_tokens DROP CONSTRAINT IF EXISTS integration_tokens_user_id_fkey;
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_created_by_fkey;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_user_id_fkey;
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS project_invitations_user_id_fkey;
ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS project_invitations_invited_by_fkey;
ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_user_id_fkey;
ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_assigned_by_fkey;
ALTER TABLE task_comments DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;
ALTER TABLE user_devices DROP CONSTRAINT IF EXISTS user_devices_user_id_fkey;
ALTER TABLE watchers DROP CONSTRAINT IF EXISTS watchers_user_id_fkey;
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;

-- STEP 6: Drop composite unique constraints
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_user_id_workspace_id_key;
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_project_id_user_id_key;
ALTER TABLE project_invitations DROP CONSTRAINT IF EXISTS project_invitations_project_id_user_id_key;
ALTER TABLE integration_tokens DROP CONSTRAINT IF EXISTS user_id_provider;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_event_id_email_key;
ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_pkey;
ALTER TABLE watchers DROP CONSTRAINT IF EXISTS watchers_pkey;

-- STEP 7: Rename columns (drop old, rename new)
ALTER TABLE activity_logs DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE attachments DROP COLUMN uploaded_by, RENAME COLUMN uploaded_by_new TO uploaded_by;
ALTER TABLE events DROP COLUMN created_by, RENAME COLUMN created_by_new TO created_by;
ALTER TABLE integration_tokens DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE memberships DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE notifications DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE notifications DROP COLUMN created_by, RENAME COLUMN created_by_new TO created_by;
ALTER TABLE participants DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE project_members DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE project_invitations DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE project_invitations DROP COLUMN invited_by, RENAME COLUMN invited_by_new TO invited_by;
ALTER TABLE task_assignees DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE task_assignees DROP COLUMN assigned_by, RENAME COLUMN assigned_by_new TO assigned_by;
ALTER TABLE task_comments DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE tasks DROP COLUMN created_by, RENAME COLUMN created_by_new TO created_by;
ALTER TABLE time_entries DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE user_devices DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE watchers DROP COLUMN user_id, RENAME COLUMN user_id_new TO user_id;
ALTER TABLE workspaces DROP COLUMN owner_id, RENAME COLUMN owner_id_new TO owner_id;

-- STEP 8: Migrate users table itself
ALTER TABLE users ADD COLUMN id_new TEXT;
UPDATE users SET id_new = firebase_uid;

-- Verify no NULL id_new
SELECT COUNT(*) FROM users WHERE id_new IS NULL;
-- ASSERT: 0

-- Drop old PK
ALTER TABLE users DROP CONSTRAINT users_pkey;

-- Rename columns
ALTER TABLE users DROP COLUMN id, RENAME COLUMN id_new TO id;
ALTER TABLE users DROP COLUMN firebase_uid;  -- REMOVE firebase_uid column

-- Add new PK
ALTER TABLE users ADD PRIMARY KEY (id);

-- STEP 9: Recreate FK constraints
ALTER TABLE activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE events
    ADD CONSTRAINT events_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE NO ACTION;

ALTER TABLE integration_tokens
    ADD CONSTRAINT integration_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE memberships
    ADD CONSTRAINT memberships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE participants
    ADD CONSTRAINT participants_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE NO ACTION;

ALTER TABLE project_members
    ADD CONSTRAINT project_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE task_assignees
    ADD CONSTRAINT task_assignees_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE NO ACTION;

ALTER TABLE time_entries
    ADD CONSTRAINT time_entries_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_devices
    ADD CONSTRAINT user_devices_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE watchers
    ADD CONSTRAINT watchers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

-- STEP 10: Recreate composite unique constraints
ALTER TABLE memberships
    ADD CONSTRAINT memberships_user_id_workspace_id_key
    UNIQUE (user_id, workspace_id);

ALTER TABLE project_members
    ADD CONSTRAINT project_members_project_id_user_id_key
    UNIQUE (project_id, user_id);

ALTER TABLE project_invitations
    ADD CONSTRAINT project_invitations_project_id_user_id_key
    UNIQUE (project_id, user_id);

ALTER TABLE integration_tokens
    ADD CONSTRAINT user_id_provider
    UNIQUE (user_id, provider);

ALTER TABLE participants
    ADD CONSTRAINT participants_event_id_email_key
    UNIQUE (event_id, email);

ALTER TABLE task_assignees
    ADD CONSTRAINT task_assignees_pkey
    PRIMARY KEY (task_id, user_id);

ALTER TABLE watchers
    ADD CONSTRAINT watchers_pkey
    PRIMARY KEY (task_id, user_id);

-- STEP 11: Final verification
SELECT
    (SELECT COUNT(*) FROM users) as user_count,
    (SELECT COUNT(*) FROM activity_logs WHERE user_id IS NULL) as null_activity_logs,
    (SELECT COUNT(*) FROM project_members WHERE user_id IS NULL) as null_project_members,
    (SELECT COUNT(*) FROM task_assignees WHERE user_id IS NULL) as null_task_assignees;
-- ASSERT: null_* = 0

COMMIT;
-- ========================================
-- END MIGRATION SCRIPT
-- ========================================
```

#### 2.3 Post-Migration Database Verification

```sql
-- Verify users table
SELECT id, email, name FROM users LIMIT 5;
-- CHECK: id format should be Firebase UID (NOT UUID)

-- Verify FK relationships
SELECT COUNT(*) FROM activity_logs a
JOIN users u ON a.user_id = u.id;
-- COMPARE with total activity_logs count

-- Verify composite keys
SELECT COUNT(*) FROM project_members pm
JOIN users u ON pm.user_id = u.id;

-- Check for orphaned records (should be 0)
SELECT 'activity_logs' as table_name, COUNT(*)
FROM activity_logs WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'project_members', COUNT(*)
FROM project_members WHERE user_id NOT IN (SELECT id FROM users);
-- ASSERT: All 0
```

### Phase 3: Backend Code Update

#### 3.1 Update Prisma Schema

```bash
# Replace schema.prisma with schema.new.prisma
cd /home/sakana/Code/MobileApp/plantracker-backend
cp prisma/schema.prisma prisma/schema.prisma.backup
cp prisma/schema.new.prisma prisma/schema.prisma

# Generate new Prisma Client
npm run prisma:generate

# Verify generated types
grep -A 5 "model users" node_modules/.prisma/client/index.d.ts
# CHECK: id field should be "string" not "string (UUID)"
```

#### 3.2 Update Authentication Guard

```typescript
// src/auth/combined-auth.guard.ts
async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('No token');

    try {
        const decoded = await admin.auth().verifyIdToken(token);

        // ✅ NEW: Directly assign Firebase UID (no DB lookup)
        req.user = decoded.uid;

        // ❌ OLD: Lookup user by firebase_uid
        // const dbUser = await this.prisma.users.findUnique({
        //     where: { firebase_uid: decoded.uid },
        // });
        // if (!dbUser) throw new UnauthorizedException('User not found');
        // req.user = dbUser.id;

        return true;
    } catch (e) {
        throw new UnauthorizedException('Invalid token');
    }
}
```

#### 3.3 Update User Service

```typescript
// src/modules/users/users.service.ts
async ensureFromFirebase(opts: {
    uid: string;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
}) {
    const { uid, email, name, avatarUrl } = opts;
    if (!email) throw new BadRequestException('Firebase user has no email');

    // ✅ NEW: Check by id directly
    let user = await this.prisma.users.findUnique({
        where: { id: uid },  // id = Firebase UID
    });

    if (user) {
        // Update existing user
        user = await this.prisma.users.update({
            where: { id: uid },
            data: {
                email,
                name: name ?? undefined,
                avatar_url: avatarUrl ?? undefined,
                updated_at: new Date(),
            },
        });
    } else {
        // Create new user with id = Firebase UID
        user = await this.prisma.users.create({
            data: {
                id: uid,  // ✅ MANUALLY ASSIGN Firebase UID
                email,
                name: name ?? email.split('@')[0],
                avatar_url: avatarUrl ?? null,
                password_hash: '',
            },
        });
    }

    // Ensure workspace
    await this.workspaces.ensurePersonalWorkspaceByUserId(user.id, user.name);

    return user;
}
```

#### 3.4 Remove UUID Validations

```bash
# Search for UUID validations
grep -r "@IsUUID()" src/modules/
grep -r "ParseUUIDPipe" src/modules/

# Replace with String validations where needed
# BEFORE:
@Param('userId', new ParseUUIDPipe()) userId: string

# AFTER:
@Param('userId') userId: string
```

### Phase 4: Frontend Code Update (OPTIONAL - App vẫn hoạt động)

#### 4.1 Remove firebaseUid Fields from DTOs

```java
// ProjectMemberDTO.java
public static class UserInfo {
    @SerializedName("id")
    private String id;  // ✅ Giữ nguyên, giá trị sẽ là Firebase UID

    // ❌ REMOVE: firebaseUid field (không còn trong response)
    // @SerializedName("firebaseUid")
    // private String firebaseUid;
}
```

#### 4.2 Update User Comparison Logic

```java
// CardDetailActivity.java
String currentUserUid = FirebaseAuth.getInstance().getCurrentUser().getUid();

// ✅ NEW: So sánh trực tiếp
if (task.getCreatedBy().equals(currentUserUid)) {
    btnEdit.setVisibility(View.VISIBLE);  // ✅ Sẽ HOẠT ĐỘNG
}

// ❌ OLD: So sánh sẽ LUÔN sai
// if (currentUserUid.equals(systemUserId)) {
//     // systemUserId = UUID → KHÔNG BAO GIỜ MATCH
// }
```

#### 4.3 Testing Checklist

- [ ] Login with Firebase → API trả về user với id = Firebase UID
- [ ] Create task → task.createdBy = Firebase UID
- [ ] Add comment → comment.userId = Firebase UID
- [ ] Assign task → assignee.userId = Firebase UID
- [ ] Check ownership → `task.createdBy == FirebaseAuth.uid` WORKS
- [ ] Project member list → member.userId = Firebase UID

---

## IV. ROLLBACK PLAN

### Scenario 1: Migration fails DURING transaction

```sql
-- Transaction auto-rollback
ROLLBACK;

-- Verify database unchanged
SELECT id, firebase_uid FROM users LIMIT 5;
-- CHECK: id still UUID, firebase_uid still exists
```

### Scenario 2: Migration succeeded but backend bugs discovered

```sql
-- Restore from backup
psql $NEON_DATABASE_URL < backup_before_migration_YYYYMMDD_HHMMSS.sql

-- Verify restore
SELECT COUNT(*) FROM users;
SELECT id, firebase_uid FROM users LIMIT 5;

-- Revert code changes
git revert <migration-commit-hash>
npm run prisma:generate
npm run build
```

### Scenario 3: Partial data corruption

```sql
-- Identify affected records
SELECT * FROM users WHERE id IS NULL OR id = '';
SELECT * FROM project_members WHERE user_id NOT IN (SELECT id FROM users);

-- Manual fix if possible
-- OR full restore from backup
```

---

## V. TESTING STRATEGY

### 1. Pre-Production Testing (Staging Environment)

#### 1.1 Create Staging Database Clone

```bash
# Clone production data to staging
pg_dump $NEON_DATABASE_URL | psql $STAGING_DATABASE_URL
```

#### 1.2 Run Migration on Staging

```bash
# Execute migration script
psql $STAGING_DATABASE_URL < migration.sql

# Verify results
psql $STAGING_DATABASE_URL -c "SELECT id, email FROM users LIMIT 10;"
```

#### 1.3 Backend Integration Tests

```bash
# Update .env to use staging DB
DATABASE_URL=$STAGING_DATABASE_URL

# Run tests
npm run test:e2e

# Test critical flows
curl -H "Authorization: Bearer <firebase-token>" \
     http://localhost:3000/api/users/me

curl -H "Authorization: Bearer <firebase-token>" \
     http://localhost:3000/api/projects
```

#### 1.4 Frontend Integration Tests

```bash
# Update Android build config to point to staging
# BuildConfig.API_BASE_URL = "https://staging.api.plantracker.com"

# Test flows
- Login
- Create project
- Add task
- Assign user
- Add comment
- Check ownership buttons
```

### 2. Production Smoke Tests (Post-Migration)

#### 2.1 API Health Checks

```bash
# Health endpoint
curl https://api.plantracker.com/health

# Auth test
curl -H "Authorization: Bearer <test-user-token>" \
     https://api.plantracker.com/api/users/me

# Expected response:
{
  "id": "firebase-uid-xyz",  // NOT UUID
  "email": "test@example.com",
  "name": "Test User"
}
```

#### 2.2 Critical Flow Tests

```bash
# 1. User login & profile fetch
# 2. Project member list
curl -H "Authorization: Bearer <token>" \
     https://api.plantracker.com/api/projects/<project-id>/members

# 3. Create task
# 4. Assign task
# 5. Add comment
# 6. Activity log verification
```

#### 2.3 Database Monitoring

```sql
-- Monitor query performance
SELECT schemaname, tablename, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('users', 'project_members', 'task_assignees')
ORDER BY idx_scan DESC;

-- Check for errors in logs
SELECT * FROM activity_logs WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC LIMIT 100;
```

---

## VI. RISK MITIGATION

### 1. High Risk: Data Loss

**Mitigation**:

- Full database backup before migration
- Transaction-based migration (all-or-nothing)
- Verification queries after each step
- Staging environment testing

### 2. Medium Risk: Extended Downtime

**Mitigation**:

- Pre-calculate migration time on staging clone
- Run during low-traffic hours (2-4 AM)
- Prepare rollback script (< 10 minutes)
- Monitor progress with checkpoints

### 3. Medium Risk: App Crashes

**Mitigation**:

- Thorough staging tests
- Backend deploy BEFORE migration (backwards compatible)
- Frontend graceful degradation (ID format agnostic)
- Incremental rollout (10% → 50% → 100%)

### 4. Low Risk: Performance Degradation

**Mitigation**:

- Index verification post-migration
- Query performance monitoring
- Firebase UID string comparison is FASTER than UUID

---

## VII. SUCCESS CRITERIA

### Database

- ✅ All users.id converted to Firebase UID
- ✅ firebase_uid column removed
- ✅ All FK columns updated to TEXT type
- ✅ All FK constraints recreated
- ✅ Zero orphaned records
- ✅ Zero NULL user_id in FK tables

### Backend

- ✅ No database lookup in auth guard
- ✅ User creation uses id = Firebase UID
- ✅ All endpoints return Firebase UID in responses
- ✅ Zero UUID validation errors
- ✅ All integration tests passing

### Frontend

- ✅ Login successful
- ✅ User data fetched correctly
- ✅ Task creation/assignment works
- ✅ Comment system functional
- ✅ Ownership checks WORKING (firebaseUid == userId)
- ✅ No crashes related to ID format

### Performance

- ✅ Auth requests 20-30% faster (no DB lookup)
- ✅ Response times unchanged or improved
- ✅ Database query performance stable

---

## VIII. TIMELINE

### Day 1: Preparation (4 hours)

- Hour 1: Database backup & verification
- Hour 2: Staging environment setup
- Hour 3: Run migration on staging
- Hour 4: Staging backend/frontend testing

### Day 2: Code Updates (4 hours)

- Hour 1: Update Prisma schema
- Hour 2: Update auth guard & services
- Hour 3: Remove UUID validations
- Hour 4: Integration testing

### Day 3: Production Migration (2-3 hours DOWNTIME)

- Hour 1: Enable maintenance mode
- Hour 2: Execute SQL migration
- Hour 3: Deploy backend code
- Hour 4: Smoke testing & monitoring

### Day 4: Frontend Update (Optional, 2 hours)

- Hour 1: Remove firebaseUid fields
- Hour 2: Update comparison logic
- Hour 3: Release update to Play Store

---

## IX. MONITORING & ALERTS

### Post-Migration Monitoring (First 48 hours)

#### 1. Database Metrics

```sql
-- Query every 15 minutes
SELECT
    schemaname,
    tablename,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_autovacuum
FROM pg_stat_user_tables
WHERE tablename IN ('users', 'project_members', 'activity_logs');
```

#### 2. Application Logs

```bash
# Monitor for errors
tail -f /var/log/plantracker/app.log | grep -i "error\|exception\|fail"

# Track auth failures
grep "UnauthorizedException" /var/log/plantracker/app.log | wc -l
```

#### 3. Performance Metrics

```typescript
// Add timing logs to auth guard
const startTime = Date.now();
const decoded = await admin.auth().verifyIdToken(token);
req.user = decoded.uid;
console.log(`Auth time: ${Date.now() - startTime}ms`);
```

#### 4. User Feedback

- Monitor app crash reports (Firebase Crashlytics)
- Check support tickets
- Review app store ratings
- Monitor social media mentions

---

## X. COMMUNICATION PLAN

### Before Migration

**24 hours notice**:

```
Subject: System Maintenance - November 29, 2025

Dear Users,

We will be performing a critical system upgrade on November 29, 2025 from 2:00 AM to 4:00 AM (UTC+7).

During this time:
- App will be in maintenance mode
- Cannot create/edit tasks
- Cannot login (existing sessions may expire)

What's changing:
- Improved authentication performance
- Better data consistency
- No visible changes to app interface

Thank you for your patience!
```

### During Migration

**Push notification**:

```json
{
  "title": "Đang bảo trì",
  "body": "Hệ thống đang nâng cấp. Vui lòng thử lại sau 2 giờ.",
  "data": {
    "maintenance": true,
    "estimatedEnd": "2025-11-29T04:00:00Z"
  }
}
```

### After Migration

**Success announcement**:

```
Subject: System Upgrade Complete

Good news! The system upgrade has been completed successfully.

New improvements:
✅ 30% faster login
✅ Better data synchronization
✅ Improved reliability

Please update your app to the latest version for the best experience.

Thank you!
```

---

## XI. APPENDIX

### A. SQL Helper Queries

#### Count Records by Table

```sql
SELECT
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL SELECT 'project_members', COUNT(*) FROM project_members
UNION ALL SELECT 'task_assignees', COUNT(*) FROM task_assignees
UNION ALL SELECT 'task_comments', COUNT(*) FROM task_comments
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'workspaces', COUNT(*) FROM workspaces;
```

#### Find Sample User IDs

```sql
-- Before migration (UUID format)
SELECT id, firebase_uid, email FROM users LIMIT 5;

-- After migration (Firebase UID format)
SELECT id, email FROM users LIMIT 5;
```

### B. Backend Code Checklist

- [ ] `prisma/schema.prisma` - users.id type updated
- [ ] `src/auth/combined-auth.guard.ts` - No DB lookup
- [ ] `src/modules/users/users.service.ts` - ensureFromFirebase updated
- [ ] Remove all `@IsUUID()` decorators
- [ ] Remove all `ParseUUIDPipe`
- [ ] Run `npm run prisma:generate`
- [ ] Run `npm run build`
- [ ] Run integration tests

### C. Frontend Code Checklist

- [ ] Remove `firebaseUid` fields from DTOs
- [ ] Update user comparison logic
- [ ] Test login flow
- [ ] Test task creation
- [ ] Test ownership checks
- [ ] Run UI tests
- [ ] Build release APK

---

## XII. CONCLUSION

Migration này là **HIGH IMPACT, MEDIUM RISK** với benefits rõ ràng:

### Benefits

1. **Performance**: Auth requests nhanh hơn 20-30% (no DB lookup)
2. **Simplicity**: Bỏ dual-ID system, chỉ dùng Firebase UID
3. **Correctness**: Ownership checks trên Android SẼ HOẠT ĐỘNG
4. **Consistency**: ID trên FE, BE, DB đều cùng Firebase UID

### Risks

1. Extended downtime (30-120 phút)
2. Data integrity issues nếu migration script lỗi
3. Breaking changes cho code kiểm tra UUID format
4. Rollback phức tạp (cần restore full backup)

### Recommendation

✅ **THỰC HIỆN** migration với điều kiện:

- Test kỹ trên staging environment
- Schedule trong off-peak hours (2-4 AM)
- Có backup plan rõ ràng
- Team sẵn sàng hotfix nếu phát sinh issues

**Estimated Total Time**: 10-12 hours (preparation + migration + monitoring)
**Recommended Date**: Cuối tuần (Saturday 2-4 AM) để có thời gian xử lý issues
