# Mapping Schema cho Cron Worker + FCM Implementation

## 📋 Tổng Quan

Document này giải thích chi tiết cách mapping giữa Prisma schema thực tế và implementation của Cron Worker + FCM notifications.

---

## ✅ Schema Mapping - Điều chỉnh quan trọng

### 1. Model Names (Số nhiều vs Số ít)

| Document gốc | Schema thực tế | Lý do |
|-------------|---------------|-------|
| `prisma.task` | `prisma.tasks` | Model name trong schema là số nhiều |
| `prisma.user` | `prisma.users` | Model name trong schema là số nhiều |

### 2. Field Names (camelCase vs snake_case)

| Document gốc | Schema thực tế | Lý do |
|-------------|---------------|-------|
| `dueDate` | `due_at` | Database column sử dụng snake_case |
| `fcmToken` | N/A - Lấy từ `user_devices.fcm_token` | FCM token lưu trong bảng riêng |
| `assignedUser` | `users_tasks_assignee_idTousers` | Relation name do Prisma generate |
| `project` | `projects` | Relation name mặc định |
| `assigneeId` | `assignee_id` | Column name snake_case |
| `projectId` | `project_id` | Column name snake_case |
| `userId` | `user_id` | Column name snake_case |
| `taskId` | N/A - Không dùng trực tiếp | Notifications không reference task trực tiếp |

### 3. Enum Values

| Document gốc | Schema thực tế | Lý do |
|-------------|---------------|-------|
| `'COMPLETED'` | `'DONE'` | Enum `issue_status.DONE` |
| `'TODO'` | `'TO_DO'` | Enum `issue_status.TO_DO` |
| `'task_reminder'` | `'TIME_REMINDER'` | Enum `notification_type.TIME_REMINDER` |
| `'daily_summary'` | `'SYSTEM'` | Enum `notification_type.SYSTEM` |

### 4. Data Types

| Field | Document gốc | Schema thực tế | Lý do |
|-------|-------------|---------------|-------|
| `id` | `number` | `string (UUID)` | Database sử dụng UUID |
| `user_id` | `number` | `string (UUID)` | Database sử dụng UUID |
| `task_id` | `number` | `string (UUID)` | Database sử dụng UUID |

---

## 🔄 Query Patterns - Worker Service

### Query 1: Upcoming Tasks (Sắp đến hạn)

**❌ Document gốc (KHÔNG ĐÚNG):**
```typescript
const tasks = await this.prisma.task.findMany({
  where: {
    dueDate: { gte: now, lte: tomorrow },
    status: { not: 'COMPLETED' },
  },
  include: {
    assignedUser: {
      select: { id: true, name: true, fcmToken: true }
    },
    project: {
      select: { id: true, name: true }
    }
  }
});
```

**✅ Implementation đúng:**
```typescript
const upcomingTasks = await this.prisma.tasks.findMany({
  where: {
    due_at: {
      gte: now,
      lte: tomorrow,
    },
    status: {
      not: 'DONE', // ✅ Enum value đúng
    },
    deleted_at: null, // ✅ Bỏ qua tasks đã xóa
  },
  include: {
    users_tasks_assignee_idTousers: { // ✅ Relation name đúng
      select: {
        id: true,
        name: true,
        user_devices: { // ✅ Lấy FCM từ bảng riêng
          where: { is_active: true },
          select: { fcm_token: true },
          take: 1,
        },
      },
    },
    projects: { // ✅ Relation name đúng
      select: {
        id: true,
        name: true,
      },
    },
  },
});
```

### Query 2: Users with Active Tasks

**❌ Document gốc (KHÔNG ĐÚNG):**
```typescript
const users = await this.prisma.user.findMany({
  where: {
    fcmToken: { not: null },
    assignedTasks: {
      some: { status: { not: 'COMPLETED' } }
    }
  },
  include: {
    assignedTasks: {
      where: { status: { not: 'COMPLETED' } },
      select: { id: true, title: true, dueDate: true }
    }
  }
});
```

**✅ Implementation đúng:**
```typescript
const usersWithTasks = await this.prisma.users.findMany({
  where: {
    user_devices: { // ✅ Check device có active không
      some: { is_active: true },
    },
    tasks_tasks_assignee_idTousers: { // ✅ Relation đúng
      some: {
        status: { not: 'DONE' },
        deleted_at: null,
      },
    },
  },
  include: {
    user_devices: {
      where: { is_active: true },
      select: { fcm_token: true },
      take: 1,
    },
    tasks_tasks_assignee_idTousers: {
      where: {
        status: { not: 'DONE' },
        deleted_at: null,
      },
      select: {
        id: true,
        title: true,
        due_at: true, // ✅ Field name đúng
        status: true,
      },
    },
  },
});
```

---

## 🔐 FCM Token Management

### Schema Hiện Tại (✅ ĐÃ CÓ SẴN)

```prisma
model user_devices {
  id             String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  user_id        String    @db.Uuid
  fcm_token      String    @unique
  platform       platform  @default(ANDROID)
  device_model   String?
  app_version    String?
  is_active      Boolean   @default(true)
  last_active_at DateTime? @db.Timestamptz(6)
  
  users users @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  @@index([user_id, is_active])
}
```

### Lấy FCM Token cho User

**Pattern đúng:**
```typescript
// Lấy active device đầu tiên của user
const activeDevice = await this.prisma.user_devices.findFirst({
  where: {
    user_id: userId,
    is_active: true,
  },
  select: {
    fcm_token: true,
    platform: true,
  },
});

const fcmToken = activeDevice?.fcm_token;
```

**Hoặc trong query include:**
```typescript
include: {
  user_devices: {
    where: { is_active: true },
    select: { fcm_token: true },
    take: 1,
  },
}
```

