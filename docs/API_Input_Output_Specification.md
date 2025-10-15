# 📋 BÁO CÁO CHI TIẾT: INPUT/OUTPUT CỦA TẤT CẢ API ENDPOINTS

**Ngày:** 15/10/2025  
**Mục đích:** Cung cấp specification đầy đủ để Backend team chỉnh sửa format camelCase  
**Priority:** 🔴 HIGH  
**Status:** ⚠️ CẦN CHỈNH SỬA

---

## 📌 TỔNG QUAN

### Vấn đề hiện tại:

- ❌ Database sử dụng **snake_case** (project_id, created_at, assignee_id...)
- ❌ API responses hiện tại trả về **snake_case**
- ✅ Frontend/Mobile apps expect **camelCase** (projectId, createdAt, assigneeId...)

### Giải pháp đã triển khai:

- ✅ **TransformInterceptor** đã được tạo trong `src/common/interceptors/transform.interceptor.ts`
- ✅ Đã đăng ký global trong `main.ts`
- ⚠️ **CẦN TEST** tất cả endpoints để verify

---

## 🎯 MAPPING RULES - SNAKE_CASE → CAMELCASE

### Common Fields (áp dụng cho tất cả entities):

| Database (snake_case) | API Response (camelCase) | Type              | Description             |
| --------------------- | ------------------------ | ----------------- | ----------------------- |
| `id`                  | `id`                     | string (UUID)     | Primary key (unchanged) |
| `created_at`          | `createdAt`              | string (ISO 8601) | Timestamp tạo           |
| `updated_at`          | `updatedAt`              | string (ISO 8601) | Timestamp cập nhật      |
| `deleted_at`          | `deletedAt`              | string/null       | Soft delete timestamp   |

### Task-specific Fields:

| Database (snake_case)    | API Response (camelCase) | Type          | Required |
| ------------------------ | ------------------------ | ------------- | -------- |
| `project_id`             | `projectId`              | string (UUID) | ✅ Yes   |
| `board_id`               | `boardId`                | string (UUID) | ✅ Yes   |
| `assignee_id`            | `assigneeId`             | string/null   | ❌ No    |
| `created_by`             | `createdBy`              | string/null   | ❌ No    |
| `due_at`                 | `dueAt`                  | string/null   | ❌ No    |
| `start_at`               | `startAt`                | string/null   | ❌ No    |
| `issue_key`              | `issueKey`               | string/null   | ❌ No    |
| `sprint_id`              | `sprintId`               | string/null   | ❌ No    |
| `epic_id`                | `epicId`                 | string/null   | ❌ No    |
| `parent_task_id`         | `parentTaskId`           | string/null   | ❌ No    |
| `story_points`           | `storyPoints`            | number/null   | ❌ No    |
| `original_estimate_sec`  | `originalEstimateSec`    | number/null   | ❌ No    |
| `remaining_estimate_sec` | `remainingEstimateSec`   | number/null   | ❌ No    |

### Board-specific Fields:

| Database (snake_case) | API Response (camelCase) | Type          | Required |
| --------------------- | ------------------------ | ------------- | -------- |
| `project_id`          | `projectId`              | string (UUID) | ✅ Yes   |

### Project-specific Fields:

| Database (snake_case) | API Response (camelCase) | Type          | Required |
| --------------------- | ------------------------ | ------------- | -------- |
| `workspace_id`        | `workspaceId`            | string (UUID) | ✅ Yes   |
| `owner_id`            | `ownerId`                | string (UUID) | ✅ Yes   |

### Workspace-specific Fields:

| Database (snake_case) | API Response (camelCase) | Type          | Required |
| --------------------- | ------------------------ | ------------- | -------- |
| `owner_id`            | `ownerId`                | string (UUID) | ✅ Yes   |
| `is_personal`         | `isPersonal`             | boolean       | ✅ Yes   |

### Timer (time_entries) Fields:

