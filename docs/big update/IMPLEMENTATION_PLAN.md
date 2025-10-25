# Implementation Plan - Core Features
> **Project:** PlanTracker Backend
> **Date:** October 25, 2025
> **Status:** Planning Phase

## 📋 Overview

Plan triển khai các tính năng còn thiếu cho PlanTracker Backend:

1. **Comments API** - Quản lý comment trên task
2. **Attachments API** - Upload/quản lý file đính kèm (sử dụng Supabase như Storage)
3. **Activity Logs Trigger** - Tự động ghi log các hành động
4. **Project Members/Invite** - Mời người vào project & chuyển project type
5. **Labels API** - Quản lý labels cho task trong project

---

## 1️⃣ Comments API

### 1.1 Database Schema
✅ **Đã có sẵn:** Table `task_comments` với schema:
```prisma
model task_comments {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  task_id    String   @db.Uuid
  user_id    String   @db.Uuid
  body       String
  created_at DateTime @default(now()) @db.Timestamptz(6)
  tasks      tasks    @relation(...)
  users      users    @relation(...)
  
  @@index([task_id, created_at])
}
```

### 1.2 Module Structure
```
src/modules/comments/
├── comments.module.ts
├── comments.controller.ts
├── comments.service.ts
└── dto/
    ├── create-comment.dto.ts  // ✅ Đã có trong tasks/dto
    ├── update-comment.dto.ts  // ✅ Đã có trong tasks/dto
    └── comment-response.dto.ts
```

### 1.3 API Endpoints

#### POST `/api/tasks/:taskId/comments`
**Tạo comment mới**

```typescript
// Request Body
{
  "body": "This is a comment with @mention"
}

// Response
{
  "id": "uuid",
  "taskId": "uuid",
  "userId": "uuid",
  "body": "This is a comment with @mention",
  "createdAt": "2025-10-25T10:00:00Z",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "avatarUrl": "https://..."
  }
}
```

**Flow:**
1. Validate user có quyền truy cập task không (cùng workspace/project)
2. Create comment trong DB
3. **Trigger Activity Log:** `COMMENTED` action
4. **Parse @mentions** từ body text
5. **Send notifications** cho users được mention
6. Return comment với user info

---

#### GET `/api/tasks/:taskId/comments`
**Lấy danh sách comments của task**

```typescript
// Query params
?limit=20&cursor=<comment_id>&sort=asc

// Response
{
  "data": [
    {
      "id": "uuid",
      "taskId": "uuid",
      "userId": "uuid",
      "body": "Comment content",
      "createdAt": "2025-10-25T10:00:00Z",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "avatarUrl": "https://..."
      }
    }
  ],
  "pagination": {
    "nextCursor": "uuid | null",
    "hasMore": true
  }
}
```

**Features:**
- Pagination với cursor-based
- Default sort: newest first (desc)
- Include user info (name, avatar)
- Optional: include edited status

---

#### PATCH `/api/comments/:commentId`
**Cập nhật comment**

```typescript
// Request Body
{
  "body": "Updated comment text"
}

// Response
{
  "id": "uuid",
  "body": "Updated comment text",
  "updatedAt": "2025-10-25T11:00:00Z"
}
```

**Flow:**
1. Check ownership (only author can edit)
2. Update comment
3. **Trigger Activity Log:** `UPDATED` với old/new value
4. Return updated comment

---

#### DELETE `/api/comments/:commentId`
**Xóa comment**

```typescript
// Response
{
  "success": true,
  "deletedId": "uuid"
}
```

**Flow:**
1. Check ownership hoặc admin role
2. Hard delete từ DB (hoặc soft delete nếu muốn)
3. **Trigger Activity Log:** `DELETED`
4. Return success

---

### 1.4 CommentsService Implementation

