# 📱 NOTIFICATION SYSTEM - IMPLEMENTATION PLAN

## 🎯 MỤC TIÊU
Hoàn thiện hệ thống notification với đầy đủ use cases cho collaboration và real-time updates.

---

## 📊 TỔNG QUAN KIẾN TRÚC

```
┌─────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Business Logic (Tasks, Events, etc.)                       │
│           ↓                                                  │
│  NotificationsService (Orchestration)                       │
│           ↓                                                  │
│  FCM Service (Send Push Notification)                       │
│           ↓                                                  │
│  User Devices                                               │
│                                                              │
│  [Parallel] → Prisma (Log to notifications table)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    WORKER SCHEDULED JOBS                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cron Trigger (Render/External)                            │
│           ↓                                                  │
│  WorkerController (Auth check)                              │
│           ↓                                                  │
│  WorkerService (Query & Loop)                               │
│           ↓                                                  │
│  NotificationsService (Send notification)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 PHASE 1: DATABASE SCHEMA UPDATES

### Step 1.1: Cập nhật Prisma Schema

**File:** `prisma/schema.prisma`

**Action:** Thêm các notification types mới

```prisma
enum notification_type {
  // Existing
  TASK_ASSIGNED
  TASK_MOVED
  TIME_REMINDER
  EVENT_INVITE
  EVENT_UPDATED
  MEETING_REMINDER
  SYSTEM
  
  // NEW - Thêm các types sau
  TASK_COMMENTED       // ← User comment vào task
  TASK_STATUS_CHANGED  // ← Task chuyển status (TO_DO → IN_PROGRESS → DONE)
  TASK_MENTION         // ← User được @mention trong comment
  TASK_DUE_CHANGED     // ← Due date thay đổi
  TASK_COMPLETED       // ← Task được đánh dấu DONE
  PROJECT_INVITED      // ← User được mời vào project
}
```

### Step 1.2: Generate Migration

```bash
npx prisma migrate dev --name add_notification_types
```

### Step 1.3: Verify Schema

```bash
npx prisma generate
npx prisma studio  # Kiểm tra enum đã update chưa
```

---

## 📋 PHASE 2: REAL-TIME NOTIFICATIONS

Các notification này được trigger **NGAY LẬP TỨC** khi action xảy ra, không qua worker.

---

### ✅ USE CASE 1: TASK_ASSIGNED

#### **Kịch bản:**
- User A tạo/update task và assign cho User B
- User B nhận notification ngay lập tức

#### **Trigger Point:**
- `TasksService.create()` - khi tạo task với assigneeId
- `TasksService.update()` - khi thay đổi assigneeId

#### **Implementation:**

**Step 1: Thêm method vào NotificationsService**

```typescript
// File: src/modules/notifications/notifications.service.ts

/**
 * Gửi notification khi task được assign cho user
 */
async sendTaskAssigned(data: {
  taskId: string;
  taskTitle: string;
  projectName: string;
  assigneeId: string;
  assignedBy: string; // User ID của người assign
  assignedByName: string; // Tên người assign
}): Promise<void> {
  try {
    // 1. Lấy FCM token của assignee
    const assigneeDevice = await this.prisma.user_devices.findFirst({
      where: {
        user_id: data.assigneeId,
        is_active: true,
      },
      orderBy: {
        last_active_at: 'desc',
      },
    });

    if (!assigneeDevice?.fcm_token) {
      this.logger.warn(
        `User ${data.assigneeId} has no active FCM token for task assignment`,
      );
      return;
    }

    // 2. Tạo message
    const message = `${data.assignedByName} đã giao task cho bạn trong project "${data.projectName}"`;

    // 3. Gửi FCM notification
    await this.fcmService.sendNotification({
      token: assigneeDevice.fcm_token,
      notification: {
        title: '📋 Task Mới',
        body: message,
      },
      data: {
        type: 'task_assigned',
        taskId: data.taskId,
        taskTitle: data.taskTitle,
        projectName: data.projectName,
        assignedBy: data.assignedBy,
        clickAction: 'OPEN_TASK_DETAIL',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'task_updates',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          tag: `task_${data.taskId}`, // Thay thế notification cũ của cùng task
        },
      },
    });

    // 4. Log vào database
    await this.logNotification({
      userId: data.assigneeId,
      type: 'TASK_ASSIGNED',
      taskId: data.taskId,
      message,
    });

    this.logger.log(
      `Task assigned notification sent to user ${data.assigneeId}`,
    );
  } catch (error) {
    this.logger.error(`Failed to send task assigned notification:`, error);
    // Don't throw - notification failure shouldn't break business logic
  }
}
```

**Step 2: Integrate vào TasksService**

```typescript
// File: src/modules/tasks/tasks.service.ts

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService, // ← Inject
  ) {}

  // Trong method create()
  async create(dto: {
    projectId: string;
    boardId: string;
    title: string;
    assigneeId?: string;
    createdBy?: string; // ← Thêm tham số này
  }): Promise<tasks> {
    // ... existing code ...
    
    const task = await this.prisma.tasks.create({
      data: {
        project_id: dto.projectId,
        board_id: dto.boardId,
        title: dto.title,
        assignee_id: dto.assigneeId ?? null,
        created_by: dto.createdBy ?? null,
        position: nextPos,
      },
      include: {
        projects: {
          select: { name: true },
        },
        users_tasks_created_byTousers: {
          select: { id: true, name: true },
        },
      },
    });

    // 🔔 TRIGGER NOTIFICATION nếu có assignee
    if (dto.assigneeId && dto.assigneeId !== dto.createdBy) {
      await this.notificationsService.sendTaskAssigned({
        taskId: task.id,
        taskTitle: task.title,
        projectName: task.projects.name,
        assigneeId: dto.assigneeId,
        assignedBy: dto.createdBy || 'system',
        assignedByName: task.users_tasks_created_byTousers?.name || 'Hệ thống',
      });
    }

    return task;
  }

  // Trong method update()
  async update(
    id: string,
    dto: { 
      title?: string; 
      description?: string; 
      assigneeId?: string;
      updatedBy?: string; // ← Thêm tham số này
    },
  ): Promise<tasks> {
    // 1. Lấy task hiện tại
    const currentTask = await this.prisma.tasks.findUnique({
      where: { id },
      include: {
        projects: { select: { name: true } },
      },
    });

    if (!currentTask) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // 2. Update task
    const updatedTask = await this.prisma.tasks.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        assignee_id: dto.assigneeId,
      },
      include: {
        users_tasks_created_byTousers: {
          select: { name: true },
        },
      },
    });

    // 3. 🔔 TRIGGER NOTIFICATION nếu assignee thay đổi
    if (
      dto.assigneeId && 
      dto.assigneeId !== currentTask.assignee_id &&
      dto.assigneeId !== dto.updatedBy
    ) {
      // Lấy thông tin user thực hiện update
      const updater = await this.prisma.users.findUnique({
        where: { id: dto.updatedBy },
        select: { name: true },
      });

      await this.notificationsService.sendTaskAssigned({
        taskId: updatedTask.id,
        taskTitle: updatedTask.title,
        projectName: currentTask.projects.name,
        assigneeId: dto.assigneeId,
        assignedBy: dto.updatedBy || 'system',
        assignedByName: updater?.name || 'Hệ thống',
      });
    }

    return updatedTask;
  }
}
```

**Step 3: Update Controller để truyền userId**

```typescript
// File: src/modules/tasks/tasks.controller.ts