| Database (snake_case) | API Response (camelCase) | Type              | Required |
| --------------------- | ------------------------ | ----------------- | -------- |
| `task_id`             | `taskId`                 | string (UUID)     | ✅ Yes   |
| `user_id`             | `userId`                 | string (UUID)     | ✅ Yes   |
| `start_at`            | `startAt`                | string (ISO 8601) | ✅ Yes   |
| `end_at`              | `endAt`                  | string/null       | ❌ No    |
| `duration_sec`        | `durationSec`            | number/null       | ❌ No    |

---

## 📡 API ENDPOINTS SPECIFICATION

---

## 1️⃣ TASKS MODULE (`/api/tasks`)

### 1.1. GET `/api/tasks/by-board/:boardId`

**Description:** Lấy danh sách tasks theo boardId  
**Auth:** Required ✅

#### Request:

```http
GET /api/tasks/by-board/8639c3e4-3492-406d-933b-bb225fbf8343
Authorization: Bearer <token>
```

#### ✅ Expected Response (camelCase):

```json
[
  {
    "id": "caf87252-7e4a-4f8c-a150-d56ed3af7a7b",
    "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
    "boardId": "8639c3e4-3492-406d-933b-bb225fbf8343",
    "title": "Task title",
    "description": "Task description",
    "assigneeId": "user-uuid-or-null",
    "createdBy": "user-uuid-or-null",
    "dueAt": "2025-10-20T00:00:00.000Z",
    "startAt": "2025-10-15T00:00:00.000Z",
    "priority": "HIGH",
    "position": "1024.000",
    "issueKey": "PROJ-123",
    "type": "TASK",
    "status": "TO_DO",
    "sprintId": null,
    "epicId": null,
    "parentTaskId": null,
    "storyPoints": 5,
    "originalEstimateSec": 3600,
    "remainingEstimateSec": 1800,
    "createdAt": "2025-10-15T05:02:38.492Z",
    "updatedAt": "2025-10-15T05:02:38.492Z",
    "deletedAt": null
  }
]
```

#### ❌ Current Response (snake_case - INCORRECT):

```json
[
  {
    "id": "...",
    "project_id": "...",  // ❌ Should be projectId
    "board_id": "...",    // ❌ Should be boardId
    "assignee_id": null,  // ❌ Should be assigneeId
    "created_at": "...",  // ❌ Should be createdAt
    ...
  }
]
```

---

### 1.2. GET `/api/tasks/:id`

**Description:** Lấy chi tiết task theo ID  
**Auth:** Required ✅

#### Request:

```http
GET /api/tasks/caf87252-7e4a-4f8c-a150-d56ed3af7a7b
Authorization: Bearer <token>
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "caf87252-7e4a-4f8c-a150-d56ed3af7a7b",
  "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
  "boardId": "8639c3e4-3492-406d-933b-bb225fbf8343",
  "title": "Task title",
  "description": "Task description",
  "assigneeId": null,
  "createdBy": null,
  "dueAt": null,
  "startAt": null,
  "priority": null,
  "position": "1024.000",
  "issueKey": null,
  "type": null,
  "status": "TO_DO",
  "sprintId": null,
  "epicId": null,
  "parentTaskId": null,
  "storyPoints": null,
  "originalEstimateSec": null,
  "remainingEstimateSec": null,
  "createdAt": "2025-10-15T05:02:38.492Z",
  "updatedAt": "2025-10-15T05:02:38.492Z",
  "deletedAt": null
}
```

---

### 1.3. POST `/api/tasks`

**Description:** Tạo task mới  
**Auth:** Required ✅

#### ✅ Request Body (camelCase - Frontend gửi lên):

```json
{
  "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
  "boardId": "8639c3e4-3492-406d-933b-bb225fbf8343",
  "title": "New task title",
  "assigneeId": "user-uuid-optional"
}
```

#### ⚠️ DTO hiện tại:

```typescript
// src/modules/tasks/dto/create-task.dto.ts
export class CreateTaskDto {
  @IsString() @IsNotEmpty() projectId!: string; // ✅ CORRECT
  @IsString() @IsNotEmpty() boardId!: string; // ✅ CORRECT
  @IsString() @IsNotEmpty() title!: string; // ✅ CORRECT
  @IsOptional() @IsString() assigneeId?: string; // ✅ CORRECT
}
```

