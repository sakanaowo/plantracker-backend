# 📊 BÁO CÁO TIẾN ĐỘ NOTIFICATION SYSTEM

**Ngày kiểm tra:** October 23, 2025  
**Branch:** develop  
**Status:** 🟡 IN PROGRESS (40% Complete)

---

## ✅ ĐÃ TRIỂN KHAI (40%)

### 1. ✅ Infrastructure Layer (100%)

#### FCM Service
- ✅ `src/modules/fcm/fcm.service.ts` - Complete
  - ✅ Firebase Admin SDK initialization
  - ✅ `sendNotification()` method
  - ✅ `sendToDevice()` method
  - ✅ `sendToMultipleDevices()` method
  - ✅ `validateToken()` method

#### Notifications Service (Partial - 40%)
- ✅ `src/modules/notifications/notifications.service.ts`
  - ✅ `sendTaskReminder()` - TIME_REMINDER
  - ✅ `sendDailySummary()` - SYSTEM
  - ✅ `logNotification()` - private helper
  - ✅ `mapNotificationType()` - partial mapping
  - ✅ `getNotificationTitle()` - partial titles
  - ❌ **MISSING**: `sendTaskAssigned()`
  - ❌ **MISSING**: `sendTaskCommented()`
  - ❌ **MISSING**: `sendTaskMention()`
  - ❌ **MISSING**: `sendTaskMoved()`
  - ❌ **MISSING**: `sendEventInvite()`
  - ❌ **MISSING**: `sendMeetingReminder()`

### 2. ✅ Worker Service (60%)

- ✅ `src/modules/worker/worker.service.ts`
  - ✅ `sendUpcomingTaskReminders()` - Complete
  - ✅ `sendOverdueTaskReminders()` - Complete
  - ✅ `sendDailySummary()` - Complete
  - ❌ **MISSING**: `sendMeetingReminders()`

- ✅ `src/modules/worker/worker.controller.ts`
  - ✅ `POST /worker/upcoming-reminders`
  - ✅ `POST /worker/overdue-reminders`
  - ✅ `POST /worker/daily-summary`
  - ✅ `POST /worker/health`
  - ❌ **MISSING**: `POST /worker/meeting-reminders`

### 3. ✅ Database Schema (100%)

- ✅ Prisma schema có đầy đủ enums:
  - ✅ `notification_type` enum (7 types)
  - ✅ `notification_channel` enum
  - ✅ `notification_priority` enum
  - ✅ `notification_status` enum
  - ✅ `notifications` table với đầy đủ fields

---

## ❌ CHƯA TRIỂN KHAI (60%)

### 1. ❌ Real-time Notifications (0%)

#### TASK_ASSIGNED
- ❌ NotificationsService method chưa có
- ❌ TasksService integration chưa có
- ❌ TasksController chưa truyền userId
- ❌ TasksModule chưa import NotificationsModule

**Impact:** 🔴 CRITICAL - User không nhận được thông báo khi được assign task

#### TASK_COMMENTED
- ❌ NotificationsService method chưa có
- ❌ TasksService.createComment() chưa trigger notification
- ❌ Chưa có logic phân biệt recipients (assignee, creator, watchers)

**Impact:** 🔴 CRITICAL - Không có thông báo khi có comment mới

#### TASK_MENTION
- ❌ MentionDetector utility chưa có
- ❌ NotificationsService method chưa có
- ❌ TasksService chưa detect mentions trong comments

**Impact:** 🟡 IMPORTANT - Tính năng @mention không hoạt động

#### TASK_MOVED
- ❌ NotificationsService method chưa có
- ❌ TasksService.move() chưa trigger notification

**Impact:** 🟡 IMPORTANT - User không biết task di chuyển

### 2. ❌ Event Notifications (0%)

#### EVENT_INVITE
- ❌ EventsService chưa tồn tại
- ❌ NotificationsService method chưa có

**Impact:** 🔴 HIGH - Không có thông báo mời meeting

#### MEETING_REMINDER
- ❌ WorkerService method chưa có
- ❌ WorkerController endpoint chưa có
- ❌ Cron job chưa setup

**Impact:** 🟡 IMPORTANT - Không nhắc nhở meeting sắp diễn ra

### 3. ❌ Helper Utilities (0%)

- ❌ `src/common/utils/mention-detector.ts` - Not created
- ❌ Expanded type mappings trong NotificationsService
- ❌ Priority calculation helper

### 4. ❌ Module Dependencies (0%)

- ❌ TasksModule chưa import NotificationsModule
- ❌ EventsModule chưa tạo
- ❌ Circular dependency prevention

---

## 🎯 ROADMAP TRIỂN KHAI

### 📅 PHASE 1: CRITICAL REAL-TIME NOTIFICATIONS (Week 1)