@Post()
create(
  @Body() dto: CreateTaskDto,
  @CurrentUser('id') userId: string, // ← Lấy từ auth token
): Promise<tasks> {
  return this.svc.create({
    ...dto,
    createdBy: userId, // ← Truyền vào service
  });
}

@Patch(':id')
update(
  @Param('id', new ParseUUIDPipe()) id: string,
  @Body() dto: UpdateTaskDto,
  @CurrentUser('id') userId: string, // ← Lấy từ auth token
): Promise<tasks> {
  return this.svc.update(id, {
    ...dto,
    updatedBy: userId, // ← Truyền vào service
  });
}
```

**Step 4: Update Module Dependencies**

```typescript
// File: src/modules/tasks/tasks.module.ts

import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module'; // ← Import

@Module({
  imports: [
    PrismaModule,
    NotificationsModule, // ← Thêm
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
```

**Step 5: Ensure NotificationsModule exports service**

```typescript
// File: src/modules/notifications/notifications.module.ts

import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FcmModule } from '../fcm/fcm.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [FcmModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // ← Đảm bảo có dòng này
})
export class NotificationsModule {}
```

---

### ✅ USE CASE 2: TASK_COMMENTED

#### **Kịch bản:**
- User A comment vào task
- Assignee + Creator + Watchers nhận notification

#### **Trigger Point:**
- `TasksService.createComment()` - ngay sau khi tạo comment

#### **Implementation:**

**Step 1: Thêm method vào NotificationsService**

```typescript
// File: src/modules/notifications/notifications.service.ts

/**
 * Gửi notification khi có comment mới trên task
 */
async sendTaskCommented(data: {
  taskId: string;
  taskTitle: string;
  commentId: string;
  commentBody: string;
  commentedBy: string; // User ID
  commentedByName: string;
  recipientIds: string[]; // Danh sách user cần nhận thông báo
}): Promise<void> {
  try {
    // Lấy preview của comment (max 100 ký tự)
    const commentPreview = data.commentBody.length > 100
      ? data.commentBody.substring(0, 100) + '...'
      : data.commentBody;

    const message = `${data.commentedByName}: ${commentPreview}`;

    // Lấy FCM tokens của tất cả recipients
    const devices = await this.prisma.user_devices.findMany({
      where: {
        user_id: {
          in: data.recipientIds,
        },
        is_active: true,
      },
      orderBy: {
        last_active_at: 'desc',
      },
      distinct: ['user_id'], // Chỉ lấy 1 device mỗi user
    });

    if (devices.length === 0) {
      this.logger.warn('No active devices found for task comment notification');
      return;
    }

    // Gửi notification đến tất cả devices
    const notifications = devices.map((device) => ({
      token: device.fcm_token,
      notification: {
        title: `💬 Comment mới: ${data.taskTitle}`,
        body: message,
      },
      data: {
        type: 'task_commented',
        taskId: data.taskId,
        commentId: data.commentId,
        commentedBy: data.commentedBy,
        clickAction: 'OPEN_TASK_COMMENTS',
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'task_comments',
          priority: 'default' as const,
          defaultSound: true,
          tag: `task_comment_${data.taskId}`,
        },
      },
    }));

    // Gửi batch notifications
    const results = await Promise.allSettled(
      notifications.map((notification) =>
        this.fcmService.sendNotification(notification),
      ),
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    this.logger.log(
      `Task comment notifications sent: ${successCount}/${results.length}`,
    );

    // Log vào database cho từng recipient
    await Promise.allSettled(
      devices.map((device) =>
        this.logNotification({
          userId: device.user_id,
          type: 'TASK_COMMENTED',
          taskId: data.taskId,
          message,
        }),
      ),
    );
  } catch (error) {
    this.logger.error(`Failed to send task commented notification:`, error);
  }
}
```

**Step 2: Integrate vào TasksService**

```typescript
// File: src/modules/tasks/tasks.service.ts