**Status:** ✅ DTO đã đúng camelCase!

#### ✅ Expected Response (camelCase):

```json
{
  "id": "new-task-uuid",
  "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
  "boardId": "8639c3e4-3492-406d-933b-bb225fbf8343",
  "title": "New task title",
  "description": null,
  "assigneeId": "user-uuid-optional",
  "createdBy": null,
  "dueAt": null,
  "startAt": null,
  "priority": null,
  "position": "1024.000",
  "issueKey": null,
  "type": null,
  "status": "TO_DO",
  "sprintId": null,
  "epicId": null,
  "parentTaskId": null,
  "storyPoints": null,
  "originalEstimateSec": null,
  "remainingEstimateSec": null,
  "createdAt": "2025-10-15T06:30:00.000Z",
  "updatedAt": "2025-10-15T06:30:00.000Z",
  "deletedAt": null
}
```

---

### 1.4. PATCH `/api/tasks/:id`

**Description:** Cập nhật task  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "assigneeId": "new-user-uuid"
}
```

#### ⚠️ DTO hiện tại:

```typescript
// src/modules/tasks/dto/update-task.dto.ts
export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string; // ✅ CORRECT
  @IsOptional() @IsString() description?: string; // ✅ CORRECT
  @IsOptional() @IsString() assigneeId?: string; // ✅ CORRECT
}
```

**Status:** ✅ DTO đã đúng camelCase!

#### ✅ Expected Response (camelCase):

```json
{
  "id": "task-uuid",
  "projectId": "...",
  "boardId": "...",
  "title": "Updated title",
  "description": "Updated description",
  "assigneeId": "new-user-uuid",
  "createdAt": "2025-10-15T05:02:38.492Z",
  "updatedAt": "2025-10-15T06:45:00.000Z",
  "deletedAt": null
}
```

---

### 1.5. POST `/api/tasks/:id/move`

**Description:** Di chuyển task sang board khác  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "toBoardId": "target-board-uuid",
  "beforeId": "task-uuid-optional",
  "afterId": "task-uuid-optional"
}
```

#### ⚠️ Cần check DTO:

```typescript
// src/modules/tasks/dto/move-task.dto.ts
// Cần verify nếu có snake_case fields
```

---

### 1.6. DELETE `/api/tasks/:id`

**Description:** Soft delete task  
**Auth:** Required ✅

#### ✅ Expected Response (camelCase):

```json
{
  "id": "task-uuid",
  "projectId": "...",
  "boardId": "...",
  "title": "Deleted task",
  "deletedAt": "2025-10-15T07:00:00.000Z",
  "createdAt": "2025-10-15T05:02:38.492Z",
  "updatedAt": "2025-10-15T07:00:00.000Z"
}
```

---

## 2️⃣ BOARDS MODULE (`/api/boards`)

### 2.1. GET `/api/boards?projectId={uuid}`

**Description:** Lấy danh sách boards theo projectId  
**Auth:** Required ✅

#### Request:

```http
GET /api/boards?projectId=9f7e4f98-0611-4ad7-9fe3-ced150616ce1
Authorization: Bearer <token>
```

#### ✅ Expected Response (camelCase):

```json
[
  {
    "id": "board-uuid-1",
    "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
    "name": "To Do",
    "order": 1,
    "createdAt": "2025-10-15T05:00:00.000Z",
    "updatedAt": "2025-10-15T05:00:00.000Z"
  },
  {
    "id": "board-uuid-2",
    "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
    "name": "In Progress",
    "order": 2,
    "createdAt": "2025-10-15T05:00:00.000Z",
    "updatedAt": "2025-10-15T05:00:00.000Z"
  }
]
```

---

### 2.2. POST `/api/boards`

