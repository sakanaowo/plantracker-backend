# FIREBASE UID MIGRATION - SIMPLE PLAN
## Fresh Database Recreation (8 Test Users)

**Status:** READY FOR IMPLEMENTATION  
**Last Updated:** November 29, 2025  
**Estimated Time:** ~1 hour  
**Downtime:** 0 minutes (fresh start)

---

## WHY THIS APPROACH?

**Vì chỉ có 8 test users (3 devs):**
- ✅ **KHÔNG cần migration script** - Drop + recreate
- ✅ **KHÔNG cần force logout** - Users register lại
- ✅ **KHÔNG downtime** - Fresh database
- ✅ **KHÔNG rủi ro** - Clean start
- ✅ **Nhanh nhất** - 1 hour vs 3 hours

---

## CHANGES OVERVIEW

### Database Schema

```prisma
// BEFORE
model User {
  id           String  @id @default(uuid())  // Auto UUID
  firebase_uid String? @unique                // Firebase UID
  email        String  @unique
}

// AFTER
model User {
  id    String @id   // Firebase UID (NO @default)
  email String @unique
}
```

### Backend Code

```typescript
// BEFORE - users.service.ts
async create(dto) {
  return prisma.user.create({
    data: {
      // id: auto-generated UUID
      firebase_uid: firebaseUid,
      email, name
    }
  });
}

// AFTER
async create(firebaseUid: string, dto) {
  return prisma.user.create({
    data: {
      id: firebaseUid,  // ✅ Direct from Firebase
      email, name
    }
  });
}
```

```typescript
// BEFORE - combined-auth.guard.ts
const user = await prisma.user.findUnique({
  where: { firebase_uid: decodedToken.uid }
});

// AFTER
const user = await prisma.user.findUnique({
  where: { id: decodedToken.uid }  // ✅ Changed
});
```

### Frontend

**KHÔNG CẦN THAY ĐỔI:**
- Users sẽ register lại
- Backend response: `{ id: "Firebase_UID", email: "..." }`
- Frontend lưu: `getUserId() = Firebase_UID`, `getInternalUserId() = Firebase_UID`
- ✅ Cả 2 methods return cùng value → ownership checks work

---

## IMPLEMENTATION STEPS

### Step 1: Backup Old Database (5 min)

**Optional - chỉ để reference:**

```bash
cd /home/sakana/Code/App/plantracker-backend

# Backup data cũ
pg_dump $DATABASE_URL > backup_old_db_$(date +%Y%m%d_%H%M%S).sql
```

**Checklist:**
- [ ] Backup created (or skip if no important data)
- [ ] Notify 3 devs: "Database sẽ recreate - cần register lại"

---

### Step 2: Update Prisma Schema (5 min)

**File:** `prisma/schema.prisma`

```diff
model User {
-  id           String  @id @default(uuid())
-  firebase_uid String? @unique
+  id    String @id
   email String @unique
   name  String?
   
   // All relations stay the same
   tasks               Task[]
   comments            Comment[]
   projectMembers      ProjectMember[]
   // ...
}
```

**Checklist:**
- [ ] Remove `@default(uuid())`
- [ ] Remove `firebase_uid` field
- [ ] Save file

---

### Step 3: Drop & Recreate Database (2 min)

**Choose one method:**

**Option A: Prisma Reset**
```bash
npx prisma migrate reset --force --skip-seed
```

**Option B: Manual Drop**
```bash
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE;"
psql $DATABASE_URL -c "CREATE SCHEMA public;"
```

**Checklist:**
- [ ] Database cleared
- [ ] Fresh database ready

---

### Step 4: Create Migration (5 min)

```bash
# Generate new migration
npx prisma migrate dev --name use_firebase_uid_as_primary_key

# This will:
# 1. Create migration SQL
# 2. Apply to database
# 3. Generate Prisma Client
```

**Checklist:**
- [ ] Migration created
- [ ] Migration applied
- [ ] Prisma Client regenerated

---

### Step 5: Update Backend Code (15 min)

**1. Update users.service.ts**

Find and update the `create` method:

```typescript
// File: src/modules/users/users.service.ts

async create(firebaseUid: string, email: string, name?: string) {
  return this.prisma.user.create({
    data: {
      id: firebaseUid,  // ✅ Use Firebase UID directly
      email,
      name,
    }
  });
}
```

**2. Update combined-auth.guard.ts**

```typescript
// File: src/auth/combined-auth.guard.ts

// Find this line:
const user = await this.prisma.user.findUnique({
  where: { firebase_uid: decodedToken.uid }  // ❌ OLD
});

// Change to:
const user = await this.prisma.user.findUnique({
  where: { id: decodedToken.uid }  // ✅ NEW
});
```

**3. Remove all firebase_uid references**

```bash
# Search for remaining references
grep -r "firebase_uid" src/ --exclude-dir=node_modules

# Update any found occurrences to use 'id' instead
```