async createComment(
  taskId: string,
  userId: string,
  body: string,
): Promise<task_comments> {
  // 1. Kiểm tra task có tồn tại không
  const task = await this.prisma.tasks.findUnique({
    where: { id: taskId },
    include: {
      users_tasks_assignee_idTousers: {
        select: { id: true },
      },
      users_tasks_created_byTousers: {
        select: { id: true },
      },
      watchers: {
        select: { user_id: true },
      },
    },
  });

  if (!task) {
    throw new NotFoundException(`Task with ID ${taskId} not found`);
  }

  // 2. Tạo comment
  const comment = await this.prisma.task_comments.create({
    data: {
      task_id: taskId,
      user_id: userId,
      body,
    },
    include: {
      users: {
        select: { id: true, name: true },
      },
    },
  });

  // 3. 🔔 TRIGGER NOTIFICATION
  // Tạo danh sách recipients (assignee + creator + watchers), loại bỏ người comment
  const recipientSet = new Set<string>();

  if (task.assignee_id && task.assignee_id !== userId) {
    recipientSet.add(task.assignee_id);
  }

  if (task.created_by && task.created_by !== userId) {
    recipientSet.add(task.created_by);
  }

  task.watchers.forEach((watcher) => {
    if (watcher.user_id !== userId) {
      recipientSet.add(watcher.user_id);
    }
  });

  const recipientIds = Array.from(recipientSet);

  if (recipientIds.length > 0) {
    await this.notificationsService.sendTaskCommented({
      taskId: task.id,
      taskTitle: task.title,
      commentId: comment.id,
      commentBody: body,
      commentedBy: userId,
      commentedByName: comment.users.name,
      recipientIds,
    });
  }

  return comment;
}
```

---

### ✅ USE CASE 3: TASK_MENTION

#### **Kịch bản:**
- User A viết comment có @username
- User được mention nhận notification riêng (priority cao hơn)

#### **Trigger Point:**
- `TasksService.createComment()` - sau khi tạo comment, detect mentions

#### **Implementation:**

**Step 1: Tạo Mention Detection Utility**

```typescript
// File: src/common/utils/mention-detector.ts

export interface MentionMatch {
  username: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Detect @mentions trong text
 * Format: @username hoặc @[Display Name](userId)
 */
export class MentionDetector {
  // Pattern 1: @username (simple mention)
  private static readonly SIMPLE_MENTION_PATTERN = /@(\w+)/g;
  
  // Pattern 2: @[Display Name](userId) (rich mention with ID)
  private static readonly RICH_MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g;

  /**
   * Extract usernames từ simple mentions
   */
  static extractSimpleMentions(text: string): string[] {
    const matches = text.matchAll(this.SIMPLE_MENTION_PATTERN);
    return Array.from(matches).map((match) => match[1]);
  }

  /**
   * Extract user IDs từ rich mentions
   */
  static extractRichMentions(text: string): string[] {
    const matches = text.matchAll(this.RICH_MENTION_PATTERN);
    return Array.from(matches).map((match) => match[2]); // group 2 là userId
  }

