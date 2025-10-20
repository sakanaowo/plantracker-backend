# 🚀 Quick Task Creation - Implementation Guide

## 📋 Tổng Quan

Endpoint tạo task nhanh cho phép người dùng tạo task ngay lập tức **không cần chỉ định project hay board**. Task sẽ tự động được tạo vào:
- **Default Project**: Project đầu tiên của user (theo thời gian tạo)
- **TODO Board**: Board có tên "To Do" / "TODO" / "Todo"
- **Auto-assign**: Tự động assign cho người tạo

---

## 🎯 Use Case

### Scenario
User đang làm việc trên mobile/desktop và muốn nhanh chóng tạo một task mới mà không cần phải:
1. Chọn workspace
2. Chọn project
3. Chọ board
4. Chọn assignee

### Solution
```http
POST /tasks/quick
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread" // optional
}
```

---

## 🏗️ Architecture

### 1. DTO Layer

**File**: `src/modules/tasks/dto/create-quick-task.dto.ts`

```typescript
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateQuickTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

**Validation Rules:**
- ✅ `title`: Required, non-empty string
- ✅ `description`: Optional string

---

### 2. Service Layer

**File**: `src/modules/tasks/tasks.service.ts`

**Method**: `createQuickTask(userId: string, dto: CreateQuickTaskDto)`

#### Logic Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Find Personal Workspace                                  │
│    Query: workspaces WHERE owner_id = userId AND type = PERSONAL│
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Find Default Project (First Project)                     │
│    Query: projects WHERE workspace_id = workspaceId         │
│           ORDER BY created_at ASC LIMIT 1                   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Find TODO Board                                          │
│    Primary: boards WHERE project_id = projectId             │
│             AND name IN ['To Do', 'TODO', 'Todo', 'to do']  │
│    Fallback: First board (ORDER BY order ASC)               │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Calculate Position                                       │
│    Find: last task in board (ORDER BY position DESC)        │
│    Position: lastPosition + 1024 (or 1024 if no tasks)     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Create Task                                              │
│    - project_id: Default project                           │
│    - board_id: TODO board                                   │
│    - assignee_id: Current user                             │
│    - created_by: Current user                              │
│    - position: Calculated position                         │
└─────────────────────────────────────────────────────────────┘
```

#### Implementation

```typescript
async createQuickTask(
  userId: string,
  dto: { title: string; description?: string },
): Promise<tasks> {
  // Step 1: Find personal workspace
  const workspace = await this.prisma.workspaces.findFirst({
    where: { owner_id: userId, type: 'PERSONAL' },
    select: { id: true },
  });

  if (!workspace) {
    throw new NotFoundException(
      'Personal workspace not found. Please create a workspace first.',
    );
  }

  // Step 2: Find default project (first project)
  const defaultProject = await this.prisma.projects.findFirst({
    where: { workspace_id: workspace.id },
    orderBy: { created_at: 'asc' },
    select: { id: true, name: true },
  });

  if (!defaultProject) {
    throw new NotFoundException(
      'No projects found in your workspace. Please create a project first.',
    );
  }

  // Step 3: Find TODO board (with fallback)
  const todoBoard = await this.prisma.boards.findFirst({
    where: {
      project_id: defaultProject.id,
      name: { in: ['To Do', 'TODO', 'Todo', 'to do'] },
    },
    select: { id: true },
  });

  const targetBoard = todoBoard || 
    await this.prisma.boards.findFirst({
      where: { project_id: defaultProject.id },
      orderBy: { order: 'asc' },
      select: { id: true },
    });

  if (!targetBoard) {
    throw new NotFoundException(
      `No boards found in project "${defaultProject.name}".`,
    );
  }

  // Step 4: Calculate position
  const lastTask = await this.prisma.tasks.findFirst({
    where: { board_id: targetBoard.id, deleted_at: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const nextPosition = lastTask?.position
    ? new Prisma.Decimal(lastTask.position).plus(1024)
    : new Prisma.Decimal(1024);

  // Step 5: Create task
  return this.prisma.tasks.create({
    data: {
      project_id: defaultProject.id,
      board_id: targetBoard.id,
      title: dto.title,
      description: dto.description ?? null,
      assignee_id: userId,
      created_by: userId,
      position: nextPosition,
    },
  });
}
```

---

### 3. Controller Layer

**File**: `src/modules/tasks/tasks.controller.ts`

**Endpoint**: `POST /tasks/quick`

