# FIREBASE UID MIGRATION PLAN
## Chuyển đổi users.id từ UUID sang Firebase UID

**Ngày tạo:** 29/11/2025  
**Phạm vi:** Chỉ bảng `users` - Các bảng khác giữ nguyên UUID  
**Chiến lược:** Direct Migration - 8 users hiện tại  
**Downtime:** ~5-10 phút (migration data)

---

## I. TÓM TẮT VẤN ĐỀ

### 1. Vấn đề hiện tại

**Backend:**
```typescript
// User được tạo với 2 IDs
users.create({
  id: "uuid-auto-generated",     // System UUID
  firebase_uid: "KxYz1234...",   // Firebase UID
  email: "user@example.com"
})

// Authentication trả về System UUID
req.user = dbUser.id; // UUID, không phải Firebase UID
```

**Frontend (Android):**
```java
// TokenManager lưu 2 IDs khác nhau
tokenManager.getUserId();         // Firebase UID
tokenManager.getInternalUserId(); // System UUID (từ backend)

// Ownership check LUÔN LUÔN FAIL
String currentUserId = tokenManager.getUserId();  // Firebase UID
String commentUserId = comment.getUserId();        // System UUID
if (currentUserId.equals(commentUserId)) {
    // ❌ KHÔNG BAO GIỜ MATCH → Không hiện nút Edit/Delete
}
```

### 2. Hậu quả

| Tính năng | Vấn đề | Ảnh hưởng người dùng |
|-----------|--------|---------------------|
| **Comments** | Không hiện nút Edit/Delete | Không thể sửa/xóa comment của mình |
| **Tasks** | Không biết task do mình tạo | Không phân biệt được task của mình |
| **Activity Logs** | Không hiện "You" | Không biết action nào là của mình |
| **Assignees** | Không hiện đúng người assign | Nhầm lẫn ai assign cho ai |
| **Notifications** | Filter sai | Nhận thông báo của người khác |

---
## II. GIẢI PHÁP

### 1. Mục tiêu

✅ **TẤT CẢ Users:** `id = Firebase UID`, bỏ hoàn toàn `firebase_uid` field  
✅ **8 users hiện tại:** Migrate data trực tiếp từ UUID → Firebase UID  
✅ **Clean Schema:** Không cần fallback logic, không dual IDs  
✅ **Short Downtime:** ~5-10 phút để migrate data  

### 2. Chiến lược

**Direct Migration (Trực tiếp):**
- Migrate 8 users hiện tại: Chuyển `id` từ UUID → Firebase UID
- Update tất cả FK references (18 columns) để trỏ sang Firebase UID
- Bỏ hoàn toàn `firebase_uid` column
- Code đơn giản: Chỉ dùng `id`, không cần dual lookup

**Migration Steps:**
1. Backup database
2. Update all user FK columns → Firebase UID
3. Swap users.id (UUID → Firebase UID)
4. Drop firebase_uid column
5. Update code (bỏ fallback logic)es khác (tasks, projects, boards...)
- Không cần maintenance window

---

## III. THAY ĐỔI CHI TIẾT

#### 1. Bảng `users`

```prisma
// TRƯỚC
model users {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  firebase_uid String   @unique
  email        String   @unique
  // ...
}

// SAU
model users {
  id    String  @id  // ✅ Bỏ @default và @db.Uuid
  email String  @unique
  // ❌ BỎ HOÀN TOÀN firebase_uid column
}
```