  /**
   * Extract tất cả mentions (combine cả 2 formats)
   */
  static extractAllMentions(text: string): {
    usernames: string[];
    userIds: string[];
  } {
    return {
      usernames: this.extractSimpleMentions(text),
      userIds: this.extractRichMentions(text),
    };
  }
}
```

**Step 2: Thêm method vào NotificationsService**

```typescript
// File: src/modules/notifications/notifications.service.ts

/**
 * Gửi notification khi user được @mention trong comment
 */
async sendTaskMention(data: {
  taskId: string;
  taskTitle: string;
  commentId: string;
  commentBody: string;
  mentionedBy: string;
  mentionedByName: string;
  mentionedUserIds: string[]; // Danh sách user được mention
}): Promise<void> {
  try {
    const commentPreview = data.commentBody.length > 100
      ? data.commentBody.substring(0, 100) + '...'
      : data.commentBody;

    const message = `${data.mentionedByName} đã nhắc đến bạn: ${commentPreview}`;

    // Lấy FCM tokens
    const devices = await this.prisma.user_devices.findMany({
      where: {
        user_id: {
          in: data.mentionedUserIds,
        },
        is_active: true,
      },
      orderBy: {
        last_active_at: 'desc',
      },
      distinct: ['user_id'],
    });

    if (devices.length === 0) {
      this.logger.warn('No active devices found for mention notification');
      return;
    }

    // Gửi notifications
    const notifications = devices.map((device) => ({
      token: device.fcm_token,
      notification: {
        title: `🔔 Bạn được nhắc đến`,
        body: message,
      },
      data: {
        type: 'task_mention',
        taskId: data.taskId,
        commentId: data.commentId,
        mentionedBy: data.mentionedBy,
        clickAction: 'OPEN_TASK_COMMENTS',
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'mentions',
          priority: 'high' as const,
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
    }));

    await Promise.allSettled(
      notifications.map((notification) =>
        this.fcmService.sendNotification(notification),
      ),
    );

    // Log vào database
    await Promise.allSettled(
      devices.map((device) =>
        this.logNotification({
          userId: device.user_id,
          type: 'TASK_MENTION',
          taskId: data.taskId,
          message,
        }),
      ),
    );

    this.logger.log(`Mention notifications sent to ${devices.length} users`);
  } catch (error) {
    this.logger.error(`Failed to send mention notification:`, error);
  }
}
```

**Step 3: Update createComment để detect mentions**

```typescript
// File: src/modules/tasks/tasks.service.ts

import { MentionDetector } from '../../common/utils/mention-detector';

async createComment(
  taskId: string,
  userId: string,
  body: string,
): Promise<task_comments> {
  // ... existing code để tạo comment ...

  // 3a. Detect mentions
  const mentions = MentionDetector.extractAllMentions(body);
  
  // Nếu có userIds từ rich mentions, sử dụng trực tiếp
  let mentionedUserIds = mentions.userIds;

  // Nếu có usernames, tìm user IDs tương ứng
  if (mentions.usernames.length > 0 && mentionedUserIds.length === 0) {
    // Option 1: Tìm trong project members
    const projectMembers = await this.prisma.memberships.findMany({
      where: {
        workspaces: {
          projects: {
            some: {
              id: task.project_id,
            },
          },
        },
        users: {
          name: {
            in: mentions.usernames,
            mode: 'insensitive', // Case-insensitive
          },
        },
      },
      select: {
        user_id: true,
      },
    });

    mentionedUserIds = projectMembers.map((m) => m.user_id);
  }

  // 3b. 🔔 Gửi MENTION notification (priority cao hơn)
  if (mentionedUserIds.length > 0) {
    // Loại bỏ người comment khỏi danh sách
    const filteredMentions = mentionedUserIds.filter((id) => id !== userId);
    
    if (filteredMentions.length > 0) {
      await this.notificationsService.sendTaskMention({
        taskId: task.id,
        taskTitle: task.title,
        commentId: comment.id,
        commentBody: body,
        mentionedBy: userId,
        mentionedByName: comment.users.name,
        mentionedUserIds: filteredMentions,
      });
    }
  }

  // 3c. 🔔 Gửi COMMENT notification cho những người còn lại
  // (đã implement ở Use Case 2, nhưng cần loại bỏ những người đã nhận mention notification)
  const recipientSet = new Set<string>();

  if (task.assignee_id && task.assignee_id !== userId) {
    recipientSet.add(task.assignee_id);
  }

  if (task.created_by && task.created_by !== userId) {
    recipientSet.add(task.created_by);
  }

  task.watchers.forEach((watcher) => {
    if (watcher.user_id !== userId) {
      recipientSet.add(watcher.user_id);
    }
  });

  // Loại bỏ những người đã nhận mention notification
  mentionedUserIds.forEach((id) => recipientSet.delete(id));

  const recipientIds = Array.from(recipientSet);

  if (recipientIds.length > 0) {
    await this.notificationsService.sendTaskCommented({
      taskId: task.id,
      taskTitle: task.title,
      commentId: comment.id,
      commentBody: body,
      commentedBy: userId,
      commentedByName: comment.users.name,
      recipientIds,
    });
  }

  return comment;
}
```

---

### ✅ USE CASE 4: TASK_MOVED

#### **Kịch bản:**
- Task được di chuyển từ board này sang board khác
- Assignee + Watchers nhận notification

#### **Trigger Point:**
- `TasksService.move()` - sau khi move task

#### **Implementation:**

**Step 1: Thêm method vào NotificationsService**

```typescript
// File: src/modules/notifications/notifications.service.ts

/**
 * Gửi notification khi task được move sang board khác
 */
async sendTaskMoved(data: {
  taskId: string;
  taskTitle: string;
  fromBoardName: string;
  toBoardName: string;
  movedBy: string;
  movedByName: string;
  recipientIds: string[];
}): Promise<void> {
  try {
    const message = `${data.movedByName} đã chuyển task từ "${data.fromBoardName}" sang "${data.toBoardName}"`;

    const devices = await this.prisma.user_devices.findMany({
      where: {
        user_id: { in: data.recipientIds },
        is_active: true,
      },
      orderBy: { last_active_at: 'desc' },
      distinct: ['user_id'],
    });

    if (devices.length === 0) return;

    const notifications = devices.map((device) => ({
      token: device.fcm_token,
      notification: {
        title: `📦 Task đã di chuyển`,
        body: message,
      },
      data: {
        type: 'task_moved',
        taskId: data.taskId,
        fromBoardName: data.fromBoardName,
        toBoardName: data.toBoardName,
        movedBy: data.movedBy,
        clickAction: 'OPEN_TASK_DETAIL',
      },
      android: {
        priority: 'normal' as const,
        notification: {
          channelId: 'task_updates',
          priority: 'default' as const,
          defaultSound: true,
        },
      },
    }));

    await Promise.allSettled(
      notifications.map((n) => this.fcmService.sendNotification(n)),
    );

    await Promise.allSettled(
      devices.map((device) =>
        this.logNotification({
          userId: device.user_id,
          type: 'TASK_MOVED',
          taskId: data.taskId,
          message,
        }),
      ),
    );

    this.logger.log(`Task moved notifications sent to ${devices.length} users`);
  } catch (error) {
    this.logger.error(`Failed to send task moved notification:`, error);
  }
}
```

**Step 2: Update TasksService.move()**

```typescript
// File: src/modules/tasks/tasks.service.ts

async move(
  id: string,
  toBoardId: string,
  beforeId?: string,
  afterId?: string,
  movedBy?: string, // ← Thêm tham số
): Promise<tasks> {
  // 1. Lấy thông tin task hiện tại
  const currentTask = await this.prisma.tasks.findUnique({
    where: { id },
    include: {
      boards: {
        select: { id: true, name: true },
      },
      users_tasks_assignee_idTousers: {
        select: { id: true },
      },
      watchers: {
        select: { user_id: true },
      },
    },
  });

  if (!currentTask) {
    throw new NotFoundException(`Task with ID ${id} not found`);
  }

  const fromBoardId = currentTask.board_id;
  const fromBoardName = currentTask.boards.name;

  // 2. Lấy thông tin board đích
  const toBoard = await this.prisma.boards.findUnique({
    where: { id: toBoardId },
    select: { name: true },
  });

  if (!toBoard) {
    throw new NotFoundException(`Board with ID ${toBoardId} not found`);
  }

  // 3. Tính position mới (existing logic)
  // ... your existing position calculation ...

  // 4. Update task
  const movedTask = await this.prisma.tasks.update({
    where: { id },
    data: {
      board_id: toBoardId,
      position: newPosition,
    },
  });

  // 5. 🔔 TRIGGER NOTIFICATION nếu move sang board khác
  if (fromBoardId !== toBoardId) {
    const recipientSet = new Set<string>();

    if (currentTask.assignee_id && currentTask.assignee_id !== movedBy) {
      recipientSet.add(currentTask.assignee_id);
    }

    currentTask.watchers.forEach((watcher) => {
      if (watcher.user_id !== movedBy) {
        recipientSet.add(watcher.user_id);
      }
    });

    const recipientIds = Array.from(recipientSet);

    if (recipientIds.length > 0) {
      // Lấy thông tin người move
      const mover = movedBy
        ? await this.prisma.users.findUnique({
            where: { id: movedBy },
            select: { name: true },
          })
        : null;

      await this.notificationsService.sendTaskMoved({
        taskId: currentTask.id,
        taskTitle: currentTask.title,
        fromBoardName,
        toBoardName: toBoard.name,
        movedBy: movedBy || 'system',
        movedByName: mover?.name || 'Hệ thống',
        recipientIds,
      });
    }
  }

  return movedTask;
}
```

---

## 📋 PHASE 3: SCHEDULED NOTIFICATIONS

Các notification này được trigger bởi **Worker Jobs** (Cron).

---

### ✅ USE CASE 5: MEETING_REMINDER

#### **Kịch bản:**
- 15 phút trước khi event/meeting bắt đầu
- Tất cả participants nhận notification

#### **Trigger Point:**
- Worker job chạy mỗi 5 phút, check events sắp diễn ra

#### **Implementation:**

**Step 1: Thêm method vào NotificationsService**

```typescript
// File: src/modules/notifications/notifications.service.ts

/**
 * Gửi meeting reminder notification
 */
async sendMeetingReminder(data: {
  eventId: string;
  eventTitle: string;
  startAt: Date;
  location?: string;
  meetLink?: string;
  participantIds: string[];
}): Promise<void> {
  try {
    const timeUntilStart = this.getTimeUntilStart(data.startAt);
    let message = `Meeting "${data.eventTitle}" sẽ bắt đầu trong ${timeUntilStart}`;

    if (data.location) {
      message += ` tại ${data.location}`;
    }

    const devices = await this.prisma.user_devices.findMany({
      where: {
        user_id: { in: data.participantIds },
        is_active: true,
      },
      orderBy: { last_active_at: 'desc' },
      distinct: ['user_id'],
    });

    if (devices.length === 0) return;

    const notifications = devices.map((device) => ({
      token: device.fcm_token,
      notification: {
        title: '📅 Nhắc nhở Meeting',
        body: message,
      },
      data: {
        type: 'meeting_reminder',
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        startAt: data.startAt.toISOString(),
        location: data.location || '',
        meetLink: data.meetLink || '',
        clickAction: 'OPEN_EVENT_DETAIL',
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'meeting_reminders',
          priority: 'high' as const,
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
    }));

    await Promise.allSettled(
      notifications.map((n) => this.fcmService.sendNotification(n)),
    );

    await Promise.allSettled(
      devices.map((device) =>
        this.logNotification({
          userId: device.user_id,
          type: 'MEETING_REMINDER',
          message,
        }),
      ),
    );

    this.logger.log(
      `Meeting reminder sent to ${devices.length} participants`,
    );
  } catch (error) {
    this.logger.error(`Failed to send meeting reminder:`, error);
  }
}

/**
 * Helper: Calculate time until event starts
 */
private getTimeUntilStart(startAt: Date): string {
  const now = new Date();
  const diff = startAt.getTime() - now.getTime();
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) {
    return 'vài giây';
  } else if (minutes < 60) {
    return `${minutes} phút`;
  } else {
    const hours = Math.floor(minutes / 60);
    return `${hours} giờ`;
  }
}
```

**Step 2: Thêm Worker Job**

```typescript
// File: src/modules/worker/worker.service.ts

/**
 * Gửi meeting reminders cho events sắp diễn ra
 * Chạy mỗi 5 phút
 */
async sendMeetingReminders(): Promise<{
  success: boolean;
  sent: number;
  failed: number;
}> {
  this.logger.log('Starting meeting reminders job...');

  const now = new Date();
  const reminderWindow = new Date(now.getTime() + 15 * 60 * 1000); // 15 phút sau

  try {
    // Lấy events sắp bắt đầu trong 15 phút
    // và chưa gửi reminder (cần thêm flag hoặc check log)
    const upcomingEvents = await this.prisma.events.findMany({
      where: {
        start_at: {
          gte: now,
          lte: reminderWindow,
        },
        // TODO: Thêm điều kiện để tránh gửi duplicate
        // Có thể check trong notifications table
      },
      include: {
        participants: {
          where: {
            status: {
              in: ['ACCEPTED', 'TENTATIVE'],
            },
          },
          select: {
            user_id: true,
          },
        },
      },
    });

    this.logger.log(`Found ${upcomingEvents.length} upcoming events`);

    let sent = 0;
    let failed = 0;

    for (const event of upcomingEvents) {
      // Lấy danh sách participant IDs
      const participantIds = event.participants
        .map((p) => p.user_id)
        .filter((id): id is string => id !== null);

      if (participantIds.length === 0) {
        failed++;
        continue;
      }

      try {
        // Check xem đã gửi reminder chưa
        const existingReminder = await this.prisma.notifications.findFirst({
          where: {
            type: 'MEETING_REMINDER',
            data: {
              path: ['eventId'],
              equals: event.id,
            },
            created_at: {
              gte: new Date(now.getTime() - 20 * 60 * 1000), // Trong 20 phút gần đây
            },
          },
        });

        if (existingReminder) {
          this.logger.log(`Reminder already sent for event ${event.id}`);
          continue;
        }

        await this.notificationsService.sendMeetingReminder({
          eventId: event.id,
          eventTitle: event.title,
          startAt: event.start_at,
          location: event.location ?? undefined,
          meetLink: event.meet_link ?? undefined,
          participantIds,
        });

        sent++;
        this.logger.log(`Sent meeting reminder for event ${event.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to send meeting reminder for event ${event.id}:`,
          error,
        );
        failed++;
      }
    }

    this.logger.log(
      `Meeting reminders job completed: ${sent} sent, ${failed} failed`,
    );

    return {
      success: true,
      sent,
      failed,
    };
  } catch (error) {
    this.logger.error('Error in sendMeetingReminders:', error);
    throw error;
  }
}
```

**Step 3: Thêm endpoint vào WorkerController**

```typescript
// File: src/modules/worker/worker.controller.ts

@Post('meeting-reminders')
@HttpCode(HttpStatus.OK)
async sendMeetingReminders(
  @Headers('authorization') authHeader: string,
): Promise<any> {
  this.logger.log('Received meeting reminders request');

  if (!this.validateWorkerToken(authHeader)) {
    throw new UnauthorizedException('Invalid worker token');
  }

  const result = await this.workerService.sendMeetingReminders();

  return {
    job: 'meeting-reminders',
    timestamp: new Date().toISOString(),
    ...result,
  };
}
```

---

### ✅ USE CASE 6: EVENT_INVITE

#### **Kịch bản:**
- User A mời User B vào event/meeting
- User B nhận notification ngay lập tức (real-time)

#### **Trigger Point:**
- Khi thêm participant vào event

#### **Implementation:**

**Step 1: Thêm method vào NotificationsService**

```typescript
// File: src/modules/notifications/notifications.service.ts

/**
 * Gửi notification khi user được mời vào event
 */
async sendEventInvite(data: {
  eventId: string;
  eventTitle: string;
  startAt: Date;
  endAt: Date;
  location?: string;
  meetLink?: string;
  invitedBy: string;
  invitedByName: string;
  inviteeIds: string[];
}): Promise<void> {
  try {
    const startTime = data.startAt.toLocaleString('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    let message = `${data.invitedByName} đã mời bạn tham gia "${data.eventTitle}" vào ${startTime}`;

    if (data.location) {
      message += ` tại ${data.location}`;
    }

    const devices = await this.prisma.user_devices.findMany({
      where: {
        user_id: { in: data.inviteeIds },
        is_active: true,
      },
      orderBy: { last_active_at: 'desc' },
      distinct: ['user_id'],
    });

    if (devices.length === 0) return;

    const notifications = devices.map((device) => ({
      token: device.fcm_token,
      notification: {
        title: '📅 Lời mời Meeting',
        body: message,
      },
      data: {
        type: 'event_invite',
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        startAt: data.startAt.toISOString(),
        endAt: data.endAt.toISOString(),
        location: data.location || '',
        meetLink: data.meetLink || '',
        invitedBy: data.invitedBy,
        clickAction: 'OPEN_EVENT_DETAIL',
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'event_invites',
          priority: 'high' as const,
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
    }));

    await Promise.allSettled(
      notifications.map((n) => this.fcmService.sendNotification(n)),
    );

    await Promise.allSettled(
      devices.map((device) =>
        this.logNotification({
          userId: device.user_id,
          type: 'EVENT_INVITE',
          message,
        }),
      ),
    );

    this.logger.log(`Event invites sent to ${devices.length} users`);
  } catch (error) {
    this.logger.error(`Failed to send event invite:`, error);
  }
}
```

**Step 2: Tạo/Update EventsService (nếu chưa có)**

```typescript
// File: src/modules/events/events.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Thêm participants vào event
   */
  async addParticipants(
    eventId: string,
    participantEmails: string[],
    invitedBy: string,
  ): Promise<void> {
    // 1. Lấy thông tin event
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // 2. Tìm users từ emails
    const users = await this.prisma.users.findMany({
      where: {
        email: {
          in: participantEmails,
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (users.length === 0) {
      throw new NotFoundException('No valid users found with provided emails');
    }

    // 3. Thêm participants
    await this.prisma.participants.createMany({
      data: users.map((user) => ({
        event_id: eventId,
        user_id: user.id,
        email: user.email,
        status: 'INVITED',
      })),
      skipDuplicates: true,
    });

    // 4. 🔔 TRIGGER EVENT_INVITE notification
    const inviter = await this.prisma.users.findUnique({
      where: { id: invitedBy },
      select: { name: true },
    });

    await this.notificationsService.sendEventInvite({
      eventId: event.id,
      eventTitle: event.title,
      startAt: event.start_at,
      endAt: event.end_at,
      location: event.location ?? undefined,
      meetLink: event.meet_link ?? undefined,
      invitedBy,
      invitedByName: inviter?.name || 'Hệ thống',
      inviteeIds: users.map((u) => u.id),
    });
  }
}
```

---

## 📋 PHASE 4: HELPER UTILITIES

### Update logNotification method

```typescript
// File: src/modules/notifications/notifications.service.ts

/**
 * Log notification to database (Updated version)
 */
private async logNotification(data: {
  userId: string;
  type: string;
  taskId?: string;
  message: string;
}): Promise<void> {
  try {
    // Expanded type mapping
    const notificationType = this.mapNotificationType(data.type);

    await this.prisma.notifications.create({
      data: {
        user_id: data.userId,
        type: notificationType as any,
        title: this.getNotificationTitle(data.type),
        body: data.message,
        channel: 'PUSH',
        priority: this.getNotificationPriority(data.type),
        status: 'SENT',
        sent_at: new Date(),
        data: data.taskId ? { taskId: data.taskId } : undefined,
      },
    });
  } catch (error) {
    this.logger.error('Failed to log notification:', error);
  }
}

/**
 * Expanded type mapping
 */
private mapNotificationType(type: string): string {
  const typeMap: Record<string, string> = {
    // Existing
    task_reminder: 'TIME_REMINDER',
    TIME_REMINDER: 'TIME_REMINDER',
    daily_summary: 'SYSTEM',
    SYSTEM: 'SYSTEM',
    
    // New mappings
    task_assigned: 'TASK_ASSIGNED',
    TASK_ASSIGNED: 'TASK_ASSIGNED',
    task_commented: 'TASK_COMMENTED',
    TASK_COMMENTED: 'TASK_COMMENTED',
    task_mention: 'TASK_MENTION',
    TASK_MENTION: 'TASK_MENTION',
    task_moved: 'TASK_MOVED',
    TASK_MOVED: 'TASK_MOVED',
    meeting_reminder: 'MEETING_REMINDER',
    MEETING_REMINDER: 'MEETING_REMINDER',
    event_invite: 'EVENT_INVITE',
    EVENT_INVITE: 'EVENT_INVITE',
  };
  return typeMap[type] || 'SYSTEM';
}

/**
 * Get notification title based on type
 */
private getNotificationTitle(type: string): string {
  const titleMap: Record<string, string> = {
    // Existing
    task_reminder: 'Nhắc nhở Task',
    TIME_REMINDER: 'Nhắc nhở Task',
    daily_summary: 'Tổng kết ngày',
    SYSTEM: 'Thông báo hệ thống',
    
    // New titles
    task_assigned: 'Task Mới',
    TASK_ASSIGNED: 'Task Mới',
    task_commented: 'Comment Mới',
    TASK_COMMENTED: 'Comment Mới',
    task_mention: 'Bạn được nhắc đến',
    TASK_MENTION: 'Bạn được nhắc đến',
    task_moved: 'Task Di Chuyển',
    TASK_MOVED: 'Task Di Chuyển',
    meeting_reminder: 'Nhắc nhở Meeting',
    MEETING_REMINDER: 'Nhắc nhở Meeting',
    event_invite: 'Lời mời Meeting',
    EVENT_INVITE: 'Lời mời Meeting',
  };
  return titleMap[type] || 'Thông báo';
}

/**
 * Get notification priority based on type
 */
private getNotificationPriority(type: string): 'HIGH' | 'NORMAL' | 'LOW' {
  const highPriority = [
    'TASK_ASSIGNED',
    'TASK_MENTION',
    'TIME_REMINDER',
    'MEETING_REMINDER',
    'EVENT_INVITE',
  ];

  const normalPriority = [
    'TASK_COMMENTED',
    'TASK_MOVED',
    'TASK_STATUS_CHANGED',
  ];

  const mappedType = this.mapNotificationType(type);

  if (highPriority.includes(mappedType)) return 'HIGH';
  if (normalPriority.includes(mappedType)) return 'NORMAL';
  return 'LOW';
}
```

---

## 📋 PHASE 5: TESTING PLAN

### Test Case 1: TASK_ASSIGNED
```http
### Create task with assignee
POST http://localhost:3000/api/tasks
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "projectId": "{{projectId}}",
  "boardId": "{{boardId}}",
  "title": "Test notification - Task assigned",
  "assigneeId": "{{otherUserId}}"
}

### Expected: User {{otherUserId}} nhận notification "Task Mới"
```

### Test Case 2: TASK_COMMENTED
```http
### Create comment
POST http://localhost:3000/api/tasks/{{taskId}}/comments
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "body": "This is a test comment for notification"
}

### Expected: Assignee + Creator + Watchers nhận notification "Comment Mới"
```

### Test Case 3: TASK_MENTION
```http
### Create comment with mention
POST http://localhost:3000/api/tasks/{{taskId}}/comments
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "body": "Hey @john, can you check this? Also @[Jane Doe]({{janeUserId}})"
}

### Expected: 
### - John và Jane nhận notification "Bạn được nhắc đến" (HIGH priority)
### - Assignee/Creator/Watchers khác nhận "Comment Mới" (NORMAL priority)
```

### Test Case 4: TASK_MOVED
```http
### Move task
PATCH http://localhost:3000/api/tasks/{{taskId}}/move
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "toBoardId": "{{newBoardId}}"
}

### Expected: Assignee + Watchers nhận notification "Task Di Chuyển"
```

### Test Case 5: MEETING_REMINDER (Worker)
```http
### Trigger worker job
POST http://localhost:3000/api/worker/meeting-reminders
Authorization: Bearer {{worker_secret}}

### Expected: Participants của events trong 15 phút tới nhận notification
```

---

## 📋 PHASE 6: DEPLOYMENT CHECKLIST

### Backend Deployment
- [ ] Update Prisma schema với notification types mới
- [ ] Run migration: `npx prisma migrate dev`
- [ ] Deploy NotificationsService với tất cả methods mới
- [ ] Update TasksService với notification triggers
- [ ] Create/Update EventsService
- [ ] Add MentionDetector utility
- [ ] Update WorkerService với meeting reminders job
- [ ] Update WorkerController với endpoint mới
- [ ] Update module dependencies (imports/exports)
- [ ] Set environment variables (WORKER_SECRET_TOKEN)

### Cron Setup (Render/External)
```yaml
# Meeting reminders - Every 5 minutes
*/5 * * * * curl -X POST https://your-api.com/api/worker/meeting-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN"

# Task reminders - Daily at 8 AM
0 8 * * * curl -X POST https://your-api.com/api/worker/upcoming-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN"

# Overdue reminders - Daily at 9 AM
0 9 * * * curl -X POST https://your-api.com/api/worker/overdue-reminders \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN"

# Daily summary - Daily at 6 PM
0 18 * * * curl -X POST https://your-api.com/api/worker/daily-summary \
  -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
```

### Android App Updates (Frontend)
- [ ] Add FCM channel IDs:
  - `task_updates`
  - `task_comments`
  - `mentions`
  - `meeting_reminders`
  - `event_invites`
- [ ] Handle các notification types mới trong `FirebaseMessagingService`
- [ ] Implement click actions:
  - `OPEN_TASK_DETAIL`
  - `OPEN_TASK_COMMENTS`
  - `OPEN_EVENT_DETAIL`
- [ ] Test notification UI trên Android

---

## 📊 MONITORING & METRICS

### Metrics cần track:
```typescript
// Có thể thêm vào NotificationsService

private metrics = {
  sent: 0,
  failed: 0,
  byType: {} as Record<string, number>,
};

async getMetrics() {
  return {
    ...this.metrics,
    timestamp: new Date().toISOString(),
  };
}
```

### Database Queries for Analytics
```sql
-- Notification delivery rate
SELECT 
  type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'READ' THEN 1 END) as read
FROM notifications
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY type;

-- User engagement
SELECT 
  user_id,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read_count,
  ROUND(COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as read_rate
FROM notifications
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY read_rate DESC;
```

---

## 🎯 SUMMARY

### Priority Implementation Order:

**Week 1 (Critical):**
1. ✅ Database schema migration
2. ✅ TASK_ASSIGNED notification
3. ✅ TASK_COMMENTED notification
4. ✅ Update TasksService integration
5. ✅ Testing

**Week 2 (Important):**
6. ✅ TASK_MENTION detection & notification
7. ✅ TASK_MOVED notification
8. ✅ EVENT_INVITE notification
9. ✅ EventsService creation
10. ✅ Testing

**Week 3 (Enhancement):**
11. ✅ MEETING_REMINDER worker job
12. ✅ Worker endpoint & cron setup
13. ✅ Analytics & monitoring
14. ✅ Performance optimization
15. ✅ Full system testing

---

## 📚 REFERENCES

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Prisma Enum Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#defining-enums)
- [NestJS Modules Documentation](https://docs.nestjs.com/modules)
- [Android FCM Implementation](https://firebase.google.com/docs/cloud-messaging/android/client)

---

**Document Version:** 1.0  
**Last Updated:** October 21, 2025  
**Author:** Development Team