```typescript
// src/modules/comments/comments.service.ts

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private activityLogsService: ActivityLogsService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateCommentDto, userId: string) {
    // 1. Validate task exists & user has access
    const task = await this.validateTaskAccess(dto.taskId, userId);
    
    // 2. Create comment
    const comment = await this.prisma.task_comments.create({
      data: {
        task_id: dto.taskId,
        user_id: userId,
        body: dto.body,
      },
      include: {
        users: {
          select: { id: true, name: true, avatar_url: true }
        }
      }
    });

    // 3. Log activity
    await this.activityLogsService.logCommentCreated({
      taskId: dto.taskId,
      commentId: comment.id,
      userId,
      workspaceId: task.projects.workspace_id,
      projectId: task.project_id,
      boardId: task.board_id,
      metadata: { commentBody: dto.body.substring(0, 100) }
    });

    // 4. Parse mentions & send notifications
    const mentions = this.parseMentions(dto.body);
    if (mentions.length > 0) {
      await this.notifyMentionedUsers({
        taskId: dto.taskId,
        taskTitle: task.title,
        commentBody: dto.body,
        mentionedUserIds: mentions,
        commentAuthor: userId,
      });
    }

    return comment;
  }

  async listByTask(taskId: string, options: {
    limit?: number;
    cursor?: string;
    sort?: 'asc' | 'desc';
  }) {
    const limit = options.limit ?? 20;
    const sort = options.sort ?? 'desc';

    const comments = await this.prisma.task_comments.findMany({
      where: {
        task_id: taskId,
        ...(options.cursor && {
          created_at: sort === 'desc' 
            ? { lt: await this.getCursorDate(options.cursor) }
            : { gt: await this.getCursorDate(options.cursor) }
        })
      },
      include: {
        users: {
          select: { id: true, name: true, avatar_url: true }
        }
      },
      orderBy: { created_at: sort },
      take: limit + 1,
    });

    const hasMore = comments.length > limit;
    const data = hasMore ? comments.slice(0, -1) : comments;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, pagination: { nextCursor, hasMore } };
  }

  async update(commentId: string, userId: string, body: string) {
    // 1. Get old comment
    const oldComment = await this.prisma.task_comments.findUnique({
      where: { id: commentId },
      include: { tasks: true }
    });

    if (!oldComment) throw new NotFoundException('Comment not found');
    if (oldComment.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    // 2. Update
    const updated = await this.prisma.task_comments.update({
      where: { id: commentId },
      data: { body },
    });

    // 3. Log activity
    await this.activityLogsService.logCommentUpdated({
      taskId: oldComment.task_id,
      commentId,
      userId,
      oldValue: { body: oldComment.body },
      newValue: { body },
      metadata: { edited: true }
    });

    return updated;
  }

  async delete(commentId: string, userId: string) {
    const comment = await this.prisma.task_comments.findUnique({
      where: { id: commentId },
      include: { tasks: true }
    });

    if (!comment) throw new NotFoundException('Comment not found');
    
    // Check ownership or admin
    // TODO: implement isAdmin check
    if (comment.user_id !== userId) {
      throw new ForbiddenException('Unauthorized');
    }

    await this.prisma.task_comments.delete({
      where: { id: commentId }
    });

    // Log activity
    await this.activityLogsService.logCommentDeleted({
      taskId: comment.task_id,
      commentId,
      userId,
      metadata: { body: comment.body.substring(0, 100) }
    });

    return { success: true, deletedId: commentId };
  }

  // Helper methods
  private parseMentions(text: string): string[] {
    // Parse @username or @[userId] format
    // Return array of user IDs
    const mentionRegex = /@\[([a-f0-9-]{36})\]/g;
    const matches = [...text.matchAll(mentionRegex)];
    return matches.map(m => m[1]);
  }

  private async validateTaskAccess(taskId: string, userId: string) {
    const task = await this.prisma.tasks.findFirst({
      where: { id: taskId },
      include: {
        projects: {
          include: {
            workspaces: {
              include: {
                memberships: {
                  where: { user_id: userId }
                }
              }
            }
          }
        }
      }
    });

    if (!task) throw new NotFoundException('Task not found');
    
    if (task.projects.workspaces.memberships.length === 0) {
      throw new ForbiddenException('Access denied');
    }

    return task;
  }
}
```

---

## 2️⃣ Attachments API

### 2.1 Database Schema
✅ **Đã có sẵn:** Table `attachments`
```prisma
model attachments {
  id          String   @id @default(dbgenerated("uuid_generate_v4()"))
  task_id     String   @db.Uuid
  url         String   // Supabase storage path
  mime_type   String?
  size        Int?     // bytes
  uploaded_by String?  @db.Uuid
  created_at  DateTime @default(now())
  tasks       tasks    @relation(...)
  
  @@index([task_id, created_at])
}
```

### 2.2 Module Structure
```
src/modules/attachments/
├── attachments.module.ts
├── attachments.controller.ts
├── attachments.service.ts
└── dto/
    ├── request-attachment-upload.dto.ts
    └── create-attachment.dto.ts
```

### 2.3 Upload Flow (2-step process)

**Step 1: Request upload URL**
```
POST /api/tasks/:taskId/attachments/upload-url
```

```typescript
// Request
{
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "size": 1024000
}

// Response
{
  "attachmentId": "uuid",  // Pre-created attachment record
  "uploadUrl": "https://supabase.storage/.../signed-upload-url",
  "token": "upload-token",
  "expiresIn": 3600
}
```

**Step 2: Client uploads to Supabase**
```javascript
// Frontend code
const response = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': mimeType,
  },
  body: fileBlob
});
```

**Step 3: Confirm upload (optional)**
```
POST /api/attachments/:attachmentId/confirm
```

---

### 2.4 API Endpoints

#### POST `/api/tasks/:taskId/attachments/upload-url`
**Request upload URL**

```typescript
// AttachmentsService
async requestUpload(taskId: string, userId: string, dto: {
  fileName: string;
  mimeType: string;
  size: number;
}) {
  // 1. Validate task access
  await this.validateTaskAccess(taskId, userId);

  // 2. Generate storage path (similar to StorageService)
  const storagePath = this.generateStoragePath(userId, taskId, dto.fileName);

  // 3. Create signed upload URL via StorageService
  const { signedUrl, token } = await this.storageService.createSignedUploadUrl(
    userId,
    `attachments/${taskId}/${dto.fileName}`
  );

  // 4. Pre-create attachment record (status: pending)
  const attachment = await this.prisma.attachments.create({
    data: {
      task_id: taskId,
      url: storagePath,
      mime_type: dto.mimeType,
      size: dto.size,
      uploaded_by: userId,
    }
  });

  // 5. Log activity
  await this.activityLogsService.logAttachmentAdded({
    taskId,
    attachmentId: attachment.id,
    userId,
    metadata: {
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      size: dto.size,
    }
  });

  return {
    attachmentId: attachment.id,
    uploadUrl: signedUrl,
    token,
    expiresIn: 3600,
  };
}
```

---

#### GET `/api/tasks/:taskId/attachments`
**List attachments của task**

```typescript
// Response
{
  "data": [
    {
      "id": "uuid",
      "taskId": "uuid",
      "url": "storage/path/file.pdf",
      "fileName": "document.pdf",
      "mimeType": "application/pdf",
      "size": 1024000,
      "uploadedBy": "uuid",
      "uploadedByName": "John Doe",
      "createdAt": "2025-10-25T10:00:00Z",
      "viewUrl": "https://supabase.../signed-view-url"  // Generated on-demand
    }
  ]
}
```