**Migration SQL (Data Migration):**
```sql
BEGIN TRANSACTION;

-- 1. Tạo backup
CREATE TABLE users_backup AS SELECT * FROM users;

-- 2. Update all FK columns to point to firebase_uid
UPDATE activity_logs SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = activity_logs.user_id
) WHERE user_id IN (SELECT id FROM users);

UPDATE task_comments SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = task_comments.user_id
) WHERE user_id IN (SELECT id FROM users);

-- ... repeat for all 18 FK columns ...

-- 3. Drop old PK constraint
ALTER TABLE users DROP CONSTRAINT users_pkey;

-- 4. Update users.id = firebase_uid
UPDATE users SET id = firebase_uid;

-- 5. Add back PK constraint
ALTER TABLE users ADD PRIMARY KEY (id);

-- 6. Drop firebase_uid column
ALTER TABLE users DROP COLUMN firebase_uid;

COMMIT;
```
-- Không cần ALTER users.id vì Prisma String tương thích với cả UUID và Firebase UID
```

#### 2. User Foreign Keys (18 columns)

Bỏ `@db.Uuid` constraint để chấp nhận cả UUID và Firebase UID:

```prisma
// TRƯỚC
model task_comments {
  user_id String @db.Uuid
  users   users  @relation(fields: [user_id], references: [id])
}

// SAU
model task_comments {
  user_id String  // ✅ Bỏ @db.Uuid
  users   users   @relation(fields: [user_id], references: [id])
}
```

**Danh sách 18 columns cần sửa:**
1. `activity_logs.user_id`
2. `attachments.uploaded_by`
3. `events.created_by`
4. `integration_tokens.user_id`
5. `memberships.user_id`
6. `notifications.user_id`
7. `notifications.created_by`
**Logic mới (ĐƠN GIẢN HÓA):**
```typescript
async ensureFromFirebase(opts: { uid: string; email?: string; name?: string; avatarUrl?: string }) {
  const { uid, email, name, avatarUrl } = opts;
  
  // ĐƠN GIẢN: Chỉ tìm theo id (Firebase UID)
  let user = await this.prisma.users.findUnique({ where: { id: uid } });
  
  if (user) {
    // User đã tồn tại → Update thông tin
    return await this.prisma.users.update({
      where: { id: uid },
      data: { name, avatar_url: avatarUrl, updated_at: new Date() }
    });
  }
  
  // Tìm theo email (trường hợp migrate từ hệ thống cũ)
  const existingByEmail = await this.prisma.users.findUnique({ where: { email } });
  if (existingByEmail) {
    // User tồn tại nhưng id khác (không nên xảy ra sau migration)
    throw new BadRequestException('User with this email already exists with different ID');
  }
  
  // Tạo user MỚI với id = Firebase UID
  user = await this.prisma.users.create({
    data: {
      id: uid,              // ✅ Firebase UID làm primary key
      email,
      name: name ?? email.split('@')[0],
      avatar_url: avatarUrl,
      password_hash: ''
    }
  });
  
  await this.workspaces.ensurePersonalWorkspaceByUserId(user.id, user.name);
  return user;
}
```onst existingByEmail = await this.prisma.users.findUnique({ where: { email } });
  if (existingByEmail) {
    // Link Firebase UID vào user cũ
    return await this.prisma.users.update({
      where: { id: existingByEmail.id },
      data: { firebase_uid: uid }
    });
  }
  
  // BƯỚC 4: Tạo user MỚI với id = Firebase UID
  user = await this.prisma.users.create({
    data: {
      id: uid,              // ✅ Firebase UID làm primary key
      firebase_uid: null,   // ✅ Không cần field này cho user mới
      email,
      name: name ?? email.split('@')[0],
**Logic mới (ĐƠN GIẢN HÓA):**
```typescript
async canActivate(ctx: ExecutionContext): Promise<boolean> {
  // ... verify token ...
  const decoded = await admin.auth().verifyIdToken(token);
  
  // ĐƠN GIẢN: Chỉ tìm theo id (Firebase UID)
  let dbUser = await this.prisma.users.findUnique({
    where: { id: decoded.uid },
    select: { id: true }
  });
  
  // Auto-sync nếu chưa tồn tại
  if (!dbUser) {
    const firebaseUser = await admin.auth().getUser(decoded.uid);
    const synced = await this.usersService.ensureFromFirebase({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName,
      avatarUrl: firebaseUser.photoURL
    });
    dbUser = { id: synced.id };
  }
  
  req.user = dbUser.id; // ✅ Luôn luôn là Firebase UID
  return true;
}
```f (!dbUser) {
    const firebaseUser = await admin.auth().getUser(decoded.uid);
    const synced = await this.usersService.ensureFromFirebase({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName,
      avatarUrl: firebaseUser.photoURL
    });
    dbUser = { id: synced.id };
  }
  
  req.user = dbUser.id; // ✅ Có thể là Firebase UID (new) hoặc UUID (old)
  return true;
}
```

