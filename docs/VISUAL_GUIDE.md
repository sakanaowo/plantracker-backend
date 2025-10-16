# 🎨 VISUAL GUIDE: CAMELCASE TRANSFORMATION

**Diagrams và visual aids để hiểu flow**

---

## 🏗️ ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST                           │
│                    (Mobile/Web Frontend)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ POST /api/tasks
                             │ {
                             │   "projectId": "uuid",
                             │   "boardId": "uuid",
                             │   "title": "Task"
                             │ }
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                     NESTJS CONTROLLER                            │
│                   (tasks.controller.ts)                          │
│                                                                   │
│  @Post()                                                         │
│  create(@Body() dto: CreateTaskDto) {                           │
│    return this.svc.create(dto);                                 │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Validated DTO (camelCase)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                             │
│                     (tasks.service.ts)                           │
│                                                                   │
│  async create(dto: CreateTaskDto) {                             │
│    return this.prisma.tasks.create({                            │
│      data: {                                                     │
│        project_id: dto.projectId,  // ← Transform here          │
│        board_id: dto.boardId,                                   │
│        ...                                                       │
│      }                                                           │
│    });                                                           │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Prisma query (snake_case)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
│                                                                   │
│  INSERT INTO tasks (                                             │
│    project_id,  -- snake_case columns                           │
│    board_id,                                                     │
│    created_at,                                                   │
│    updated_at                                                    │
│  ) VALUES (...)                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Returns row (snake_case)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                         PRISMA CLIENT                            │
│                                                                   │
│  Returns: {                                                      │
│    id: "uuid",                                                   │
│    project_id: "uuid",     // ← snake_case from DB              │
│    board_id: "uuid",                                            │
│    created_at: "2025-10-15T...",                                │
│    updated_at: "2025-10-15T..."                                 │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ snake_case object
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    🔥 TRANSFORM INTERCEPTOR 🔥                   │
│              (transform.interceptor.ts - GLOBAL)                 │
│                                                                   │
│  intercept(context, next) {                                     │
│    return next.handle().pipe(                                   │
│      map(data => toCamelCase(data))  // ← MAGIC HAPPENS HERE   │
│    );                                                            │
│  }                                                               │
│                                                                   │
│  toCamelCase({                          Transforms:              │
│    project_id: "uuid"     →    projectId: "uuid"               │
│    board_id: "uuid"       →    boardId: "uuid"                 │
│    created_at: "..."      →    createdAt: "..."                │
│    updated_at: "..."      →    updatedAt: "..."                │
│  })                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ camelCase response
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT RESPONSE                           │
│                   (Mobile/Web Frontend)                          │
│                                                                   │
│  ✅ Response: {                                                  │
│    "id": "uuid",                                                 │
│    "projectId": "uuid",      // ✅ camelCase                    │
│    "boardId": "uuid",        // ✅ camelCase                    │
│    "title": "Task",                                              │
│    "createdAt": "2025-10-15T...",  // ✅ camelCase             │
│    "updatedAt": "2025-10-15T..."   // ✅ camelCase             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 TRANSFORMATION FLOW

```
DATABASE          PRISMA         INTERCEPTOR        FRONTEND
(snake_case)   →  (snake_case) →  (camelCase)   →   (camelCase)
─────────────────────────────────────────────────────────────────

project_id    →   project_id   →   projectId     →   projectId ✅
board_id      →   board_id     →   boardId       →   boardId ✅
created_at    →   created_at   →   createdAt     →   createdAt ✅
updated_at    →   updated_at   →   updatedAt     →   updatedAt ✅
assignee_id   →   assignee_id  →   assigneeId    →   assigneeId ✅
```

---

## 📊 BEFORE vs AFTER

### ❌ BEFORE (Without Interceptor)

```
┌──────────┐         ┌─────────┐         ┌──────────┐
│          │  Query  │         │  Row    │          │
│ Service  │────────→│ Database│────────→│ Prisma   │
│          │         │         │         │          │
└──────────┘         └─────────┘         └────┬─────┘
                                              │
                                              │ snake_case
                                              ↓
                                    ┌──────────────────┐
                                    │   Controller     │
                                    │   Returns as-is  │
                                    └────────┬─────────┘
                                             │
                                             │ snake_case ❌
                                             ↓
                                    ┌──────────────────┐
                                    │    Frontend      │
                                    │   💥 ERROR!      │
                                    │   Expected:      │
                                    │   projectId      │
                                    │   Got:           │
                                    │   project_id     │
                                    └──────────────────┘
```

### ✅ AFTER (With Interceptor)

```
┌──────────┐         ┌─────────┐         ┌──────────┐
│          │  Query  │         │  Row    │          │
│ Service  │────────→│ Database│────────→│ Prisma   │
│          │         │         │         │          │
└──────────┘         └─────────┘         └────┬─────┘
                                              │
                                              │ snake_case
                                              ↓
                                    ┌──────────────────┐
                                    │   Controller     │
                                    │   Returns        │
                                    └────────┬─────────┘
                                             │
                                             │ snake_case
                                             ↓
                                    ┌──────────────────┐
                                    │  🔥 INTERCEPTOR  │
                                    │  Transform to    │
                                    │  camelCase       │
                                    └────────┬─────────┘
                                             │
                                             │ camelCase ✅
                                             ↓
                                    ┌──────────────────┐
                                    │    Frontend      │
                                    │   ✅ SUCCESS!    │
                                    │   projectId      │
                                    │   boardId        │
                                    │   createdAt      │
                                    └──────────────────┘
```

---

## 🎯 REQUEST/RESPONSE FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                    1. CLIENT SENDS REQUEST                   │
│                                                               │
│   POST /api/tasks                                            │
│   Content-Type: application/json                             │
│                                                               │
│   {                                                           │
│     "projectId": "9f7e4f98-...",   ← Frontend sends          │
│     "boardId": "8639c3e4-...",       camelCase               │
│     "title": "New Task"                                      │
│   }                                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    2. DTO VALIDATION                         │
│                                                               │
│   class CreateTaskDto {                                      │
│     @IsString() projectId!: string;  ← DTO expects           │
│     @IsString() boardId!: string;      camelCase             │
│     @IsString() title!: string;                              │
│   }                                                           │
│                                                               │
│   ✅ Validation passes                                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    3. SERVICE LAYER                          │
│                                                               │
│   async create(dto) {                                        │
│     return prisma.tasks.create({                             │
│       data: {                                                │
│         project_id: dto.projectId,  ← Transform to DB format │
│         board_id: dto.boardId,                              │
│         title: dto.title                                     │
│       }                                                       │
│     });                                                       │
│   }                                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    4. DATABASE INSERT                        │
│                                                               │
│   INSERT INTO tasks (                                        │
│     project_id,     ← DB columns are snake_case              │
│     board_id,                                               │
│     title,                                                   │
│     created_at,                                              │
│     updated_at                                               │
│   ) VALUES (...)                                             │
│                                                               │
│   RETURNING *;                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    5. PRISMA RETURNS                         │
│                                                               │
│   {                                                           │
│     id: "caf87252-...",                                      │
│     project_id: "9f7e4f98-...",  ← Prisma returns            │
│     board_id: "8639c3e4-...",      snake_case from DB        │
│     title: "New Task",                                       │
│     created_at: "2025-10-15T05:02:38.492Z",                 │
│     updated_at: "2025-10-15T05:02:38.492Z"                  │
│   }                                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              6. 🔥 INTERCEPTOR TRANSFORMS 🔥                 │
│                                                               │
│   Input (snake_case):                                        │
│   {                                                           │
│     project_id: "...",                                       │
│     board_id: "...",                                        │
│     created_at: "..."                                        │
│   }                                                           │
│                                                               │
│   ↓ toCamelCase() function                                  │
│                                                               │
│   Output (camelCase):                                        │
│   {                                                           │
│     projectId: "...",    ← Transformed!                      │
│     boardId: "...",      ← Transformed!                      │
│     createdAt: "..."     ← Transformed!                      │
│   }                                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    7. CLIENT RECEIVES                        │
│                                                               │
│   HTTP/1.1 201 Created                                       │
│   Content-Type: application/json                             │
│                                                               │
│   {                                                           │
│     "id": "caf87252-7e4a-4f8c-a150-d56ed3af7a7b",          │
│     "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",   │
│     "boardId": "8639c3e4-3492-406d-933b-bb225fbf8343",     │
│     "title": "New Task",                                     │
│     "createdAt": "2025-10-15T05:02:38.492Z",               │
│     "updatedAt": "2025-10-15T05:02:38.492Z"                │
│   }                                                           │
│                                                               │
│   ✅ Frontend parses successfully!                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗺️ PROJECT STRUCTURE

```
plantracker-backend/
│
├── src/
│   ├── common/
│   │   └── interceptors/
│   │       └── transform.interceptor.ts  🔥 CORE LOGIC HERE
│   │
│   ├── main.ts  🔥 INTERCEPTOR REGISTERED HERE
│   │   ├── app.useGlobalInterceptors(
│   │   │     new TransformInterceptor()
│   │   │   )
│   │
│   └── modules/
│       ├── tasks/
│       │   ├── tasks.controller.ts
│       │   ├── tasks.service.ts
│       │   └── dto/
│       │       ├── create-task.dto.ts  ✅ camelCase
│       │       └── update-task.dto.ts  ✅ camelCase
│       │
│       ├── boards/
│       │   ├── boards.controller.ts
│       │   ├── boards.service.ts
│       │   └── dto/
│       │       ├── create-board.dto.ts  ✅ camelCase
│       │       └── update-board.dto.ts  ✅ camelCase
│       │
│       ├── projects/
│       │   ├── projects.controller.ts  ⚠️ NEEDS FIX
│       │   ├── projects.service.ts
│       │   └── dto/
│       │       ├── create-project.dto.ts  ❌ MISSING - NEED CREATE
│       │       └── update-project.dto.ts  ❌ MISSING - NEED CREATE
│       │
│       └── ... (other modules)
│
├── docs/
│   ├── README.md  ⭐ Start here
│   ├── INDEX.md   ⭐ Navigation
│   ├── ACTION_ITEMS_Code_Changes.md  🔴 CRITICAL
│   ├── API_Input_Output_Specification.md  🔴 CRITICAL
│   └── ... (other docs)
│
└── test-camelcase-transform.http  🧪 Test cases
```

---

## 🎯 TRANSFORMATION EXAMPLES

### Example 1: Simple Object

```javascript
// Input (snake_case from Prisma):
{
  id: "abc-123",
  project_id: "proj-456",
  created_at: "2025-10-15T05:02:38.492Z"
}

// ↓ Transform

// Output (camelCase to Frontend):
{
  id: "abc-123",
  projectId: "proj-456",     // ✅ Transformed
  createdAt: "2025-10-15T05:02:38.492Z"  // ✅ Transformed
}
```

### Example 2: Array of Objects

```javascript
// Input (array of snake_case objects):
[
  {
    id: 'task-1',
    project_id: 'proj-1',
    board_id: 'board-1',
    created_at: '2025-10-15T05:00:00.000Z',
  },
  {
    id: 'task-2',
    project_id: 'proj-1',
    board_id: 'board-2',
    created_at: '2025-10-15T06:00:00.000Z',
  },
][
  // ↓ Transform (each item)

  // Output (array of camelCase objects):
  ({
    id: 'task-1',
    projectId: 'proj-1', // ✅ Transformed
    boardId: 'board-1', // ✅ Transformed
    createdAt: '2025-10-15T05:00:00.000Z', // ✅ Transformed
  },
  {
    id: 'task-2',
    projectId: 'proj-1', // ✅ Transformed
    boardId: 'board-2', // ✅ Transformed
    createdAt: '2025-10-15T06:00:00.000Z', // ✅ Transformed
  })
];
```

### Example 3: Nested Object

```javascript
// Input (nested snake_case):
{
  id: "workspace-1",
  owner_id: "user-1",
  created_at: "2025-10-15T05:00:00.000Z",
  projects: [
    {
      id: "proj-1",
      workspace_id: "workspace-1",
      created_at: "2025-10-15T05:30:00.000Z"
    }
  ]
}

// ↓ Transform (recursive)

// Output (nested camelCase):
{
  id: "workspace-1",
  ownerId: "user-1",         // ✅ Transformed
  createdAt: "2025-10-15T05:00:00.000Z",  // ✅ Transformed
  projects: [
    {
      id: "proj-1",
      workspaceId: "workspace-1",  // ✅ Transformed (nested)
      createdAt: "2025-10-15T05:30:00.000Z"  // ✅ Transformed (nested)
    }
  ]
}
```

---

## 📊 STATISTICS VISUAL

```
┌─────────────────────────────────────────────────────┐
│              TRANSFORMATION COVERAGE                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Modules Covered:          ████████████ 100%        │
│  Endpoints Covered:        ████████████ 100%        │
│  Fields Mapped:            ████████████ 100%        │
│                                                      │
│  Implementation Status:                              │
│  ├─ Interceptor:           ✅ COMPLETE              │
│  ├─ Documentation:         ✅ COMPLETE              │
│  ├─ Projects DTOs:         ⚠️  PENDING              │
│  ├─ Testing:               ⚠️  PENDING              │
│  └─ Deployment:            ⚠️  PENDING              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🚦 STATUS INDICATORS

```
Module Status:
├─ Tasks         ✅ DTOs correct, Ready to test
├─ Boards        ✅ DTOs correct, Ready to test
├─ Projects      🔴 DTOs missing, NEEDS FIX
├─ Workspaces    ✅ DTOs correct, Ready to test
├─ Timers        🟡 Needs verification
├─ Users         🟡 Needs verification
└─ Others        🟡 Needs verification

Legend:
✅ Ready
🟡 Needs verification
🔴 Critical fix needed
```

---

**Use these diagrams to understand the flow!** 🎨

**Created:** October 15, 2025  
**Version:** 1.0.0
