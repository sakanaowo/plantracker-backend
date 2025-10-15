# Logic Tạo Default Project cho User Mới

## 📋 Tổng Quan

Khi một user mới đăng ký (qua Firebase hoặc email/password), hệ thống tự động tạo:

1. **Personal Workspace**
2. **Default Project** ("My First Project")
3. **3 Kanban Boards** (To Do, In Progress, Done)

---

## 🔄 Luồng Xử Lý

### 1. User Authentication (`users.service.ts`)

```typescript
async ensureFromFirebase(payload: {...}) {
  // Tạo/cập nhật user trong DB
  const user = await this.prisma.users.upsert({...});

  // Đảm bảo personal workspace tồn tại
  await this.workspaces.ensurePersonalWorkspaceByUserId(user.id);

  return user;
}
```

### 2. Tạo Personal Workspace (`workspaces.service.ts`)

```typescript
async ensurePersonalWorkspaceByUserId(userId: string) {
  // TRANSACTION với timeout configuration
  const workspace = await this.prisma.$transaction(
    async (tx) => {
      // Tìm workspace hiện có
      const existing = await tx.workspaces.findFirst({
        where: { owner_id: userId, type: 'PERSONAL' }
      });

      if (existing) {
        // Ensure membership tồn tại
        await tx.memberships.upsert({...});
        return existing;
      }

      // Tạo workspace mới
      const ws = await tx.workspaces.create({...});

      // Tạo membership
      await tx.memberships.create({...});

      return { ...ws, projects: [] };
    },
    {
      maxWait: 10000,  // 10s để acquire connection
      timeout: 20000,  // 20s để chạy transaction
    }
  );

  // Tạo default project NẾU workspace mới
  if (workspace.projects.length === 0) {
    try {
      await this.createDefaultProjectForWorkspace(workspace.id);
    } catch (error) {
      // Log nhưng không throw - workspace vẫn tạo thành công
      console.error('Failed to create default project:', error);
    }
  }

  return workspace;
}
```

### 3. Tạo Default Project (`workspaces.service.ts`)

```typescript
private async createDefaultProjectForWorkspace(workspaceId: string) {
  // Kiểm tra đề phòng race condition
  const existingProjects = await this.prisma.projects.count({
    where: { workspace_id: workspaceId }
  });

  if (existingProjects > 0) {
    return null; // Skip nếu đã có project
  }

  try {
    // Tạo project với key "MFP"
    const project = await this.projectsService.create({
      name: 'My First Project',
      workspace_id: workspaceId,
      key: 'MFP',
      description: 'Welcome to your first project!'
    });

    // Tạo 3 boards trong transaction
    await this.prisma.$transaction(async (tx) => {
      const boards = [
        { name: 'To Do', order: 1 },
        { name: 'In Progress', order: 2 },
        { name: 'Done', order: 3 }
      ];

      for (const board of boards) {
        await tx.boards.create({
          data: {
            project_id: project.id,
            name: board.name,
            order: board.order
          }
        });
      }
    });

    return project;

  } catch (error: unknown) {
    // Handle key conflict (nếu "MFP" đã tồn tại)
    const errorMessage = /* extract error message */;

    if (errorMessage.includes('already exists')) {
      // Retry với auto-generated key
      const project = await this.projectsService.create({
        name: 'My First Project',
        workspace_id: workspaceId,
        // Không truyền key → auto-generate (e.g., "MFP2", "MFP3")
      });

      // Tạo boards
      for (const board of defaultBoards) {
        await this.boardsService.create({...});
      }

      return project;
    }

    throw error;
  }
}
```

---

## 🛡️ Các Cơ Chế Bảo Vệ

### 1. **Transaction Timeout**

```typescript
{
  maxWait: 10000,  // Timeout khi đợi connection
  timeout: 20000,  // Timeout khi chạy transaction
}
```

**Lý do:** Tránh P2028 error khi database bận hoặc connection pool đầy.

### 2. **Graceful Degradation**

```typescript
try {
  await this.createDefaultProjectForWorkspace(workspace.id);
} catch (error) {
  console.error('Failed to create default project:', error);
  // KHÔNG throw - user vẫn có workspace
}
```

**Lý do:** User có thể tự tạo project sau. Quan trọng nhất là tạo workspace thành công.

### 3. **Race Condition Protection**

```typescript
const existingProjects = await this.prisma.projects.count({
  where: { workspace_id: workspaceId },
});

if (existingProjects > 0) {
  return null; // Skip nếu đã có project
}
```

**Lý do:** Đề phòng nhiều requests cùng lúc tạo default project cho cùng workspace.

### 4. **Key Conflict Handling**

```typescript
catch (error: unknown) {
  if (errorMessage.includes('already exists')) {
    // Retry với auto-generated key
    const project = await this.projectsService.create({
      name: 'My First Project',
      workspace_id: workspaceId,
      // key undefined → auto-generate
    });
  }
}
```