#### 3. Validator Changes - Bỏ UUID Validation

**Files cần sửa:**

1. **src/modules/tasks/tasks.controller.ts**
   ```typescript
   // TRƯỚC
   @Param('userId', new ParseUUIDPipe()) userId: string
   
   // SAU
   @Param('userId') userId: string  // ✅ Chấp nhận cả Firebase UID và UUID
   ```

2. **src/modules/workspaces/dto/add-member.dto.ts**
   ```typescript
   // TRƯỚC
   @IsUUID()
   userId: string;
   
   // SAU
   @IsString()
   userId: string;  // ✅ Validate string thay vì UUID
   ```

---

### C. Frontend Changes (KHÔNG CẦN)

**Vì TẠO MỚI DATABASE:**
- Users sẽ **register lại** từ đầu
- Không có "old session" để worry
- Backend response ngay lập tức trả `id = Firebase UID`
- Frontend tự động lưu đúng:
  ```java
  getUserId() → Firebase UID
  getInternalUserId() → Firebase UID (same value)
  ```

**Action items:**
- [ ] KHÔNG CẦN force logout logic
- [ ] KHÔNG CẦN fallback logic
- [ ] Thông báo 3 devs: "Database recreated - please register again"
- [ ] (Optional) Cleanup `getInternalUserId()` sau khi verify stable

---

## IV. IMPLEMENTATION PLAN

### Phase 1: Schema Changes (30 phút)

**Checklist:**
- [ ] Backup database production
- [ ] Update `prisma/schema.prisma`:
  - [ ] Bỏ `@default(...)` và `@db.Uuid` từ `users.id`
  - [ ] Thêm `?` (nullable) cho `users.firebase_uid`
  - [ ] Bỏ `@db.Uuid` từ 18 user FK columns
- [ ] Tạo migration: `npx prisma migrate dev --name convert_users_id_to_firebase_uid`
- [ ] Review migration SQL
- [ ] Test trên database dev

### Phase 2: Backend Code (60 phút)

**Checklist:**
- [ ] Update `users.service.ts`:
  - [ ] Sửa `ensureFromFirebase()` - dual lookup
  - [ ] Sửa `localSignup()` - manually assign id
## IV. IMPLEMENTATION PLAN

### Phase 1: Backup & Preparation (15 phút)

### Phase 3: Schema Update (15 phút)

**Checklist:**
- [ ] Update `users.service.ts`:
  - [ ] Sửa `ensureFromFirebase()` - bỏ fallback logic
  - [ ] Sửa `localSignup()` - manually assign id = Firebase UID
**Test Cases:**

1. **Verify Migration Success**
   ```sql
   -- Check all users have Firebase UID format
   SELECT id, email FROM users;
   -- All ids should be ~28 chars, no hyphens
   
   -- Check no firebase_uid column
   \d users
   -- Should NOT show firebase_uid
   
   -- Check FK integrity
   SELECT COUNT(*) FROM task_comments tc
   LEFT JOIN users u ON tc.user_id = u.id
   WHERE u.id IS NULL;
   -- Should be 0
   ```

2. **User Login**
   ```bash
   # Login với 1 trong 8 users
   curl -X POST /api/auth/login \
     -d '{"email":"existing@user.com","password":"..."}'
   
   # Verify: Trả về user với id = Firebase UID
   ```