---

## 📝 Notification Logging

### Schema Hiện Tại (✅ ĐÃ CÓ SẴN)

```prisma
model notifications {
  id           String                @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  user_id      String                @db.Uuid
  type         notification_type     // Enum: TIME_REMINDER, SYSTEM, etc.
  title        String
  body         String?
  data         Json?                 // Custom payload
  channel      notification_channel  // PUSH, IN_APP, EMAIL
  priority     notification_priority? // LOW, NORMAL, HIGH
  status       notification_status   // QUEUED, SENT, DELIVERED, READ, FAILED
  sent_at      DateTime?             @db.Timestamptz(6)
  created_at   DateTime              @default(now()) @db.Timestamptz(6)
  
  users users @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

### Log Notification đúng cách

```typescript
await this.prisma.notifications.create({
  data: {
    user_id: userId, // ✅ UUID string
    type: 'TIME_REMINDER', // ✅ Enum value đúng
    title: 'Nhắc nhở Task',
    body: message,
    channel: 'PUSH',
    priority: 'HIGH',
    status: 'SENT',
    sent_at: new Date(),
    data: { taskId: taskId }, // ✅ JSON object
  },
});
```

---

## 🎯 Type Definitions - TypeScript Interfaces

### Interface cho Worker Service

```typescript
// Task data từ database
interface TaskFromDB {
  id: string; // UUID
  title: string;
  due_at: Date;
  status: 'TO_DO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  users_tasks_assignee_idTousers: {
    id: string;
    name: string;
    user_devices: Array<{
      fcm_token: string;
    }>;
  } | null;
  projects: {
    id: string;
    name: string;
  };
}

// User data từ database
interface UserFromDB {
  id: string; // UUID
  name: string;
  email: string;
  user_devices: Array<{
    fcm_token: string;
  }>;
  tasks_tasks_assignee_idTousers: Array<{
    id: string;
    title: string;
    due_at: Date;
    status: string;
  }>;
}

// Notification payload
interface NotificationPayload {
  userId: string; // UUID
  fcmToken: string;
  task?: {
    id: string; // UUID
    title: string;
    dueDate: Date;
    projectName: string;
  };
  message: string;
}
```

---

## ⚠️ Common Pitfalls (Lỗi thường gặp)

### 1. ❌ Dùng sai model name
```typescript
// SAI
await this.prisma.task.findMany()
await this.prisma.user.findMany()

// ĐÚNG
await this.prisma.tasks.findMany()
await this.prisma.users.findMany()
```

### 2. ❌ Dùng sai field name
```typescript
// SAI
where: { dueDate: { gte: now } }

// ĐÚNG
where: { due_at: { gte: now } }
```

### 3. ❌ Dùng sai enum value
```typescript
// SAI
status: { not: 'COMPLETED' }

// ĐÚNG
status: { not: 'DONE' }
```

### 4. ❌ Quên check deleted_at
```typescript
// SAI - Bao gồm cả task đã xóa
where: { status: { not: 'DONE' } }

// ĐÚNG - Chỉ lấy task chưa xóa
where: { 
  status: { not: 'DONE' },
  deleted_at: null 
}
```

### 5. ❌ Lấy FCM token sai cách
```typescript
// SAI - Không có field fcmToken trên users
user.fcmToken

// ĐÚNG - Lấy từ user_devices
user.user_devices?.[0]?.fcm_token
```

### 6. ❌ Dùng sai relation name
```typescript
// SAI
include: { assignedUser: true }

// ĐÚNG
include: { users_tasks_assignee_idTousers: true }
```

### 7. ❌ Dùng number cho UUID
```typescript
// SAI
userId: 123

// ĐÚNG
userId: "550e8400-e29b-41d4-a716-446655440000"
```

---

## 🧪 Testing Queries

### Test Query trong Prisma Studio hoặc Script

```typescript
// Test 1: Lấy tasks sắp đến hạn
const upcomingTasks = await prisma.tasks.findMany({
  where: {
    due_at: {
      gte: new Date(),
      lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    status: { not: 'DONE' },
    deleted_at: null,
  },
  include: {
    users_tasks_assignee_idTousers: {
      include: {
        user_devices: {
          where: { is_active: true },
        },
      },
    },
  },
});

console.log('Upcoming tasks:', upcomingTasks.length);

// Test 2: Lấy active FCM tokens
const activeTokens = await prisma.user_devices.findMany({
  where: {
    is_active: true,
  },
  select: {
    fcm_token: true,
    users: {
      select: {
        name: true,
        email: true,
      },
    },
  },
});

console.log('Active FCM tokens:', activeTokens.length);
```

---

## ✅ Checklist Implementation

Khi implement Worker Service, đảm bảo:

- [ ] Sử dụng model name đúng (`tasks`, `users`, `notifications`)
- [ ] Sử dụng field name đúng (`due_at`, `user_id`, `fcm_token`)
- [ ] Sử dụng enum value đúng (`DONE`, `TIME_REMINDER`, `PUSH`)
- [ ] Lấy FCM token từ `user_devices` table
- [ ] Filter `deleted_at: null` cho tasks
- [ ] Check `is_active: true` cho devices
- [ ] Sử dụng UUID string cho tất cả IDs
- [ ] Log notifications vào `notifications` table
- [ ] Map notification type đúng với enum
- [ ] Handle null/undefined cho optional relations

---

## 📚 References

- Prisma Schema: `prisma/schema.prisma`
- Worker Implementation: `RENDER_CRON_WORKER_FCM_SETUP.md`
- Database: PostgreSQL (Neon)
- FCM: Firebase Cloud Messaging