**Priority:** 🔴 URGENT  
**Estimated Time:** 3-4 days  
**Dependencies:** None

#### Day 1-2: TASK_ASSIGNED

1. **Update NotificationsService** ✅
   ```typescript
   // Add method
   async sendTaskAssigned(data: {...})
   
   // Update type mappings
   private mapNotificationType() {
     // Add: task_assigned → TASK_ASSIGNED
   }
   ```

2. **Update TasksService** ✅
   ```typescript
   // Inject NotificationsService
   constructor(
     private prisma: PrismaService,
     private notificationsService: NotificationsService
   )
   
   // Modify create() method
   async create(dto) {
     const task = await this.prisma.tasks.create({...});
     
     // Trigger notification
     if (dto.assigneeId && dto.assigneeId !== dto.createdBy) {
       await this.notificationsService.sendTaskAssigned({...});
     }
     
     return task;
   }
   
   // Modify update() method
   async update(id, dto) {
     // Check if assignee changed
     // Trigger notification if yes
   }
   ```

3. **Update TasksModule** ✅
   ```typescript
   @Module({
     imports: [
       PrismaModule,
       NotificationsModule, // ← Add this
     ],
     providers: [TasksService],
     controllers: [TasksController],
   })
   export class TasksModule {}
   ```

4. **Update TasksController** ✅
   ```typescript
   @Post()
   create(
     @Body() dto: CreateTaskDto,
     @CurrentUser('id') userId: string // ← Add this
   ) {
     return this.svc.create({
       ...dto,
       createdBy: userId // ← Pass userId
     });
   }
   ```

5. **Testing** ✅
   - Test create task with assignee
   - Test update task assignee
   - Verify notification sent
   - Check database log

#### Day 3-4: TASK_COMMENTED

1. **Update NotificationsService** ✅
   ```typescript
   async sendTaskCommented(data: {
     taskId: string;
     commentId: string;
     commentBody: string;
     commentedBy: string;
     commentedByName: string;
     recipientIds: string[];
   })
   ```

2. **Update TasksService.createComment()** ✅
   ```typescript
   async createComment(taskId, userId, body) {
     // ... create comment ...
     
     // Get recipients: assignee + creator + watchers
     const recipientSet = new Set<string>();
     if (task.assignee_id && task.assignee_id !== userId) {
       recipientSet.add(task.assignee_id);
     }
     // ... add creator, watchers ...
     
     // Trigger notification
     await this.notificationsService.sendTaskCommented({...});
   }
   ```

3. **Testing** ✅
   - Test comment notification
   - Verify multiple recipients
   - Check notification not sent to commenter

---

### 📅 PHASE 2: MENTION & MOVE (Week 2)

**Priority:** 🟡 IMPORTANT  
**Estimated Time:** 2-3 days

#### Day 1: TASK_MENTION

1. **Create MentionDetector Utility** ✅
   ```bash
   touch src/common/utils/mention-detector.ts
   ```

2. **Implement Mention Detection** ✅
   ```typescript
   export class MentionDetector {
     static extractAllMentions(text: string): {
       usernames: string[];
       userIds: string[];
     }
   }
   ```

3. **Update NotificationsService** ✅
   ```typescript
   async sendTaskMention(data: {...})
   ```

4. **Integrate into createComment()** ✅

#### Day 2-3: TASK_MOVED

1. **Update NotificationsService** ✅
   ```typescript
   async sendTaskMoved(data: {...})
   ```

2. **Update TasksService.move()** ✅

3. **Testing** ✅

---

### 📅 PHASE 3: EVENT NOTIFICATIONS (Week 2-3)

**Priority:** 🟡 IMPORTANT  
**Estimated Time:** 2-3 days

#### Day 1-2: EVENT_INVITE

1. **Create EventsService** (if not exists) ✅
   ```bash
   nest g module modules/events
   nest g service modules/events
   nest g controller modules/events
   ```

2. **Implement addParticipants()** ✅

3. **Update NotificationsService** ✅
   ```typescript
   async sendEventInvite(data: {...})
   ```

#### Day 3: MEETING_REMINDER

1. **Update WorkerService** ✅
   ```typescript
   async sendMeetingReminders() {
     // Query events in next 15 minutes
     // Send notifications to participants
   }
   ```

2. **Update WorkerController** ✅
   ```typescript
   @Post('meeting-reminders')
   async sendMeetingReminders(@Headers('authorization') authHeader)
   ```

3. **Setup Cron Job** ✅

---

### 📅 PHASE 4: DEPLOYMENT & MONITORING (Week 3)

**Priority:** 🟢 DEPLOYMENT  
**Estimated Time:** 1-2 days

---

## 🔧 CẤU HÌNH CẦN THIẾT

### 1. Environment Variables

**File:** `.env`