3. **Create Task**
   ```bash
   # Tạo task
   curl -X POST /api/tasks \
     -H "Authorization: Bearer <token>" \
     -d '{"title":"Test task",...}'
   
   # Verify: created_by = Firebase UID (matches logged in user)
   ```

4. **Ownership Check**
   ```bash
**Staging:**
- [ ] Deploy code to staging
- [ ] Run data migration SQL script
- [ ] Update Prisma schema
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Restart backend
- [ ] Smoke test: Login 8 users, create task, check ownership
- [ ] Monitor logs for errors

**Production (sau khi staging OK - ~5-10 phút downtime):**
- [ ] **Thông báo users TRƯỚC 24h:**
  - Maintenance window 5-10 phút
  - **Users SẼ BỊ LOGOUT sau maintenance**
  - Cần login lại để tiếp tục sử dụng
- [ ] Backup production database (đã làm ở Phase 1)
- [ ] **Put app in maintenance mode**
- [ ] Run data migration SQL script:
  ```bash
  psql $DATABASE_URL -f migrate_users_to_firebase_uid.sql
  ```
- [ ] Verify migration success
- [ ] Deploy backend code mới
- [ ] Generate Prisma client
- [ ] Restart backend
- [ ] **Deploy frontend update** (force logout logic)
- [ ] **Remove maintenance mode**
- [ ] Smoke test với 2-3 users (login mới)
- [ ] Monitor for 1 giờ
- [ ] **Verify:** Không còn users nào dùng session cũ (check logs)

### Phase 2: Data Migration Script (30 phút)

**Tạo migration SQL file:**

```sql
-- File: migrate_users_to_firebase_uid.sql
BEGIN TRANSACTION;

-- Step 1: Backup
CREATE TABLE users_backup AS SELECT * FROM users;
CREATE TABLE activity_logs_backup AS SELECT * FROM activity_logs;
CREATE TABLE task_comments_backup AS SELECT * FROM task_comments;
-- ... backup other tables with user FKs ...

-- Step 2: Update all FK columns to Firebase UID
UPDATE activity_logs SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = activity_logs.user_id
) WHERE user_id IS NOT NULL;

UPDATE attachments SET uploaded_by = (
  SELECT firebase_uid FROM users WHERE users.id = attachments.uploaded_by
) WHERE uploaded_by IS NOT NULL;

UPDATE events SET created_by = (
  SELECT firebase_uid FROM users WHERE users.id = events.created_by
) WHERE created_by IS NOT NULL;

UPDATE integration_tokens SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = integration_tokens.user_id
) WHERE user_id IS NOT NULL;

UPDATE memberships SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = memberships.user_id
) WHERE user_id IS NOT NULL;

UPDATE notifications SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = notifications.user_id
) WHERE user_id IS NOT NULL;

UPDATE notifications SET created_by = (
  SELECT firebase_uid FROM users WHERE users.id = notifications.created_by
) WHERE created_by IS NOT NULL;

UPDATE participants SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = participants.user_id
) WHERE user_id IS NOT NULL;

UPDATE project_members SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = project_members.user_id
) WHERE user_id IS NOT NULL;

UPDATE project_members SET added_by = (
  SELECT firebase_uid FROM users WHERE users.id = project_members.added_by
) WHERE added_by IS NOT NULL;

UPDATE project_invitations SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = project_invitations.user_id
) WHERE user_id IS NOT NULL;

UPDATE project_invitations SET invited_by = (
  SELECT firebase_uid FROM users WHERE users.id = project_invitations.invited_by
) WHERE invited_by IS NOT NULL;

UPDATE task_assignees SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = task_assignees.user_id
) WHERE user_id IS NOT NULL;

UPDATE task_assignees SET assigned_by = (
  SELECT firebase_uid FROM users WHERE users.id = task_assignees.assigned_by
) WHERE assigned_by IS NOT NULL;