---

#### GET `/api/attachments/:attachmentId/view`
**Get signed view URL**

```typescript
async getViewUrl(attachmentId: string, userId: string) {
  const attachment = await this.prisma.attachments.findUnique({
    where: { id: attachmentId },
    include: { tasks: true }
  });

  if (!attachment) throw new NotFoundException();
  
  // Validate access
  await this.validateTaskAccess(attachment.task_id, userId);

  // Generate signed view URL (600s expiry)
  const { signedUrl } = await this.storageService.createSignedViewUrl(
    attachment.url
  );

  return { signedUrl, expiresIn: 600 };
}
```

---

#### DELETE `/api/attachments/:attachmentId`
**Delete attachment**

```typescript
async delete(attachmentId: string, userId: string) {
  const attachment = await this.prisma.attachments.findUnique({
    where: { id: attachmentId },
    include: { tasks: true }
  });

  if (!attachment) throw new NotFoundException();

  // Check permission (uploader or admin)
  if (attachment.uploaded_by !== userId) {
    // TODO: Check admin role
    throw new ForbiddenException('Unauthorized');
  }

  // 1. Delete from Supabase Storage
  await this.storageService.remove(attachment.url);

  // 2. Delete DB record
  await this.prisma.attachments.delete({
    where: { id: attachmentId }
  });

  // 3. Log activity
  await this.activityLogsService.logAttachmentRemoved({
    taskId: attachment.task_id,
    attachmentId,
    userId,
    metadata: {
      fileName: this.extractFileName(attachment.url),
      size: attachment.size,
    }
  });

  return { success: true };
}
```

---

### 2.5 Storage Path Convention

```typescript
// Attachment storage paths
{userId}/attachments/{taskId}/{timestamp}-{slug}.{ext}

// Example:
// 550e8400-e29b-41d4-a716-446655440000/attachments/
//   abc123-task-id/1729843200000-project-proposal.pdf
```

**Benefits:**
- Organized by user & task
- Easy cleanup if task deleted
- Unique timestamped filenames
- Matches existing Storage module pattern

---

## 3️⃣ Activity Logs Trigger

### 3.1 ActivityLogsService

```typescript
// src/modules/activity-logs/activity-logs.service.ts

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  // Generic log method
  private async log(data: {
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
    taskId?: string;
    checklistItemId?: string;
    userId: string;
    action: activity_action;
    entityType: entity_type;
    entityId?: string;
    entityName?: string;
    oldValue?: any;
    newValue?: any;
    metadata?: any;
  }) {
    return this.prisma.activity_logs.create({
      data: {
        workspace_id: data.workspaceId ?? null,
        project_id: data.projectId ?? null,
        board_id: data.boardId ?? null,
        task_id: data.taskId ?? null,
        checklist_item_id: data.checklistItemId ?? null,
        user_id: data.userId,
        action: data.action,
        entity_type: data.entityType,
        entity_id: data.entityId ?? null,
        entity_name: data.entityName ?? null,
        old_value: data.oldValue ?? null,
        new_value: data.newValue ?? null,
        metadata: data.metadata ?? null,
      }
    });
  }

  // Comment actions
  async logCommentCreated(params: {
    taskId: string;
    commentId: string;
    userId: string;
    workspaceId: string;
    projectId: string;
    boardId: string;
    metadata?: any;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'COMMENTED',
      entityType: 'COMMENT',
      entityId: params.commentId,
      metadata: params.metadata,
    });
  }

  async logCommentUpdated(params: {
    taskId: string;
    commentId: string;
    userId: string;
    oldValue: any;
    newValue: any;
    metadata?: any;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'UPDATED',
      entityType: 'COMMENT',
      entityId: params.commentId,
      oldValue: params.oldValue,
      newValue: params.newValue,
      metadata: params.metadata,
    });
  }

  async logCommentDeleted(params: {
    taskId: string;
    commentId: string;
    userId: string;
    metadata?: any;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'DELETED',
      entityType: 'COMMENT',
      entityId: params.commentId,
      metadata: params.metadata,
    });
  }

  // Attachment actions
  async logAttachmentAdded(params: {
    taskId: string;
    attachmentId: string;
    userId: string;
    metadata?: any;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'ATTACHED',
      entityType: 'ATTACHMENT',
      entityId: params.attachmentId,
      metadata: params.metadata,
    });
  }

  async logAttachmentRemoved(params: {
    taskId: string;
    attachmentId: string;
    userId: string;
    metadata?: any;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'REMOVED',
      entityType: 'ATTACHMENT',
      entityId: params.attachmentId,
      metadata: params.metadata,
    });
  }

  // Task actions
  async logTaskCreated(params: {
    workspaceId: string;
    projectId: string;
    boardId: string;
    taskId: string;
    userId: string;
    taskTitle: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'CREATED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
    });
  }

  async logTaskAssigned(params: {
    taskId: string;
    userId: string;
    oldAssigneeId?: string;
    newAssigneeId: string;
    taskTitle: string;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'ASSIGNED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
      oldValue: params.oldAssigneeId ? { assigneeId: params.oldAssigneeId } : null,
      newValue: { assigneeId: params.newAssigneeId },
    });
  }

  async logTaskMoved(params: {
    taskId: string;
    userId: string;
    fromBoardId: string;
    toBoardId: string;
    taskTitle: string;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'MOVED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
      oldValue: { boardId: params.fromBoardId },
      newValue: { boardId: params.toBoardId },
    });
  }

  // Label actions
  async logLabelAdded(params: {
    taskId: string;
    labelId: string;
    userId: string;
    labelName: string;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'ADDED',
      entityType: 'LABEL',
      entityId: params.labelId,
      entityName: params.labelName,
    });
  }

  async logLabelRemoved(params: {
    taskId: string;
    labelId: string;
    userId: string;
    labelName: string;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'REMOVED',
      entityType: 'LABEL',
      entityId: params.labelId,
      entityName: params.labelName,
    });
  }

  // Checklist actions (from previous guide)
  async logChecklistCreated(params: {
    taskId: string;
    checklistItemId: string;
    userId: string;
    content: string;
  }) {
    return this.log({
      taskId: params.taskId,
      checklistItemId: params.checklistItemId,
      userId: params.userId,
      action: 'CREATED',
      entityType: 'TASK_CHECKLIST_ITEM',
      entityId: params.checklistItemId,
      entityName: params.content,
    });
  }

  async logChecklistChecked(params: {
    taskId: string;
    checklistItemId: string;
    userId: string;
    content: string;
  }) {
    return this.log({
      taskId: params.taskId,
      checklistItemId: params.checklistItemId,
      userId: params.userId,
      action: 'CHECKED',
      entityType: 'TASK_CHECKLIST_ITEM',
      entityId: params.checklistItemId,
      entityName: params.content,
    });
  }

  async logChecklistUnchecked(params: {
    taskId: string;
    checklistItemId: string;
    userId: string;
    content: string;
  }) {
    return this.log({
      taskId: params.taskId,
      checklistItemId: params.checklistItemId,
      userId: params.userId,
      action: 'UNCHECKED',
      entityType: 'TASK_CHECKLIST_ITEM',
      entityId: params.checklistItemId,
      entityName: params.content,
    });
  }

  // Query methods
  async getTaskActivityFeed(taskId: string, limit = 50) {
    return this.prisma.activity_logs.findMany({
      where: { task_id: taskId },
      include: {
        users: {
          select: { id: true, name: true, avatar_url: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async getProjectActivityFeed(projectId: string, limit = 100) {
    return this.prisma.activity_logs.findMany({
      where: { project_id: projectId },
      include: {
        users: {
          select: { id: true, name: true, avatar_url: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
```