**Description:** Tạo board mới  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
  "name": "New Board",
  "order": 3
}
```

#### ⚠️ DTO hiện tại:

```typescript
// src/modules/boards/dto/create-board.dto.ts
export class CreateBoardDto {
  @IsString() @IsNotEmpty() projectId!: string; // ✅ CORRECT
  @IsString() @IsNotEmpty() name!: string; // ✅ CORRECT
  @IsOptional() @IsInt() @Min(1) order?: number; // ✅ CORRECT
}
```

**Status:** ✅ DTO đã đúng camelCase!

#### ✅ Expected Response (camelCase):

```json
{
  "id": "new-board-uuid",
  "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
  "name": "New Board",
  "order": 3,
  "createdAt": "2025-10-15T06:00:00.000Z",
  "updatedAt": "2025-10-15T06:00:00.000Z"
}
```

---

### 2.3. PATCH `/api/boards/:id`

**Description:** Cập nhật board  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "name": "Updated Board Name",
  "order": 5
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "board-uuid",
  "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
  "name": "Updated Board Name",
  "order": 5,
  "createdAt": "2025-10-15T05:00:00.000Z",
  "updatedAt": "2025-10-15T06:30:00.000Z"
}
```

---

### 2.4. DELETE `/api/boards/:id`

**Description:** Xóa board  
**Auth:** Required ✅

#### ✅ Expected Response (camelCase):

```json
{
  "id": "board-uuid",
  "projectId": "9f7e4f98-0611-4ad7-9fe3-ced150616ce1",
  "name": "Deleted Board",
  "order": 1,
  "createdAt": "2025-10-15T05:00:00.000Z",
  "updatedAt": "2025-10-15T07:00:00.000Z"
}
```

---

## 3️⃣ PROJECTS MODULE (`/api/projects`)

### 3.1. GET `/api/projects?workspaceId={uuid}`

**Description:** Lấy danh sách projects theo workspaceId  
**Auth:** Required ✅

#### Request:

```http
GET /api/projects?workspaceId=workspace-uuid
Authorization: Bearer <token>
```

#### ✅ Expected Response (camelCase):

```json
[
  {
    "id": "project-uuid-1",
    "workspaceId": "workspace-uuid",
    "ownerId": "user-uuid",
    "name": "Project A",
    "key": "PRJA",
    "description": "Project description",
    "createdAt": "2025-10-15T05:00:00.000Z",
    "updatedAt": "2025-10-15T05:00:00.000Z"
  }
]
```

---

### 3.2. POST `/api/projects`

**Description:** Tạo project mới  
**Auth:** Required ✅

#### ❌ Request Body hiện tại (snake_case - SAI):

```json
{
  "name": "New Project",
  "workspace_id": "workspace-uuid", // ❌ SAI
  "key": "NEWP",
  "description": "Description"
}
```

#### ✅ Request Body đúng (camelCase - CẦN SỬA):

```json
{
  "name": "New Project",
  "workspaceId": "workspace-uuid", // ✅ ĐÚNG
  "key": "NEWP",
  "description": "Description"
}
```

#### ⚠️ Controller hiện tại (SAI):

```typescript
// src/modules/projects/projects.controller.ts
@Post()
create(
  @Body()
  body: {
    name: string;
    workspace_id: string;  // ❌ SAI - cần đổi thành workspaceId
    key?: string;
    description?: string;
  },
) {
  return this.svc.create(body);
}
```

#### 🔧 Cần tạo DTO:

```typescript
// src/modules/projects/dto/create-project.dto.ts (CẦN TẠO)
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() workspaceId!: string; // ✅ camelCase
  @IsOptional() @IsString() key?: string;
  @IsOptional() @IsString() description?: string;
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "new-project-uuid",
  "workspaceId": "workspace-uuid",
  "ownerId": "user-uuid",
  "name": "New Project",
  "key": "NEWP",
  "description": "Description",
  "createdAt": "2025-10-15T06:00:00.000Z",
  "updatedAt": "2025-10-15T06:00:00.000Z"
}
```

---

### 3.3. PATCH `/api/projects/:id`