**Lý do:** Nếu "MFP" đã tồn tại, tự động tạo key khác (MFP2, MFP3, ...).

### 5. **Atomic Board Creation**

```typescript
await this.prisma.$transaction(async (tx) => {
  for (const board of defaultBoards) {
    await tx.boards.create({...});
  }
});
```

**Lý do:** Đảm bảo hoặc tất cả boards được tạo, hoặc không board nào được tạo (all-or-nothing).

---

## 🔧 Database Configuration

### Supabase Connection URLs

```env
# PgBouncer (pooling) - cho query thông thường
DATABASE_URL="postgresql://...@...pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection - cho migrations và transactions
DIRECT_URL="postgresql://...@...pooler.supabase.com:5432/postgres"
```

### Prisma Service Configuration

```typescript
constructor() {
  super({
    datasources: {
      db: {
        url: process.env.DIRECT_URL || process.env.DATABASE_URL,
      },
    },
  });
}
```

**Lý do:** PgBouncer (port 6543) không hỗ trợ đầy đủ PostgreSQL features cho transactions. DIRECT_URL (port 5432) bypass PgBouncer để có full features.

---

## 🧪 Test Cases

### Case 1: User Mới Đăng Ký

```
Input: User mới sign up
Expected:
- ✅ User được tạo trong DB
- ✅ Personal workspace được tạo
- ✅ Membership OWNER được tạo
- ✅ Project "My First Project" (MFP) được tạo
- ✅ 3 boards được tạo (To Do, In Progress, Done)
```

### Case 2: User Đã Tồn Tại

```
Input: User đã có account login lại
Expected:
- ✅ User info được update (nếu cần)
- ✅ Personal workspace được giữ nguyên
- ✅ Membership được ensure (nếu bị mất)
- ❌ KHÔNG tạo project mới (đã có projects)
```

### Case 3: Transaction Timeout

```
Input: Database bận, transaction timeout
Expected:
- ❌ Workspace không được tạo
- ❌ User nhận error
- ✅ Retry sẽ tạo workspace thành công
- ✅ Default project được tạo (nếu workspace mới)
```

### Case 4: Key Conflict

```
Input: Key "MFP" đã tồn tại trong workspace (race condition)
Expected:
- ✅ Retry với auto-generated key (MFP2, MFP3, ...)
- ✅ Project được tạo thành công
- ✅ Boards được tạo thành công
```

### Case 5: Board Creation Fails

```
Input: Tạo project OK nhưng tạo board lỗi
Expected:
- ❌ Transaction rollback
- ❌ Không có board nào được tạo
- ⚠️ Project tồn tại nhưng trống (cần xử lý manual)
```

---

## 📊 Monitoring & Debugging

### Logs cần quan tâm

```typescript
// Success
console.log(`Workspace ${workspaceId} already has projects, skipping...`);

// Key conflict
console.log(
  `Key conflict for workspace ${workspaceId}, trying with auto-generated key`,
);

// Failure (không break flow)
console.error(
  `Failed to create default project for workspace ${workspace.id}:`,
  error,
);
```

### Database Queries

```sql
-- Kiểm tra workspace không có projects
SELECT w.id, w.name, COUNT(p.id) as project_count
FROM workspaces w
LEFT JOIN projects p ON w.id = p.workspace_id
WHERE w.type = 'PERSONAL'
GROUP BY w.id, w.name
HAVING COUNT(p.id) = 0;

-- Kiểm tra projects không có boards
SELECT p.id, p.name, COUNT(b.id) as board_count
FROM projects p
LEFT JOIN boards b ON p.id = b.project_id
GROUP BY p.id, p.name
HAVING COUNT(b.id) = 0;
```

---

## 🚀 Improvements Đã Áp Dụng

| Issue                              | Before                                | After                                        |
| ---------------------------------- | ------------------------------------- | -------------------------------------------- |
| **Transaction timeout**            | Không config → P2028 error            | `maxWait: 10s`, `timeout: 20s`               |
| **Default project creation fails** | Throw error → user không có workspace | Try-catch → log error, user vẫn có workspace |
| **Race condition**                 | Có thể tạo duplicate projects         | Check count trước khi tạo                    |
| **Key conflict**                   | Throw error                           | Retry với auto-generated key                 |
| **Board creation fails**           | Partial creation                      | Transaction → all-or-nothing                 |
| **Database connection**            | PgBouncer limitations                 | Use DIRECT_URL cho transactions              |

---

## 📝 Notes

1. **Idempotency**: Logic được thiết kế để có thể chạy nhiều lần an toàn
2. **Graceful Degradation**: Nếu default project fail, user vẫn có workspace
3. **Atomic Operations**: Dùng transactions cho operations cần all-or-nothing
4. **Error Recovery**: Auto-retry với key khác khi conflict
5. **Connection Management**: Dùng DIRECT_URL để tránh PgBouncer limitations