```typescript
@Post('quick')
createQuick(
  @Body() dto: CreateQuickTaskDto,
  @CurrentUser('id') userId: string,
): Promise<tasks> {
  return this.svc.createQuickTask(userId, dto);
}
```

**Features:**
- ✅ Uses `@CurrentUser` decorator to extract authenticated user ID
- ✅ Validates DTO with class-validator
- ✅ Returns created task object

---

## 📊 Database Queries

### Query 1: Find Personal Workspace
```sql
SELECT id
FROM workspaces
WHERE owner_id = $1 
  AND type = 'PERSONAL'
LIMIT 1;
```

### Query 2: Find Default Project
```sql
SELECT id, name
FROM projects
WHERE workspace_id = $1
ORDER BY created_at ASC
LIMIT 1;
```

### Query 3: Find TODO Board
```sql
-- Primary query
SELECT id
FROM boards
WHERE project_id = $1
  AND name IN ('To Do', 'TODO', 'Todo', 'to do')
LIMIT 1;

-- Fallback query (if no TODO board found)
SELECT id
FROM boards
WHERE project_id = $1
ORDER BY "order" ASC
LIMIT 1;
```

### Query 4: Find Last Task Position
```sql
SELECT position
FROM tasks
WHERE board_id = $1
  AND deleted_at IS NULL
ORDER BY position DESC
LIMIT 1;
```

### Query 5: Create Task
```sql
INSERT INTO tasks (
  id, project_id, board_id, title, description,
  assignee_id, created_by, position, created_at, updated_at
) VALUES (
  uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
) RETURNING *;
```

---

## 🧪 Test Cases

### Test Case 1: Successful Quick Task Creation

**Given:**
- User is authenticated
- User has personal workspace
- Workspace has at least one project
- Project has "To Do" board

**Request:**
```http
POST /tasks/quick
{
  "title": "Buy groceries"
}
```

**Expected Response:** `201 Created`
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "board_id": "uuid",
  "title": "Buy groceries",
  "description": null,
  "assignee_id": "user-uuid",
  "created_by": "user-uuid",
  "position": "1024",
  "created_at": "2025-10-20T...",
  "updated_at": "2025-10-20T...",
  "deleted_at": null
}
```

---

### Test Case 2: User Has No Personal Workspace

**Given:**
- User is authenticated
- User has NO personal workspace

**Request:**
```http
POST /tasks/quick
{
  "title": "Test task"
}
```

**Expected Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "Personal workspace not found. Please create a workspace first.",
  "error": "Not Found"
}
```

---

### Test Case 3: User Has No Projects

**Given:**
- User is authenticated
- User has personal workspace
- Workspace has NO projects

**Request:**
```http
POST /tasks/quick
{
  "title": "Test task"
}
```

**Expected Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "No projects found in your workspace. Please create a project first.",
  "error": "Not Found"
}
```

---

### Test Case 4: Project Has No Boards

**Given:**
- User is authenticated
- User has personal workspace and project
- Project has NO boards

**Request:**
```http
POST /tasks/quick
{
  "title": "Test task"
}
```

**Expected Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "No boards found in project \"My First Project\". Please create a board first.",
  "error": "Not Found"
}
```

---

### Test Case 5: No TODO Board (Fallback to First Board)

**Given:**
- User is authenticated
- User has personal workspace and project
- Project has boards but NO board named "To Do" / "TODO"
- First board is "Backlog" (order: 1)

**Request:**
```http
POST /tasks/quick
{
  "title": "Test task"
}
```

**Expected Response:** `201 Created`
- Task is created in "Backlog" board (first board by order)

---

### Test Case 6: Multiple Projects (Uses First Project)

**Given:**
- User has 3 projects:
  1. "My First Project" (created: 2025-01-01)
  2. "Work Project" (created: 2025-02-01)
  3. "Side Project" (created: 2025-03-01)

**Request:**
```http
POST /tasks/quick
{
  "title": "Test task"
}
```

**Expected Behavior:**
- Task is created in "My First Project" (earliest created_at)

---

### Test Case 7: Task with Description

**Given:**
- All conditions satisfied

**Request:**
```http
POST /tasks/quick
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread, butter"
}
```

**Expected Response:** `201 Created`
```json
{
  "id": "uuid",
  "title": "Buy groceries",
  "description": "Milk, eggs, bread, butter",
  ...
}
```

---

### Test Case 8: Validation Error (Empty Title)