UPDATE task_comments SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = task_comments.user_id
) WHERE user_id IS NOT NULL;

UPDATE tasks SET created_by = (
  SELECT firebase_uid FROM users WHERE users.id = tasks.created_by
) WHERE created_by IS NOT NULL;

UPDATE time_entries SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = time_entries.user_id
) WHERE user_id IS NOT NULL;

UPDATE user_devices SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = user_devices.user_id
) WHERE user_id IS NOT NULL;

UPDATE watchers SET user_id = (
  SELECT firebase_uid FROM users WHERE users.id = watchers.user_id
) WHERE user_id IS NOT NULL;

UPDATE workspaces SET owner_id = (
  SELECT firebase_uid FROM users WHERE users.id = workspaces.owner_id
) WHERE owner_id IS NOT NULL;

-- Step 3: Verify no NULL FK values
SELECT COUNT(*) FROM activity_logs WHERE user_id IS NULL AND user_id IN (SELECT id FROM users_backup);
-- Should be 0 for all tables

-- Step 4: Drop users PK constraint
ALTER TABLE users DROP CONSTRAINT users_pkey;

-- Step 5: Swap users.id with firebase_uid
UPDATE users SET id = firebase_uid;

-- Step 6: Re-add PK constraint
ALTER TABLE users ADD PRIMARY KEY (id);

-- Step 7: Drop firebase_uid column
ALTER TABLE users DROP COLUMN firebase_uid;

-- Step 8: Verify migration
SELECT id, email FROM users LIMIT 5;
-- All ids should now be Firebase UID format (no hyphens, ~28 chars)

COMMIT;
```

**Checklist:**
## V. ROLLBACK PLAN

### Nếu có vấn đề SAU migration:

**⚠️ CRITICAL: Phải rollback NGAY nếu thấy lỗi**

**Database Rollback (Full Restore):**
```bash
# 1. Put app in maintenance mode

# 2. Drop current tables
psql $DATABASE_URL -c "DROP TABLE users CASCADE;"
psql $DATABASE_URL -c "DROP TABLE activity_logs CASCADE;"
# ... drop other affected tables

# 3. Restore từ backup
psql $DATABASE_URL < backup_prod_YYYYMMDD_HHMMSS.sql

# 4. Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE firebase_uid IS NOT NULL;"
# Should be 8

# 5. Revert code
git revert <commit-hash>
npm run build
pm2 restart plantracker-backend

# 6. Remove maintenance mode
```

**⏱️ Rollback time: ~10-15 phút**# User mới tạo task
   curl -X POST /api/tasks \
     -H "Authorization: Bearer <token>" \
     -d '{"title":"Test task",...}'
   
   # Verify: created_by = Firebase UID
   ```

4. **Ownership Check**
   ```bash
   # Get task details
   curl /api/tasks/:id -H "Authorization: Bearer <token>"
   
   # Frontend: currentUserId === task.createdBy → ✅ Match
   ```

### Phase 4: Deployment (30 phút)

**Staging:**
- [ ] Deploy code to staging
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Smoke test: Create user, login, create task
- [ ] Monitor logs for errors

**Production (sau khi staging OK):**
- [ ] Backup production database
- [ ] Deploy code
- [ ] Run migration (zero downtime)
- [ ] Monitor for 30 phút
- [ ] Verify new users created correctly

## VI. RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Migration SQL fails mid-way** | 🔴 HIGH | Use TRANSACTION, test on staging first |
| **FK updates incomplete** | 🔴 HIGH | Verify counts before/after each UPDATE |
| **Users can't login after** | 🔴 HIGH | Test all 8 users immediately after migration |
| **Data loss** | 🔴 HIGH | Full backup before migration + backup tables in transaction |
| **Downtime > 10 phút** | 🟡 MEDIUM | Practice migration on staging, optimize queries |
| **Orphaned records** | 🟡 MEDIUM | Verify FK integrity with COUNT queries |
npm run build
pm2 restart plantracker-backend
## VII. SUCCESS METRICS