### 3.2 Integration Points

**Trigger activity logs khi:**

✅ **Tasks:**
- Create task → `logTaskCreated()`
- Assign task → `logTaskAssigned()`
- Move task → `logTaskMoved()`
- Update priority → `logTaskUpdated()` with old/new priority
- Complete task → `logTaskCompleted()`

✅ **Comments:**
- Create comment → `logCommentCreated()`
- Update comment → `logCommentUpdated()`
- Delete comment → `logCommentDeleted()`

✅ **Attachments:**
- Upload attachment → `logAttachmentAdded()`
- Delete attachment → `logAttachmentRemoved()`

✅ **Checklists:**
- Create item → `logChecklistCreated()`
- Toggle checked → `logChecklistChecked()` / `logChecklistUnchecked()`
- Delete item → `logChecklistDeleted()`

✅ **Labels:**
- Add label to task → `logLabelAdded()`
- Remove label from task → `logLabelRemoved()`

✅ **Project Members:**
- Add member → `logMemberAdded()`
- Remove member → `logMemberRemoved()`

---

## 4️⃣ Project Members & Invite System

### 4.1 Database Changes Needed

**Option A: Reuse `memberships` table (workspace level)**
```prisma
// Current: workspace-level only
model memberships {
  id           String     @id
  role         role       // OWNER, ADMIN, MEMBER
  user_id      String
  workspace_id String
  ...
}
```

**Option B: Create new `project_members` table** ⭐ **RECOMMENDED**
```prisma
model project_members {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  project_id String   @db.Uuid
  user_id    String   @db.Uuid
  role       project_role  @default(MEMBER)
  added_by   String?  @db.Uuid
  created_at DateTime @default(now()) @db.Timestamptz(6)
  
  projects   projects @relation(...)
  users      users    @relation(...)
  
  @@unique([project_id, user_id])
  @@index([project_id])
  @@index([user_id])
}

enum project_role {
  OWNER       // Creator of project, full control
  ADMIN       // Can manage members, settings
  MEMBER      // Can view and edit tasks
  VIEWER      // Read-only access
}
```

### 4.2 Migration Script

```sql
-- prisma/migrations/manual_add_project_members.sql

-- 1. Create project_role enum
CREATE TYPE project_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- 2. Create project_members table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'MEMBER',
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_project_user UNIQUE(project_id, user_id)
);

-- 3. Create indexes
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- 4. Migrate existing PERSONAL projects
-- Auto-add workspace members to personal projects
INSERT INTO project_members (project_id, user_id, role, created_at)
SELECT 
  p.id,
  m.user_id,
  CASE 
    WHEN m.role = 'OWNER' THEN 'OWNER'::project_role
    WHEN m.role = 'ADMIN' THEN 'ADMIN'::project_role
    ELSE 'MEMBER'::project_role
  END,
  NOW()
FROM projects p
JOIN workspaces w ON p.workspace_id = w.id
JOIN memberships m ON m.workspace_id = w.id
WHERE p.type = 'PERSONAL'
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 5. Verification
SELECT 
  p.name AS project_name,
  p.type,
  COUNT(pm.*) AS member_count
FROM projects p
LEFT JOIN project_members pm ON pm.project_id = p.id
GROUP BY p.id, p.name, p.type
ORDER BY p.created_at DESC;
```

### 4.3 Project Type Transition