**Description:** Cập nhật project  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "name": "Updated Project Name",
  "key": "UPD",
  "description": "Updated description"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "project-uuid",
  "workspaceId": "workspace-uuid",
  "ownerId": "user-uuid",
  "name": "Updated Project Name",
  "key": "UPD",
  "description": "Updated description",
  "createdAt": "2025-10-15T05:00:00.000Z",
  "updatedAt": "2025-10-15T06:30:00.000Z"
}
```

---

## 4️⃣ WORKSPACES MODULE (`/api/workspaces`)

### 4.1. GET `/api/workspaces`

**Description:** Lấy danh sách workspaces của user  
**Auth:** Required ✅

#### Request:

```http
GET /api/workspaces
Authorization: Bearer <token>
```

#### ✅ Expected Response (camelCase):

```json
[
  {
    "id": "workspace-uuid-1",
    "ownerId": "user-uuid",
    "name": "My Workspace",
    "isPersonal": false,
    "createdAt": "2025-10-15T05:00:00.000Z",
    "updatedAt": "2025-10-15T05:00:00.000Z"
  },
  {
    "id": "workspace-uuid-2",
    "ownerId": "user-uuid",
    "name": "Personal Workspace",
    "isPersonal": true,
    "createdAt": "2025-10-15T05:00:00.000Z",
    "updatedAt": "2025-10-15T05:00:00.000Z"
  }
]
```

---

### 4.2. GET `/api/workspaces/:id`

**Description:** Lấy chi tiết workspace  
**Auth:** Required ✅

#### ✅ Expected Response (camelCase):

```json
{
  "id": "workspace-uuid",
  "ownerId": "user-uuid",
  "name": "My Workspace",
  "isPersonal": false,
  "createdAt": "2025-10-15T05:00:00.000Z",
  "updatedAt": "2025-10-15T05:00:00.000Z"
}
```

---

### 4.3. POST `/api/workspaces`

**Description:** Tạo workspace mới  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "name": "New Workspace"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "new-workspace-uuid",
  "ownerId": "user-uuid",
  "name": "New Workspace",
  "isPersonal": false,
  "createdAt": "2025-10-15T06:00:00.000Z",
  "updatedAt": "2025-10-15T06:00:00.000Z"
}
```

---

### 4.4. PATCH `/api/workspaces/:id`

**Description:** Cập nhật workspace  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "name": "Updated Workspace Name"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "workspace-uuid",
  "ownerId": "user-uuid",
  "name": "Updated Workspace Name",
  "isPersonal": false,
  "createdAt": "2025-10-15T05:00:00.000Z",
  "updatedAt": "2025-10-15T06:30:00.000Z"
}
```

---

### 4.5. DELETE `/api/workspaces/:id`

**Description:** Xóa workspace  
**Auth:** Required ✅

#### ✅ Expected Response (camelCase):

```json
{
  "id": "workspace-uuid",
  "ownerId": "user-uuid",
  "name": "Deleted Workspace",
  "isPersonal": false,
  "createdAt": "2025-10-15T05:00:00.000Z",
  "updatedAt": "2025-10-15T07:00:00.000Z"
}
```

---

### 4.6. GET `/api/workspaces/:id/members`

**Description:** Lấy danh sách members của workspace  
**Auth:** Required ✅

#### ✅ Expected Response (camelCase):

```json
[
  {
    "id": "membership-uuid-1",
    "userId": "user-uuid-1",
    "workspaceId": "workspace-uuid",
    "role": "OWNER",
    "createdAt": "2025-10-15T05:00:00.000Z"
  },
  {
    "id": "membership-uuid-2",
    "userId": "user-uuid-2",
    "workspaceId": "workspace-uuid",
    "role": "MEMBER",
    "createdAt": "2025-10-15T05:30:00.000Z"
  }
]
```

---

### 4.7. POST `/api/workspaces/:id/members`

**Description:** Thêm member vào workspace  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "userId": "user-uuid-to-add",
  "role": "MEMBER"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "new-membership-uuid",
  "userId": "user-uuid-to-add",
  "workspaceId": "workspace-uuid",
  "role": "MEMBER",
  "createdAt": "2025-10-15T06:00:00.000Z"
}
```

---

## 5️⃣ TIMERS MODULE (`/api/timers`)

### 5.1. POST `/api/timers/start`