**Request:**
```http
POST /tasks/quick
{
  "title": ""
}
```

**Expected Response:** `400 Bad Request`
```json
{
  "statusCode": 400,
  "message": ["title should not be empty"],
  "error": "Bad Request"
}
```

---

### Test Case 9: Validation Error (Missing Title)

**Request:**
```http
POST /tasks/quick
{
  "description": "Some description"
}
```

**Expected Response:** `400 Bad Request`
```json
{
  "statusCode": 400,
  "message": [
    "title should not be empty",
    "title must be a string"
  ],
  "error": "Bad Request"
}
```

---

### Test Case 10: Unauthenticated User

**Request:**
```http
POST /tasks/quick
Authorization: (missing or invalid)

{
  "title": "Test task"
}
```

**Expected Response:** `401 Unauthorized`
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## 🔧 Integration with Existing System

### 1. Works with Default Project Logic

Quick task creation **leverages** the existing default project creation logic:

```
User Registration
    ↓
Create Personal Workspace
    ↓
Create Default Project ("My First Project")
    ↓
Create 3 Boards (To Do, In Progress, Done)
    ↓
✅ Quick Task → Automatically uses "My First Project" + "To Do" board
```

### 2. Auto-Assignment

Tasks are automatically assigned to the creator:
```typescript
assignee_id: userId,  // Current user
created_by: userId,   // Current user
```

### 3. Position Management

Uses the same position calculation as regular task creation:
- New task position = Last task position + 1024
- First task position = 1024

---

## 📈 Performance Considerations

### Query Optimization

1. **Workspace Query**: Indexed by `owner_id` + `type`
2. **Project Query**: Indexed by `workspace_id` + `created_at`
3. **Board Query**: Indexed by `project_id` + `name`
4. **Task Position Query**: Indexed by `board_id` + `position`

### Database Indexes (Recommended)

```sql
-- For quick task queries
CREATE INDEX idx_workspaces_owner_type ON workspaces(owner_id, type);
CREATE INDEX idx_projects_workspace_created ON projects(workspace_id, created_at);
CREATE INDEX idx_boards_project_name ON boards(project_id, name);

-- Existing indexes
-- idx_tasks_board_position (already exists)
```

### Expected Performance

- **Average Response Time**: 50-100ms
- **Database Queries**: 5 queries (can be optimized to 4 with joins)
- **Bottleneck**: Board name search (can use index)

---

## 🚨 Error Handling

### Possible Errors

| Error Code | Error Message | Cause | Solution |
|------------|---------------|-------|----------|
| 401 | Unauthorized | No/invalid auth token | Login again |
| 404 | Personal workspace not found | User has no workspace | Create workspace first |
| 404 | No projects found | User has no projects | System should auto-create default project |
| 404 | No boards found | Project has no boards | System should auto-create default boards |
| 400 | Validation error | Invalid DTO | Fix request body |
| 500 | Internal server error | Database error | Check logs |

---

## 🔄 Comparison with Regular Task Creation

| Feature | Regular Task Creation | Quick Task Creation |
|---------|----------------------|---------------------|
| **Endpoint** | `POST /tasks` | `POST /tasks/quick` |
| **Required Fields** | `title`, `projectId`, `boardId` | `title` only |
| **Optional Fields** | `assigneeId`, `description` | `description` |
| **Target Project** | User-specified | Auto (first project) |
| **Target Board** | User-specified | Auto (TODO board) |
| **Assignee** | User-specified or null | Auto (current user) |
| **Use Case** | Full control | Fast creation |

---

## 📱 Frontend Integration Examples

### React/TypeScript

```typescript
interface QuickTaskDto {
  title: string;
  description?: string;
}

async function createQuickTask(dto: QuickTaskDto): Promise<Task> {
  const response = await fetch('/api/tasks/quick', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    throw new Error('Failed to create quick task');
  }

  return response.json();
}

// Usage
const task = await createQuickTask({
  title: 'Buy groceries',
  description: 'Milk, eggs, bread',
});
```

### Flutter/Dart