```bash
# Firebase
FIREBASE_PROJECT_ID=plantracker-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@plantracker-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE....\n-----END PRIVATE KEY-----\n"

# Worker Authentication
WORKER_SECRET_TOKEN=your-super-secret-worker-token-here-min-32-chars

# Database
NEON_DATABASE_URL=postgresql://user:password@host:5432/database

# Server
PORT=3000
NODE_ENV=production
```

### 2. Render Cron Jobs Configuration

**Service:** PlanTracker Backend  
**Region:** Same as web service  

#### Job 1: Upcoming Task Reminders
```yaml
Name: upcoming-task-reminders
Schedule: 0 8 * * *  # Daily at 8:00 AM
Command: curl -X POST https://your-api.onrender.com/api/worker/upcoming-reminders -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
```

#### Job 2: Overdue Task Reminders
```yaml
Name: overdue-task-reminders
Schedule: 0 9 * * *  # Daily at 9:00 AM
Command: curl -X POST https://your-api.onrender.com/api/worker/overdue-reminders -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
```

#### Job 3: Daily Summary
```yaml
Name: daily-summary
Schedule: 0 18 * * *  # Daily at 6:00 PM
Command: curl -X POST https://your-api.onrender.com/api/worker/daily-summary -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
```

#### Job 4: Meeting Reminders
```yaml
Name: meeting-reminders
Schedule: */5 * * * *  # Every 5 minutes
Command: curl -X POST https://your-api.onrender.com/api/worker/meeting-reminders -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
```

**Cron Schedule Format:**
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
* * * * *
```

**Common Schedules:**
```bash
*/5 * * * *   # Every 5 minutes
*/15 * * * *  # Every 15 minutes
0 * * * *     # Every hour at minute 0
0 8 * * *     # Daily at 8:00 AM
0 9-17 * * *  # Every hour from 9 AM to 5 PM
0 18 * * 1-5  # 6 PM on weekdays
```

### 3. Render Web Service Environment Variables

Go to: **Dashboard → Your Service → Environment**

Add these environment variables:
```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
WORKER_SECRET_TOKEN
NEON_DATABASE_URL
```

⚠️ **Important:** 
- For `FIREBASE_PRIVATE_KEY`: Keep the quotes and `\n` characters
- For `WORKER_SECRET_TOKEN`: Use a strong random string (32+ characters)

---

## 📋 TRIỂN KHAI CHI TIẾT TIẾP THEO

### 🎯 TASK 1: Implement TASK_ASSIGNED Notification

**File:** `src/modules/notifications/notifications.service.ts`

**Bước 1:** Add method vào NotificationsService

```typescript
/**
 * Gửi notification khi task được assign cho user
 */