**Description:** Bắt đầu timer cho task  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "taskId": "task-uuid"
}
```

#### ⚠️ Cần check DTO:

```typescript
// src/modules/timers/dto/create-timer.dto.ts
// Verify fields are camelCase: taskId (not task_id)
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "timer-uuid",
  "taskId": "task-uuid",
  "userId": "user-uuid",
  "startAt": "2025-10-15T06:00:00.000Z",
  "endAt": null,
  "durationSec": null,
  "note": null,
  "createdAt": "2025-10-15T06:00:00.000Z"
}
```

---

### 5.2. PATCH `/api/timers/:timerId/stop`

**Description:** Dừng timer  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "note": "Completed the task"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "timer-uuid",
  "taskId": "task-uuid",
  "userId": "user-uuid",
  "startAt": "2025-10-15T06:00:00.000Z",
  "endAt": "2025-10-15T07:30:00.000Z",
  "durationSec": 5400,
  "note": "Completed the task",
  "createdAt": "2025-10-15T06:00:00.000Z"
}
```

---

### 5.3. PATCH `/api/timers/:timerId/note`

**Description:** Cập nhật note của timer  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "note": "Updated note"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "timer-uuid",
  "taskId": "task-uuid",
  "userId": "user-uuid",
  "startAt": "2025-10-15T06:00:00.000Z",
  "endAt": null,
  "durationSec": null,
  "note": "Updated note",
  "createdAt": "2025-10-15T06:00:00.000Z"
}
```

---

## 6️⃣ USERS MODULE (`/api/users`)

### 6.1. POST `/api/users/local/signup`

**Description:** Đăng ký tài khoản local  
**Auth:** Public ❌

#### ✅ Request Body (camelCase):

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "displayName": "John Doe"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "user": {
    "id": "new-user-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "photoUrl": null,
    "createdAt": "2025-10-15T06:00:00.000Z",
    "updatedAt": "2025-10-15T06:00:00.000Z"
  },
  "token": "jwt-token-string"
}
```

---

### 6.2. POST `/api/users/local/signin`

**Description:** Đăng nhập local  
**Auth:** Public ❌

#### ✅ Request Body (camelCase):

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "photoUrl": null,
    "createdAt": "2025-10-15T05:00:00.000Z",
    "updatedAt": "2025-10-15T05:00:00.000Z"
  },
  "token": "jwt-token-string"
}
```

---

### 6.3. POST `/api/users/firebase/auth`

**Description:** Xác thực Firebase (Google Sign-In)  
**Auth:** Public ❌

#### ✅ Request Body (camelCase):

```json
{
  "idToken": "firebase-id-token"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "user": {
    "id": "user-uuid",
    "firebaseUid": "firebase-uid",
    "email": "user@gmail.com",
    "displayName": "John Doe",
    "photoUrl": "https://lh3.googleusercontent.com/...",
    "createdAt": "2025-10-15T05:00:00.000Z",
    "updatedAt": "2025-10-15T06:00:00.000Z"
  },
  "token": "jwt-token-string"
}
```

---

### 6.4. GET `/api/users/me`

**Description:** Lấy thông tin user hiện tại  
**Auth:** Required ✅

#### ✅ Expected Response (camelCase):

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "photoUrl": "https://example.com/photo.jpg",
  "firebaseUid": "firebase-uid-or-null",
  "createdAt": "2025-10-15T05:00:00.000Z",
  "updatedAt": "2025-10-15T06:00:00.000Z"
}
```

---

### 6.5. PUT `/api/users/me`

**Description:** Cập nhật profile user  
**Auth:** Required ✅

#### ✅ Request Body (camelCase):

```json
{
  "displayName": "Updated Name",
  "photoUrl": "https://example.com/new-photo.jpg"
}
```