**Checklist:**
- [ ] users.service.ts updated
- [ ] combined-auth.guard.ts updated
- [ ] No firebase_uid references in src/

---

### Step 6: Test Locally (15 min)

```bash
# Start backend
npm run start:dev
```

**Test 1: Register New User**
```bash
# From Android app:
# 1. Register với Firebase Auth
# 2. Backend should create user với id = Firebase UID
```

**Test 2: Verify Database**
```sql
SELECT id, email FROM users;
-- id should be Firebase UID format (e.g., "KxYz1234AbCd...")
-- Should NOT have dashes like UUID (e.g., "550e8400-e29b-...")
```

**Test 3: API Calls**
```bash
# Create task
POST /tasks
{
  "title": "Test Task",
  "description": "Testing"
}

# Verify task.userId = Firebase UID
GET /tasks/:taskId
```

**Checklist:**
- [ ] User registration works
- [ ] Users table has Firebase UID format
- [ ] Task creation works
- [ ] Ownership checks work

---

### Step 7: Deploy to Production (10 min)

```bash
# Commit changes
git add prisma/schema.prisma prisma/migrations/
git add src/modules/users/users.service.ts
git add src/auth/combined-auth.guard.ts
git commit -m "feat: use Firebase UID as User primary key"

# Push to deploy (Railway/Heroku will auto-migrate)
git push origin develop
```

**Post-deployment:**
- [ ] **Notify 3 devs:** "Database recreated - please register again in app"
- [ ] Monitor logs for errors
- [ ] Test registration with 1-2 users
- [ ] Verify all features work

---

## VERIFICATION CHECKLIST

After deployment, verify:

- [ ] **Users table:**
  ```sql
  SELECT id, email FROM users LIMIT 5;
  -- id should be Firebase UID (no dashes)
  ```

- [ ] **Foreign keys:**
  ```sql
  SELECT COUNT(*) FROM tasks WHERE user_id NOT IN (SELECT id FROM users);
  -- Should return 0 (no orphaned records)
  ```

- [ ] **Ownership checks:**
  - Create task → verify createdBy = current user Firebase UID
  - Edit task → verify only owner can edit
  - Delete task → verify only owner can delete

- [ ] **Frontend:**
  - `getUserId()` returns Firebase UID
  - `getInternalUserId()` returns Firebase UID (same value)
  - Task assignment works
  - Comments ownership works

---

## ROLLBACK PLAN

**If something goes wrong:**

```bash
# Option 1: Restore backup
psql $DATABASE_URL < backup_old_db_*.sql

# Option 2: Git revert
git revert HEAD
git push origin develop
```

**Low risk because:**
- Fresh database (no production data)
- Only 8 test users
- Can recreate anytime

---

## FAQ

### Q1: Có mất data không?

**A:** CÓ - tất cả data cũ sẽ mất (8 users, tasks, comments, etc.)
- Acceptable vì chỉ là test data
- 3 devs sẽ register lại

### Q2: Cần downtime không?

**A:** KHÔNG
- Drop + recreate database nhanh (<5 min)
- Deploy backend auto-migrate
- Users có thể register ngay

### Q3: Frontend cần update không?

**A:** KHÔNG
- Users register mới → backend trả `id = Firebase UID`
- Frontend tự động lưu đúng
- Ownership checks work ngay

### Q4: Bao lâu hoàn thành?

**A:** ~1 hour total
- Schema update: 5 min
- Database recreate: 5 min
- Code changes: 15 min
- Testing: 15 min
- Deploy: 10 min
- Buffer: 10 min

### Q5: Risk level?

**A:** VERY LOW
- No production data
- Only 8 test users
- Fresh start = clean state
- Easy rollback

---

## APPROVAL CHECKLIST

- [ ] **Tech Lead:** Review schema changes
- [ ] **3 Devs:** OK with re-registering
- [ ] **Backup:** Optional (nếu muốn giữ reference)
- [ ] **Timeline:** Confirm deployment time

---

## BENEFITS vs Complex Migration

| Aspect | Complex Migration | Fresh Recreation |
|--------|------------------|------------------|
| Time | ~3 hours | ~1 hour |
| SQL Script | 200+ lines | 0 lines |
| FK Updates | Manual (18 columns) | Auto (Prisma) |
| Downtime | 5-10 min | 0 min |
| Risk | Medium | Very Low |
| Force Logout | Required | Not needed |
| Rollback | Complex | Simple restore |
| Frontend Changes | Required | Not needed |

**Winner:** Fresh Recreation ✅

---

## NEXT STEPS

1. **Review this plan** with team
2. **Get approval** from 3 devs
3. **Schedule deployment** (any time - no downtime)
4. **Execute steps 1-7** above
5. **Notify users** to register again
6. **Monitor** for 1 hour
7. **Done!** 🎉

---

**Ready to implement?** Let me know and I'll start! 🚀