**PERSONAL → TEAM transition rules:**
```typescript
async convertToTeamProject(projectId: string, userId: string) {
  // 1. Check permission (must be owner)
  const project = await this.prisma.projects.findUnique({
    where: { id: projectId },
    include: {
      workspaces: {
        include: {
          memberships: {
            where: { user_id: userId }
          }
        }
      },
      project_members: true
    }
  });

  if (!project) throw new NotFoundException('Project not found');
  
  const membership = project.workspaces.memberships[0];
  if (!membership || membership.role !== 'OWNER') {
    throw new ForbiddenException('Only workspace owner can convert to TEAM');
  }

  // 2. Update project type
  const updated = await this.prisma.projects.update({
    where: { id: projectId },
    data: { type: 'TEAM' }
  });

  // 3. Log activity
  await this.activityLogsService.log({
    projectId,
    userId,
    action: 'UPDATED',
    entityType: 'PROJECT',
    entityId: projectId,
    oldValue: { type: 'PERSONAL' },
    newValue: { type: 'TEAM' },
    metadata: { 
      note: 'Converted from PERSONAL to TEAM project',
      memberCount: project.project_members.length
    }
  });

  return updated;
}
```

**Behavior differences:**

| Feature | PERSONAL Project | TEAM Project |
|---------|-----------------|--------------|
| Members | Auto: all workspace members | Manual: invite specific users |
| Visibility | All workspace members see it | Only invited members see it |
| Access Control | Workspace-level roles apply | Project-level roles apply |
| Invites | Not needed | Required to add members |

### 4.4 Invite API Endpoints

#### POST `/api/projects/:projectId/members/invite`
**Invite user to TEAM project**

```typescript
// Request
{
  "email": "user@example.com",  // Email or userId
  "role": "MEMBER"               // OWNER, ADMIN, MEMBER, VIEWER
}

// Response
{
  "id": "uuid",
  "projectId": "uuid",
  "userId": "uuid",
  "role": "MEMBER",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "avatarUrl": "https://..."
  },
  "addedBy": "uuid",
  "createdAt": "2025-10-25T10:00:00Z"
}
```

**Flow:**
```typescript
async inviteMember(projectId: string, invitedBy: string, dto: InviteMemberDto) {
  // 1. Validate project is TEAM type
  const project = await this.prisma.projects.findUnique({
    where: { id: projectId }
  });

  if (!project) throw new NotFoundException('Project not found');
  if (project.type !== 'TEAM') {
    throw new BadRequestException('Can only invite to TEAM projects');
  }

  // 2. Check permission (must be OWNER or ADMIN)
  await this.checkProjectRole(projectId, invitedBy, ['OWNER', 'ADMIN']);

  // 3. Find user by email
  const user = await this.prisma.users.findUnique({
    where: { email: dto.email }
  });

  if (!user) {
    throw new NotFoundException('User not found with this email');
  }

  // 4. Check if already member
  const existing = await this.prisma.project_members.findUnique({
    where: {
      project_id_user_id: {
        project_id: projectId,
        user_id: user.id
      }
    }
  });

  if (existing) {
    throw new ConflictException('User is already a member');
  }

  // 5. Add member
  const member = await this.prisma.project_members.create({
    data: {
      project_id: projectId,
      user_id: user.id,
      role: dto.role ?? 'MEMBER',
      added_by: invitedBy,
    },
    include: {
      users: {
        select: { id: true, name: true, email: true, avatar_url: true }
      }
    }
  });

  // 6. Send notification
  await this.notificationsService.sendProjectInvite({
    projectId,
    projectName: project.name,
    invitedUserId: user.id,
    invitedBy,
  });

  // 7. Log activity
  await this.activityLogsService.log({
    projectId,
    userId: invitedBy,
    action: 'ADDED',
    entityType: 'MEMBERSHIP',
    entityId: member.id,
    entityName: user.name,
    metadata: {
      role: dto.role,
      email: user.email,
    }
  });

  return member;
}
```

---

#### GET `/api/projects/:projectId/members`
**List project members**

```typescript
// Response
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "role": "OWNER",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "avatarUrl": "https://..."
      },
      "addedBy": null,
      "createdAt": "2025-10-20T10:00:00Z"
    },
    {
      "id": "uuid",
      "userId": "uuid",
      "role": "MEMBER",
      "user": {...},
      "addedBy": "uuid",
      "createdAt": "2025-10-25T10:00:00Z"
    }
  ],
  "count": 2
}
```

---

#### PATCH `/api/projects/:projectId/members/:memberId`
**Update member role**

```typescript
// Request
{
  "role": "ADMIN"
}

// Implementation
async updateMemberRole(
  projectId: string,
  memberId: string,
  updatedBy: string,
  newRole: project_role
) {
  // 1. Check permission (must be OWNER)
  await this.checkProjectRole(projectId, updatedBy, ['OWNER']);

  // 2. Get current member
  const member = await this.prisma.project_members.findUnique({
    where: { id: memberId },
    include: { users: true }
  });

  if (!member || member.project_id !== projectId) {
    throw new NotFoundException('Member not found');
  }

  // 3. Prevent removing last owner
  if (member.role === 'OWNER' && newRole !== 'OWNER') {
    const ownerCount = await this.prisma.project_members.count({
      where: { project_id: projectId, role: 'OWNER' }
    });

    if (ownerCount <= 1) {
      throw new BadRequestException('Cannot remove last owner');
    }
  }

  // 4. Update role
  const updated = await this.prisma.project_members.update({
    where: { id: memberId },
    data: { role: newRole }
  });

  // 5. Log activity
  await this.activityLogsService.log({
    projectId,
    userId: updatedBy,
    action: 'UPDATED',
    entityType: 'MEMBERSHIP',
    entityId: memberId,
    entityName: member.users.name,
    oldValue: { role: member.role },
    newValue: { role: newRole },
  });

  return updated;
}
```