### Ngay sau migration:

✅ **Database:**
- [ ] 8 users có `id` format Firebase UID (không phải UUID)
- [ ] Không còn column `firebase_uid`
- [ ] Tất cả FK references trỏ đúng Firebase UID
- [ ] FK integrity check = 0 orphaned records

```sql
-- Verify users
SELECT id, email FROM users;
-- All ids should be ~28 chars, no hyphens

-- Verify FKs
SELECT 'activity_logs' as tbl, COUNT(*) as orphaned FROM activity_logs al
LEFT JOIN users u ON al.user_id = u.id WHERE u.id IS NULL
UNION ALL
SELECT 'task_comments', COUNT(*) FROM task_comments tc
LEFT JOIN users u ON tc.user_id = u.id WHERE u.id IS NULL;
-- All counts should be 0
```

✅ **Backend:**
- [ ] Tất cả 8 users login thành công
- [ ] Tạo task → `created_by = Firebase UID`
- [ ] Comment → `user_id = Firebase UID`
- [ ] No errors in logs

✅ **Frontend:**
- [ ] Ownership checks hoạt động (hiện nút Edit/Delete)
- [ ] Activity logs hiện "You" đúng
- [ ] Comments có author đúng
## VIII. FAQ

### Q1: Tại sao migrate trực tiếp thay vì gradual?

**A:** 
- ✅ **Chỉ 8 users:** Số lượng nhỏ, migration nhanh (~5 phút)
- ✅ **Đơn giản hóa code:** Không cần dual lookup, fallback logic
- ✅ **Clean schema:** Bỏ hoàn toàn firebase_uid column
- ✅ **Test dễ:** Verify cả 8 users ngay sau migration

### Q2: Downtime bao lâu?

**A:** ~5-10 phút:
- Backup: ~1 phút
- Migration SQL: ~3-5 phút (18 FK updates + users update)
- Deploy code: ~2 phút
- Verify: ~2 phút

### Q3: Nếu migration fail thì sao?

**A:** 
- ✅ **TRANSACTION:** Tất cả changes rollback tự động nếu có lỗi
- ✅ **Backup tables:** Có backup ngay trong transaction
- ✅ **Full backup:** Có full database backup để restore
- ⏱️ **Rollback time:** ~10-15 phút

### Q4: Có mất data không?

**A:** KHÔNG, nếu làm đúng:
- ✅ Transaction đảm bảo atomic operation
- ✅ Backup tables trước khi update
- ✅ Verify từng bước
- ✅ Test trên staging trước

### Q5: User có phải login lại không?

**A:** CÓ - BẮT BUỘC:
- ❌ **Session cũ INVALID:** SharedPreferences lưu UUID cũ, không tồn tại sau migration
- ❌ **API calls FAIL:** createTask, assignTask với UUID cũ → User not found
- ✅ **Force logout:** Frontend cần force logout ALL users sau migration
- ✅ **Thông báo:** "Please logout and login again for system update"

### Q6: Frontend có cần update code không?

**A:** CÓ - 2 nơi sử dụng `getInternalUserId()`:
- `ProjectActivity.java:536` - createTask với `createdBy`
- `TaskDetailBottomSheet.java:345` - assignTask
- **Option 1:** Force logout all users (recommended)
- **Option 2:** Fallback logic: Nếu UUID format → dùng Firebase UID
- **Option 3:** Cleanup sau 1 tuần: Bỏ `getInternalUserId()`, merge vào `getUserId()`
- ❌ **High risk:** Phải update 18 FK columns across nhiều bảng
## IX. TIMELINE ESTIMATE