```dart
class QuickTaskDto {
  final String title;
  final String? description;

  QuickTaskDto({required this.title, this.description});

  Map<String, dynamic> toJson() => {
    'title': title,
    if (description != null) 'description': description,
  };
}

Future<Task> createQuickTask(QuickTaskDto dto) async {
  final response = await http.post(
    Uri.parse('$apiUrl/tasks/quick'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${await getAuthToken()}',
    },
    body: jsonEncode(dto.toJson()),
  );

  if (response.statusCode != 201) {
    throw Exception('Failed to create quick task');
  }

  return Task.fromJson(jsonDecode(response.body));
}

// Usage
final task = await createQuickTask(
  QuickTaskDto(
    title: 'Buy groceries',
    description: 'Milk, eggs, bread',
  ),
);
```

---

## 🎨 UI/UX Suggestions

### Mobile App

1. **Floating Action Button (FAB)**
   - Position: Bottom-right corner
   - Icon: "+" or "Add"
   - Action: Open quick task dialog

2. **Quick Task Dialog**
   - Single input field for title (required)
   - Expandable textarea for description (optional)
   - "Create" button
   - Auto-dismiss on success

### Desktop/Web

1. **Global Shortcut**
   - Shortcut: `Ctrl + N` or `Cmd + N`
   - Opens quick task modal

2. **Header Quick Add**
   - Input field in header/navbar
   - "Press Enter to create quick task"

---

## 🔐 Security Considerations

### 1. Authentication

- ✅ Endpoint requires authentication via `@CurrentUser` decorator
- ✅ UserId is extracted from JWT token (not from request body)
- ✅ Cannot create tasks for other users

### 2. Authorization

- ✅ Only accesses user's own personal workspace
- ✅ Cannot access other users' projects
- ✅ Auto-assigns task to creator (no privilege escalation)

### 3. Input Validation

- ✅ DTO validation via class-validator
- ✅ Title is required and non-empty
- ✅ Description is optional
- ✅ No SQL injection (Prisma ORM)

---

## 📊 Monitoring & Logging

### Metrics to Track

1. **Usage Metrics**
   - Quick task creation count per day/week
   - Quick task vs regular task creation ratio
   - Average response time

2. **Error Metrics**
   - 404 errors (no workspace/project/board)
   - 400 errors (validation failures)
   - 500 errors (server errors)

### Logging Examples

```typescript
// Success
logger.info('Quick task created', {
  userId,
  taskId: task.id,
  projectId: task.project_id,
  boardId: task.board_id,
});

// Error
logger.error('Quick task creation failed', {
  userId,
  error: error.message,
  stack: error.stack,
});
```

---

## 🔮 Future Enhancements

### 1. Custom Default Board Preference

Allow users to set preferred default board:

```typescript
// User settings table
interface UserSettings {
  user_id: string;
  default_board_id?: string;  // Override TODO board lookup
}
```

### 2. Voice/Siri Integration

Enable voice commands:
- "Hey Siri, add task: Buy groceries"
- Maps to quick task creation

### 3. Email-to-Task

Send email to `quicktask@yourdomain.com`:
- Subject → Title
- Body → Description

### 4. Batch Quick Task Creation

```http
POST /tasks/quick/batch
{
  "tasks": [
    { "title": "Task 1" },
    { "title": "Task 2" },
    { "title": "Task 3" }
  ]
}
```

### 5. Smart Board Selection

Use ML to predict best board based on:
- Task title content
- User's historical patterns
- Time of day

---

## ✅ Checklist Before Deployment

- [ ] DTO validation tested
- [ ] Service method tested
- [ ] Controller endpoint tested
- [ ] Error scenarios tested
- [ ] Authentication tested
- [ ] Database indexes created
- [ ] API documentation updated
- [ ] Frontend integration tested
- [ ] Performance benchmarked
- [ ] Monitoring/logging configured
- [ ] Security review completed

---

## 📚 Related Documentation

- [Default Project Logic](./default-project-logic.md)
- [API Endpoints](./api-endpoints.md)
- [Authentication Guide](./Auth_Integration_Guide.md)

---

## 📝 Summary

**Quick Task Creation** endpoint cho phép users tạo tasks nhanh chóng mà không cần chỉ định project hay board:

✅ **Endpoint**: `POST /tasks/quick`  
✅ **Input**: Chỉ cần `title` (+ optional `description`)  
✅ **Logic**: Tự động tìm default project → TODO board → Tạo task  
✅ **Auto-assign**: Task tự động assign cho user hiện tại  
✅ **Error Handling**: Clear error messages cho các edge cases  
✅ **Performance**: Optimized queries với proper indexes  
✅ **Security**: Authenticated endpoint, no privilege escalation  

**Perfect for mobile/desktop quick actions!** 🚀