---

#### DELETE `/api/projects/:projectId/members/:memberId`
**Remove member from project**

```typescript
async removeMember(projectId: string, memberId: string, removedBy: string) {
  // 1. Check permission
  await this.checkProjectRole(projectId, removedBy, ['OWNER', 'ADMIN']);

  // 2. Get member
  const member = await this.prisma.project_members.findUnique({
    where: { id: memberId },
    include: { users: true }
  });

  if (!member) throw new NotFoundException();

  // 3. Prevent removing last owner
  if (member.role === 'OWNER') {
    const ownerCount = await this.prisma.project_members.count({
      where: { project_id: projectId, role: 'OWNER' }
    });

    if (ownerCount <= 1) {
      throw new BadRequestException('Cannot remove last owner');
    }
  }

  // 4. Remove member
  await this.prisma.project_members.delete({
    where: { id: memberId }
  });

  // 5. Log activity
  await this.activityLogsService.log({
    projectId,
    userId: removedBy,
    action: 'REMOVED',
    entityType: 'MEMBERSHIP',
    entityId: memberId,
    entityName: member.users.name,
    metadata: { role: member.role }
  });

  return { success: true };
}
```

---

#### POST `/api/projects/:projectId/convert-to-team`
**Convert PERSONAL → TEAM project**

```typescript
// Request Body (optional)
{
  "keepCurrentMembers": true  // Keep workspace members as project members
}

// Response
{
  "id": "uuid",
  "name": "My Project",
  "type": "TEAM",
  "memberCount": 5,
  "convertedAt": "2025-10-25T10:00:00Z"
}
```

---

## 5️⃣ Labels API

### 5.1 Database Schema
✅ **Đã có sẵn:**

```prisma
model labels {
  id           String   @id @default(uuid())
  workspace_id String
  name         String
  color        String   // Hex color code
  created_at   DateTime @default(now())
  updated_at   DateTime @default(now())
  
  workspaces   workspaces    @relation(...)
  task_labels  task_labels[] // Many-to-many
}

model task_labels {
  task_id  String
  label_id String
  
  tasks  tasks  @relation(...)
  labels labels @relation(...)
  
  @@id([task_id, label_id])
}
```

### 5.2 Module Structure

```
src/modules/labels/
├── labels.module.ts
├── labels.controller.ts
├── labels.service.ts
└── dto/
    ├── create-label.dto.ts
    ├── update-label.dto.ts
    └── assign-label.dto.ts
```

### 5.3 API Endpoints

#### POST `/api/workspaces/:workspaceId/labels`
**Create label**

```typescript
// Request
{
  "name": "Bug",
  "color": "#FF0000"
}

// Response
{
  "id": "uuid",
  "workspaceId": "uuid",
  "name": "Bug",
  "color": "#FF0000",
  "createdAt": "2025-10-25T10:00:00Z"
}
```