**Tổng thời gian: ~3 giờ (bao gồm 5-10 phút downtime)**

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Backup** | 15 phút | Backup DB, export users, verify data |
| **Phase 2: Migration Script** | 30 phút | Write SQL migration, review carefully |
| **Phase 3: Schema Update** | 15 phút | Update Prisma schema, bỏ firebase_uid |
| **Phase 4: Backend Code** | 45 phút | Update services, guards, validators |
| **Phase 5: Testing** | 30 phút | Test migration script on staging |
| **Phase 6: Production** | 30 phút | **5-10 phút downtime** + verify |
| **Monitoring** | 30 phút | Check all features, monitor errors |

**A:** Sau 6-12 tháng, nếu:
- ✅ > 90% users đã là Firebase UID format
- ✅ Hệ thống ổn định, không có bugs
- ✅ Có maintenance window
- ✅ Đã test kỹ trên staging
## X. APPROVAL CHECKLIST

Trước khi triển khai:

- [ ] **Tech Lead:** Review Prisma schema changes
- [ ] **3 Devs:** Xác nhận OK với việc register lại
- [ ] **Backup:** Optional backup của database cũ (nếu cần reference)
- [ ] **Product Owner:** Đồng ý với direct migration + downtime 5-10 phút
- [ ] **Tech Lead:** Review migration SQL script kỹ lưỡng
- [ ] **QA:** Test migration script trên staging thành công
- [ ] **DevOps:** Full backup completed, rollback plan ready
- [ ] **All 8 Users:** Thông báo maintenance window trước 24h
---

## IX. TIMELINE ESTIMATE

**Tổng thời gian: 3-4 giờ**

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Preparation** | 30 phút | Review plan, backup DB, setup environment |
| **Schema Changes** | 30 phút | Update Prisma schema, create migration |
| **Backend Code** | 60 phút | Update services, guards, validators |
| **Testing** | 45 phút | Unit tests, integration tests, manual tests |
| **Staging Deploy** | 30 phút | Deploy, migrate, smoke test |
| **Production Deploy** | 30 phút | Deploy, migrate, monitor |
| **Verification** | 30 phút | Check metrics, verify features |
## XI. NEXT STEPS

1. **Review document này** với team
2. **Write complete migration SQL script** (Phase 2)
3. **Test migration trên staging** với data giống production
4. **Approve plan** từ stakeholders
5. **Thông báo 8 users** về maintenance window
6. **Schedule maintenance** (recommend: Low traffic hours, weekend)
7. **Execute migration** theo từng phase
8. **Monitor intensively** sau migration (1-2 giờ đầu)
**Document Version:** 2.0 (Direct Migration)  
**Last Updated:** 2025-11-29  
**Status:** 📋 Ready for Review & Testing  
**Author:** Backend Team  
**Risk Level:** 🟡 MEDIUM (Direct data migration, short downtime) & rollback plan ready
- [ ] **Frontend Team:** Aware of changes (optional frontend updates)

---

## XI. NEXT STEPS

1. **Review document này** với team
2. **Approve plan** từ stakeholders
3. **Schedule deployment** (recommend: Low traffic hours)
4. **Execute Phase 1-4** theo checklist
5. **Monitor & adjust** based on metrics

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-29  
**Status:** 📋 Ready for Review  
**Author:** Backend Team

---

## APPENDIX: Code Examples

### Example 1: User Creation Flow

```typescript
// OLD BEHAVIOR
const firebaseUser = await admin.auth().createUser({...});
const dbUser = await prisma.users.create({
  data: {
    // id: auto-generated UUID ❌
    firebase_uid: firebaseUser.uid,
    email: firebaseUser.email
  }
});
// Result: id = "550e8400-...", firebase_uid = "KxYz1234..."

// NEW BEHAVIOR
### Example 2: Authentication Flow

```typescript
// OLD BEHAVIOR
const decoded = await admin.auth().verifyIdToken(token);
### Q5: User có phải login lại không?

**A:** CÓ - nhưng đơn giản:
- Database mới = phải **REGISTER** lại (không phải login)
- 3 devs chỉ cần tạo account mới
- Không có "old session" để worry

### Q6: Frontend có cần update code không?