async sendTaskAssigned(data: {
  taskId: string;
  taskTitle: string;
  projectName: string;
  assigneeId: string;
  assignedBy: string;
  assignedByName: string;
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
          tag: `task_${data.taskId}`,
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

**Bước 2:** Update type mapping

```typescript
private mapNotificationType(type: string): string {
  const typeMap: Record<string, string> = {
    task_reminder: 'TIME_REMINDER',
    TIME_REMINDER: 'TIME_REMINDER',
    daily_summary: 'SYSTEM',
    SYSTEM: 'SYSTEM',
    // ← ADD THESE
    task_assigned: 'TASK_ASSIGNED',
    TASK_ASSIGNED: 'TASK_ASSIGNED',
    task_commented: 'TASK_COMMENTED',
    TASK_COMMENTED: 'TASK_COMMENTED',
  };
  return typeMap[type] || 'SYSTEM';
}

private getNotificationTitle(type: string): string {
  const titleMap: Record<string, string> = {
    task_reminder: 'Nhắc nhở Task',
    TIME_REMINDER: 'Nhắc nhở Task',
    daily_summary: 'Tổng kết ngày',
    SYSTEM: 'Thông báo hệ thống',
    // ← ADD THESE
    task_assigned: 'Task Mới',
    TASK_ASSIGNED: 'Task Mới',
    task_commented: 'Comment Mới',
    TASK_COMMENTED: 'Comment Mới',
  };
  return titleMap[type] || 'Thông báo';
}
```

**Bước 3:** Update TasksModule

```typescript
// File: src/modules/tasks/tasks.module.ts

import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module'; // ← ADD

@Module({
  imports: [
    PrismaModule,
    NotificationsModule, // ← ADD
  ],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
```

**Bước 4:** Update TasksService

```typescript
// File: src/modules/tasks/tasks.service.ts

import { NotificationsService } from '../notifications/notifications.service'; // ← ADD

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService, // ← ADD
  ) {}

  async create(dto: {
    projectId: string;
    boardId: string;
    title: string;
    assigneeId?: string;
    createdBy?: string; // ← ADD
  }): Promise<tasks> {
    const last = await this.prisma.tasks.findFirst({
      where: { board_id: dto.boardId, deleted_at: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPos = last?.position
      ? new Prisma.Decimal(last.position).plus(1024)
      : new Prisma.Decimal(1024);

    const task = await this.prisma.tasks.create({
      data: {
        project_id: dto.projectId,
        board_id: dto.boardId,
        title: dto.title,
        assignee_id: dto.assigneeId ?? null,
        created_by: dto.createdBy ?? null, // ← ADD
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

    // ← ADD: Trigger notification if assignee exists
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
}
```

**Bước 5:** Update TasksController

```typescript
// File: src/modules/tasks/tasks.controller.ts

import { CurrentUser } from '../../auth/current-user.decorator';

@Post()
create(
  @Body() dto: CreateTaskDto,
  @CurrentUser('id') userId: string, // ← ADD
): Promise<tasks> {
  return this.svc.create({
    ...dto,
    createdBy: userId, // ← ADD
  });
}
```

**Bước 6:** Testing

```http
### Test TASK_ASSIGNED notification
POST http://localhost:3000/api/tasks
Authorization: Bearer {{firebase_token}}
Content-Type: application/json

{
  "projectId": "{{projectId}}",
  "boardId": "{{boardId}}",
  "title": "Test notification - Task assigned",
  "assigneeId": "{{otherUserId}}"
}

### Expected:
### - Task created successfully
### - User {{otherUserId}} receives FCM notification
### - Notification logged in database
```

---

### 🎯 TASK 2: Setup Render Cron Jobs

**Bước 1:** Login to Render Dashboard

Go to: https://dashboard.render.com

**Bước 2:** Navigate to Cron Jobs

1. Click **New** → **Cron Job**
2. Or from existing service → **Cron Jobs** tab

**Bước 3:** Create Job - Upcoming Task Reminders

**Configuration:**
```
Name: upcoming-task-reminders
Region: [Same as your web service]
Schedule: 0 8 * * *
Command: curl -X POST https://plantracker-backend.onrender.com/api/worker/upcoming-reminders -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
```

**Environment Variables:**
- Add: `WORKER_SECRET_TOKEN` = (same value as web service)

**Bước 4:** Create Job - Overdue Task Reminders

```
Name: overdue-task-reminders
Region: [Same as your web service]
Schedule: 0 9 * * *
Command: curl -X POST https://plantracker-backend.onrender.com/api/worker/overdue-reminders -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
```

**Bước 5:** Create Job - Daily Summary

```
Name: daily-summary
Region: [Same as your web service]
Schedule: 0 18 * * *
Command: curl -X POST https://plantracker-backend.onrender.com/api/worker/daily-summary -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
```

**Bước 6:** Verify Jobs

- Check **Logs** tab for each job
- Manually trigger: Click **Trigger Run** button
- Monitor execution times

---

## 📊 TRACKING PROGRESS

### Checklist

**Phase 1: Critical Real-time Notifications**
- [ ] TASK_ASSIGNED notification method
- [ ] TasksService.create() integration
- [ ] TasksService.update() integration
- [ ] TasksController userId passing
- [ ] TasksModule dependencies
- [ ] Testing & verification

**Phase 2: Comments & Mentions**
- [ ] TASK_COMMENTED notification method
- [ ] createComment() integration
- [ ] MentionDetector utility
- [ ] TASK_MENTION notification method
- [ ] Mention detection in comments
- [ ] Testing & verification

**Phase 3: Task Movement**
- [ ] TASK_MOVED notification method
- [ ] TasksService.move() integration
- [ ] Testing & verification

**Phase 4: Events**
- [ ] EventsService creation
- [ ] EVENT_INVITE notification method
- [ ] addParticipants() integration
- [ ] MEETING_REMINDER worker method
- [ ] Worker controller endpoint
- [ ] Testing & verification

**Phase 5: Deployment**
- [ ] Render cron jobs setup
- [ ] Environment variables configuration
- [ ] Production testing
- [ ] Monitoring setup

---

## 🎯 NEXT IMMEDIATE ACTIONS

### Tuần này (Week 1):

1. **Day 1-2**: Implement TASK_ASSIGNED
   - Update NotificationsService
   - Update TasksService
   - Update TasksModule
   - Testing

2. **Day 3-4**: Implement TASK_COMMENTED
   - Update NotificationsService
   - Update createComment()
   - Testing

3. **Day 5**: Setup Render Cron Jobs
   - Configure 3 existing jobs
   - Test manual triggers
   - Monitor logs

### Tuần sau (Week 2):

4. **Day 1-2**: TASK_MENTION
5. **Day 3-4**: TASK_MOVED
6. **Day 5**: EVENT_INVITE

---

**Report Generated:** October 23, 2025  
**Next Review:** October 30, 2025  
**Status:** 🟡 40% Complete - On Track