**Validation:**
- Name required, max 50 characters
- Color must be valid hex code (#RRGGBB)
- Check duplicate name in workspace

---

#### GET `/api/workspaces/:workspaceId/labels`
**List all labels in workspace**

```typescript
// Response
{
  "data": [
    {
      "id": "uuid",
      "name": "Bug",
      "color": "#FF0000",
      "taskCount": 15,  // Number of tasks using this label
      "createdAt": "2025-10-25T10:00:00Z"
    },
    {
      "id": "uuid",
      "name": "Feature",
      "color": "#00FF00",
      "taskCount": 42,
      "createdAt": "2025-10-24T10:00:00Z"
    }
  ]
}
```

---

#### PATCH `/api/labels/:labelId`
**Update label**

```typescript
// Request
{
  "name": "Critical Bug",
  "color": "#FF0000"
}

// Implementation
async update(labelId: string, userId: string, dto: UpdateLabelDto) {
  const label = await this.prisma.labels.findUnique({
    where: { id: labelId }
  });

  if (!label) throw new NotFoundException();

  // Check workspace access
  await this.checkWorkspaceAccess(label.workspace_id, userId);

  const updated = await this.prisma.labels.update({
    where: { id: labelId },
    data: {
      name: dto.name ?? label.name,
      color: dto.color ?? label.color,
      updated_at: new Date(),
    }
  });

  return updated;
}
```

---

#### DELETE `/api/labels/:labelId`
**Delete label**

```typescript
async delete(labelId: string, userId: string) {
  const label = await this.prisma.labels.findUnique({
    where: { id: labelId },
    include: {
      task_labels: true  // Check usage
    }
  });

  if (!label) throw new NotFoundException();
  
  await this.checkWorkspaceAccess(label.workspace_id, userId);

  // Cascade delete will remove task_labels entries
  await this.prisma.labels.delete({
    where: { id: labelId }
  });

  return { success: true, removedFromTasks: label.task_labels.length };
}
```

---

#### POST `/api/tasks/:taskId/labels`
**Assign label to task**

```typescript
// Request
{
  "labelId": "uuid"
}

// Implementation
async assignToTask(taskId: string, labelId: string, userId: string) {
  // 1. Validate task & label exist
  const [task, label] = await Promise.all([
    this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: { projects: true }
    }),
    this.prisma.labels.findUnique({
      where: { id: labelId }
    })
  ]);

  if (!task || !label) throw new NotFoundException();

  // 2. Validate label belongs to task's workspace
  if (task.projects.workspace_id !== label.workspace_id) {
    throw new BadRequestException('Label not in same workspace as task');
  }

  // 3. Check if already assigned
  const existing = await this.prisma.task_labels.findUnique({
    where: {
      task_id_label_id: {
        task_id: taskId,
        label_id: labelId
      }
    }
  });

  if (existing) {
    throw new ConflictException('Label already assigned to this task');
  }

  // 4. Assign label
  await this.prisma.task_labels.create({
    data: {
      task_id: taskId,
      label_id: labelId,
    }
  });

  // 5. Log activity
  await this.activityLogsService.logLabelAdded({
    taskId,
    labelId,
    userId,
    labelName: label.name,
  });

  return { success: true, label };
}
```

---

#### DELETE `/api/tasks/:taskId/labels/:labelId`
**Remove label from task**

```typescript
async removeFromTask(taskId: string, labelId: string, userId: string) {
  const taskLabel = await this.prisma.task_labels.findUnique({
    where: {
      task_id_label_id: {
        task_id: taskId,
        label_id: labelId
      }
    },
    include: {
      labels: true,
      tasks: true
    }
  });

  if (!taskLabel) throw new NotFoundException();

  await this.prisma.task_labels.delete({
    where: {
      task_id_label_id: {
        task_id: taskId,
        label_id: labelId
      }
    }
  });

  // Log activity
  await this.activityLogsService.logLabelRemoved({
    taskId,
    labelId,
    userId,
    labelName: taskLabel.labels.name,
  });

  return { success: true };
}
```

---

#### GET `/api/tasks/:taskId/labels`
**Get labels of task**

```typescript
async getTaskLabels(taskId: string) {
  const labels = await this.prisma.task_labels.findMany({
    where: { task_id: taskId },
    include: {
      labels: true
    }
  });

  return labels.map(tl => tl.labels);
}

// Response
{
  "data": [
    {
      "id": "uuid",
      "name": "Bug",
      "color": "#FF0000"
    },
    {
      "id": "uuid",
      "name": "High Priority",
      "color": "#FFA500"
    }
  ]
}
```

---

## 📊 Implementation Timeline

### Phase 1: Core Features (Week 1-2)
**Priority: HIGH** 🔴

1. **Activity Logs Service** (2 days)
   - Create ActivityLogsService
   - Implement all log methods
   - Add to existing modules (TasksService, etc.)
   - Test activity feed queries

2. **Comments API** (2 days)
   - Create CommentsModule
   - Implement all endpoints
   - Integrate activity logs
   - Add @mention parsing
   - Test with notifications

3. **Labels API** (1 day)
   - Create LabelsModule
   - Implement CRUD endpoints
   - Integrate with tasks
   - Add activity logs

### Phase 2: File & Team Features (Week 3)
**Priority: MEDIUM** 🟡

4. **Attachments API** (2-3 days)
   - Create AttachmentsModule
   - Integrate with StorageService
   - Implement 2-step upload flow
   - Add activity logs
   - Test upload/download/delete

5. **Project Members & Invites** (2-3 days)
   - Create migration for project_members
   - Create ProjectMembersService
   - Implement invite endpoints
   - Add PERSONAL → TEAM conversion
   - Test permission checks

### Phase 3: Polish & Testing (Week 4)
**Priority: LOW** 🟢

6. **Integration Testing**
   - E2E tests for all new endpoints
   - Permission/authorization tests
   - Activity logs verification
   - Notification flow tests

7. **Documentation**
   - API docs (Swagger)
   - Frontend integration guide
   - Permission matrix
   - Migration guide

---

## 🔐 Permission Matrix

| Action | Workspace Role | Project Type | Project Role | Allowed? |
|--------|---------------|--------------|--------------|----------|
| View tasks | MEMBER+ | PERSONAL | N/A | ✅ Yes |
| View tasks | MEMBER+ | TEAM | VIEWER+ | ✅ Yes |
| Create task | MEMBER+ | PERSONAL | N/A | ✅ Yes |
| Create task | MEMBER+ | TEAM | MEMBER+ | ✅ Yes |
| Edit task | MEMBER+ | PERSONAL | N/A | ✅ Yes |
| Edit task | MEMBER+ | TEAM | MEMBER+ | ✅ Yes |
| Delete task | MEMBER+ | PERSONAL | N/A | ✅ Yes |
| Delete task | MEMBER+ | TEAM | ADMIN+ | ✅ Yes |
| Add comment | MEMBER+ | ANY | VIEWER+ | ✅ Yes |
| Edit own comment | MEMBER+ | ANY | VIEWER+ | ✅ Yes |
| Edit any comment | ADMIN+ | ANY | ADMIN+ | ✅ Yes |
| Delete own comment | MEMBER+ | ANY | VIEWER+ | ✅ Yes |
| Delete any comment | ADMIN+ | ANY | ADMIN+ | ✅ Yes |
| Upload attachment | MEMBER+ | ANY | MEMBER+ | ✅ Yes |
| Delete own attachment | MEMBER+ | ANY | MEMBER+ | ✅ Yes |
| Delete any attachment | ADMIN+ | ANY | ADMIN+ | ✅ Yes |
| Create label | MEMBER+ | N/A | N/A | ✅ Yes (workspace level) |
| Edit label | ADMIN+ | N/A | N/A | ✅ Yes |
| Delete label | ADMIN+ | N/A | N/A | ✅ Yes |
| Assign label to task | MEMBER+ | ANY | MEMBER+ | ✅ Yes |
| Invite to project | N/A | TEAM | ADMIN+ | ✅ Yes |
| Remove member | N/A | TEAM | ADMIN+ | ✅ Yes |
| Change member role | N/A | TEAM | OWNER | ✅ Yes |
| Convert to TEAM | OWNER | PERSONAL | N/A | ✅ Yes |

---

## 🧪 Testing Checklist

### Comments
- [ ] Create comment on task
- [ ] List comments with pagination
- [ ] Update own comment
- [ ] Delete own comment
- [ ] Admin can delete any comment
- [ ] @mentions detected and notified
- [ ] Activity log recorded for all actions

### Attachments
- [ ] Request upload URL
- [ ] Upload file to Supabase
- [ ] List task attachments
- [ ] Get view URL for attachment
- [ ] Delete own attachment
- [ ] Admin can delete any attachment
- [ ] Activity log recorded

### Labels
- [ ] Create label in workspace
- [ ] List workspace labels
- [ ] Update label
- [ ] Delete label (cascades to tasks)
- [ ] Assign label to task
- [ ] Remove label from task
- [ ] Cannot assign label from different workspace
- [ ] Activity log recorded

### Project Members
- [ ] Invite user to TEAM project
- [ ] Cannot invite to PERSONAL project
- [ ] List project members
- [ ] Update member role
- [ ] Remove member
- [ ] Cannot remove last owner
- [ ] Convert PERSONAL → TEAM
- [ ] Workspace members auto-added on migration

### Activity Logs
- [ ] All actions trigger logs
- [ ] Task activity feed works
- [ ] Project activity feed works
- [ ] Logs include user info
- [ ] old_value/new_value populated correctly
- [ ] Metadata includes relevant context

---

## 📝 Next Steps

1. **Review & Approve** this implementation plan
2. **Run migration** for `project_members` table
3. **Create ActivityLogsService** first (foundation for all features)
4. **Implement modules** in order: Comments → Labels → Attachments → Members
5. **Test each module** before moving to next
6. **Update Swagger docs** after each module
7. **Frontend integration** guide for each feature

---

## ✅ Decisions & Constraints

### 1. Comments
- ✅ **No time limit** - Users có thể edit comment bất cứ lúc nào
- ⚠️ **No @all mention** - Chỉ support @individual users (tránh spam)

### 2. Attachments - Supabase Free Tier Limits
**Supabase Free Tier:**
- ✅ **Storage:** 1 GB total
- ✅ **Max file size:** 50 MB per file
- ✅ **Bandwidth:** 2 GB/month
- ⚠️ **Database size:** 500 MB (PostgreSQL)

**Recommended limits cho app:**
```typescript
export const ATTACHMENT_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,  // 10 MB (conservative)
  ALLOWED_TYPES: [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain', 'text/csv',
    // Archives
    'application/zip', 'application/x-zip-compressed',
  ],
  MAX_FILES_PER_TASK: 20,  // Limit per task
};
```

### 3. Project Members
- ✅ **Search by email** - Input email → find user in database
- ✅ **Direct add** (không send email invitation)
- ✅ **Default role:** MEMBER
- ⚠️ **Error if email not found** - User must have account first

### 4. Labels
- ✅ **Max 5 labels per task** (clean UI, force prioritization)
- ✅ **Predefined color palette** (consistent design)
- ✅ **Workspace-wide scope** (as per current schema)

**Color Palette:**
```typescript
export const LABEL_COLORS = [
  { name: 'Red', hex: '#EF4444', bg: '#FEE2E2' },
  { name: 'Orange', hex: '#F97316', bg: '#FFEDD5' },
  { name: 'Amber', hex: '#F59E0B', bg: '#FEF3C7' },
  { name: 'Yellow', hex: '#EAB308', bg: '#FEF9C3' },
  { name: 'Lime', hex: '#84CC16', bg: '#ECFCCB' },
  { name: 'Green', hex: '#22C55E', bg: '#DCFCE7' },
  { name: 'Emerald', hex: '#10B981', bg: '#D1FAE5' },
  { name: 'Teal', hex: '#14B8A6', bg: '#CCFBF1' },
  { name: 'Cyan', hex: '#06B6D4', bg: '#CFFAFE' },
  { name: 'Sky', hex: '#0EA5E9', bg: '#E0F2FE' },
  { name: 'Blue', hex: '#3B82F6', bg: '#DBEAFE' },
  { name: 'Indigo', hex: '#6366F1', bg: '#E0E7FF' },
  { name: 'Violet', hex: '#8B5CF6', bg: '#EDE9FE' },
  { name: 'Purple', hex: '#A855F7', bg: '#F3E8FF' },
  { name: 'Fuchsia', hex: '#D946EF', bg: '#FAE8FF' },
  { name: 'Pink', hex: '#EC4899', bg: '#FCE7F3' },
  { name: 'Rose', hex: '#F43F5E', bg: '#FFE4E6' },
  { name: 'Gray', hex: '#6B7280', bg: '#F3F4F6' },
];
```

### 5. Activity Logs
- ✅ **Keep forever** - Important for audit trail & debugging
- ✅ **No auto-delete** (DB size should be fine với Supabase free tier)
- 💡 **Future optimization:** Nếu cần, có thể archive logs > 1 năm sang cold storage

---

## 🎯 Updated Implementation Priority

Bắt đầu implement theo thứ tự:

### Phase 1: Foundation (Week 1)
1. **ActivityLogsService** ← Start here (foundation cho tất cả)
2. **Labels API** (đơn giản nhất, test được ngay)
3. **Comments API** (có activity logs rồi)

### Phase 2: Advanced Features (Week 2)
4. **Attachments API** (có validation limits)
5. **Project Members** (migration + invite system)

---

**Ready to implement! 🚀**

Bạn có muốn tôi bắt đầu với **ActivityLogsService** không?