#### ✅ Expected Response (camelCase):

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "displayName": "Updated Name",
  "photoUrl": "https://example.com/new-photo.jpg",
  "firebaseUid": null,
  "createdAt": "2025-10-15T05:00:00.000Z",
  "updatedAt": "2025-10-15T06:30:00.000Z"
}
```

---

## 📝 CHECKLIST CHO BACKEND TEAM

### ✅ Đã hoàn thành:

- [x] Tạo TransformInterceptor
- [x] Đăng ký global interceptor trong main.ts
- [x] DTOs cho Tasks đã đúng camelCase
- [x] DTOs cho Boards đã đúng camelCase

### ⚠️ Cần kiểm tra:

- [ ] Test tất cả endpoints với interceptor
- [ ] Verify nested objects (relations) cũng transform đúng
- [ ] Check arrays of objects
- [ ] Verify null values không bị lỗi

### 🔧 Cần sửa:

- [ ] **Projects Controller:** Sửa `workspace_id` → `workspaceId` trong request body
- [ ] **Projects:** Tạo CreateProjectDto với camelCase
- [ ] **Timers:** Verify DTOs đã đúng camelCase
- [ ] **All DTOs:** Review lại tất cả DTOs để đảm bảo camelCase

---

## 🧪 TEST SCRIPT

### PowerShell Test Commands:

```powershell
# Set base URL and token
$baseUrl = "http://localhost:3000/api"
$token = "YOUR_AUTH_TOKEN"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Test 1: Create Task (verify request & response camelCase)
$createTaskBody = @{
    projectId = "9f7e4f98-0611-4ad7-9fe3-ced150616ce1"
    boardId = "8639c3e4-3492-406d-933b-bb225fbf8343"
    title = "Test CamelCase Task"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$baseUrl/tasks" -Method POST -Headers $headers -Body $createTaskBody
$response | ConvertTo-Json -Depth 10

# Expected: All fields in camelCase (projectId, boardId, createdAt, etc.)

# Test 2: Get Tasks (verify response camelCase)
$response = Invoke-RestMethod -Uri "$baseUrl/tasks/by-board/8639c3e4-3492-406d-933b-bb225fbf8343" -Method GET -Headers $headers
$response | ConvertTo-Json -Depth 10

# Expected: Array with camelCase fields

# Test 3: Get Workspaces (verify response camelCase)
$response = Invoke-RestMethod -Uri "$baseUrl/workspaces" -Method GET -Headers $headers
$response | ConvertTo-Json -Depth 10

# Expected: Array with fields like ownerId, isPersonal, createdAt, updatedAt
```

---

## 🎯 VALIDATION CHECKLIST

Sau khi start server với TransformInterceptor, check các điểm sau:

### ✅ Response Checks:

- [ ] Tất cả `_` (underscore) đã biến thành camelCase
- [ ] `project_id` → `projectId`
- [ ] `created_at` → `createdAt`
- [ ] `updated_at` → `updatedAt`
- [ ] `assignee_id` → `assigneeId`
- [ ] `due_at` → `dueAt`
- [ ] `start_at` → `startAt`
- [ ] `workspace_id` → `workspaceId`
- [ ] `owner_id` → `ownerId`
- [ ] `is_personal` → `isPersonal`

### ✅ Request Body Checks:

- [ ] Frontend có thể gửi camelCase và backend accept
- [ ] Validation decorators (@IsString, @IsNotEmpty) vẫn work
- [ ] Optional fields vẫn optional

### ✅ Edge Cases:

- [ ] Arrays of objects: tất cả items đều camelCase
- [ ] Nested objects: deep transform work
- [ ] Null values: không bị lỗi
- [ ] Date objects: format đúng ISO 8601
- [ ] Numbers: không bị convert sai

---

## 📞 SUPPORT

**Nếu gặp vấn đề:**

1. **Check server logs:** Có error nào không?
2. **Verify interceptor:** Log message "✅ All API responses transformed to camelCase" có hiện không?
3. **Test với curl/Postman:** Copy exact request từ examples trên
4. **Check DTO validation:** Có field nào bị reject không?

**Files quan trọng:**

- `src/common/interceptors/transform.interceptor.ts` - Transform logic
- `src/main.ts` - Global interceptor registration
- `src/modules/*/dto/*.dto.ts` - DTOs cần review

---

**Tạo bởi:** AI Assistant  
**Ngày:** October 15, 2025  
**Version:** 1.0.0  
**Priority:** 🔴 HIGH - Cần test và verify ngay