**A:** KHÔNG:
- Users register mới → backend trả `id = Firebase UID` ngay từ đầu
- Frontend tự động lưu đúng
- `getUserId()` và `getInternalUserId()` sẽ return cùng giá trị
- (Optional) Cleanup `getInternalUserId()` sau khi stable

// Fallback to old users
if (!user) {
  user = await prisma.users.findUnique({
    where: { firebase_uid: decoded.uid }
  });
}
### Example 3: Frontend Ownership Check

```java
// OLD BEHAVIOR (BROKEN)
String myId = tokenManager.getUserId();        // Firebase UID
String commentAuthor = comment.getUserId();    // UUID ❌
if (myId.equals(commentAuthor)) {
  // NEVER MATCHES
}

// NEW BEHAVIOR (FIXED - SAU MIGRATION)
String myId = tokenManager.getUserId();        // Firebase UID
String commentAuthor = comment.getUserId();    // Firebase UID ✅
if (myId.equals(commentAuthor)) {
  // ✅ MATCHES - Both are Firebase UID
  showEditButton();
}
```

### Example 4: Data Migration Verification

```sql
-- TRƯỚC MIGRATION
SELECT id, firebase_uid, email FROM users LIMIT 3;
/*
id                                    | firebase_uid              | email
--------------------------------------|---------------------------|------------------
550e8400-e29b-41d4-a716-446655440000 | KxYz1234AbCd5678EfGh9012 | user1@example.com
7c9e6679-7425-40de-944b-e07fc1f90ae7 | IjKl3456MnOp7890QrSt1234 | user2@example.com
*/

-- SAU MIGRATION
SELECT id, email FROM users LIMIT 3;
/*
id                        | email
--------------------------|------------------
KxYz1234AbCd5678EfGh9012 | user1@example.com
IjKl3456MnOp7890QrSt1234 | user2@example.com
*/
-- ✅ id is now Firebase UID, firebase_uid column removed

-- Verify FK integrity
SELECT tc.id, tc.user_id, u.email 
FROM task_comments tc
JOIN users u ON tc.user_id = u.id
LIMIT 3;
## ⚠️ IMPORTANT REMINDERS

1. **TEST trên staging TRƯỚC** - Migrate staging database với cùng script
2. **BACKUP đầy đủ** - Full database backup + export users list
3. **VERIFY từng bước** - Check count sau mỗi UPDATE statement
4. **FRONTEND DEPLOYMENT** - Deploy frontend force logout CÙNG LÚC với backend
5. **THÔNG BÁO USERS** - Clear communication về logout requirement
6. **MONITOR chặt chẽ** - Watch logs trong 1-2 giờ đầu sau migration
7. **ROLLBACK plan ready** - Sẵn sàng restore từ backup nếu có vấn đề

## ⚠️ CRITICAL: Frontend Session Management
## ⚠️ IMPORTANT REMINDERS

1. **SIMPLE APPROACH** - Drop database + recreate với schema mới
2. **BACKUP optional** - Chỉ để reference nếu cần
3. **NO DOWNTIME** - Fresh start, không cần maintenance window
4. **THÔNG BÁO 3 DEVS** - "Database recreated - please register again"
5. **NO FRONTEND CHANGES** - Register mới tự động work
6. **MONITOR** - Check logs sau deployment

## ✅ BENEFITS of Fresh Recreation

**So với Migration phức tạp:**

1. **No SQL migration script** - Không cần viết/test UPDATE statements
2. **No FK updates** - Prisma handle tất cả
3. **No downtime** - Recreate nhanh hơn migrate
4. **No force logout logic** - Users register mới
5. **No rollback complexity** - Rollback = restore backup đơn giản
6. **Clean start** - Không có legacy data issues

**Total time:** ~1 hour (vs 3 hours migration)tion
5. **ROLLBACK plan ready** - Sẵn sàng restore từ backup nếu có vấn đề

---

**END OF DOCUMENT**
