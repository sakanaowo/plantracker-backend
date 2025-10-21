# Firebase Cloud Messaging - Backend Setup Guide

## 📋 Tổng Quan
Hướng dẫn setup Firebase Cloud Messaging (FCM) cho backend NestJS để gửi push notifications đến Android client.

---

## 🔧 1. Cài Đặt & Cấu Hình

### ✅ Dependencies (Đã có)
```json
{
  "firebase-admin": "^13.5.0"
}
```

### 📄 2. Lấy Service Account Key

1. Truy cập [Firebase Console](https://console.firebase.google.com)
2. Chọn project **Plantracker**
3. Vào **⚙️ Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Lưu file JSON vào `src/config/firebase-service-account.json`

⚠️ **QUAN TRỌNG**: Thêm file này vào `.gitignore`:
```gitignore
# Firebase
src/config/firebase-service-account.json
firebase-service-account.json
```

---

## 🏗️ 3. Tạo FCM Module

### File Structure
```
src/
├── fcm/
│   ├── fcm.module.ts
│   ├── fcm.service.ts
│   ├── fcm.controller.ts
│   └── dto/
│       ├── send-notification.dto.ts
│       └── send-topic-notification.dto.ts
```

### 3.1 FCM Module (`src/fcm/fcm.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { FcmController } from './fcm.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [FcmController],
  providers: [FcmService, PrismaService],
  exports: [FcmService],
})
export class FcmModule {}
```

### 3.2 FCM Service (`src/fcm/fcm.service.ts`)

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Message } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    try {
      // Initialize Firebase Admin SDK
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  /**
   * Gửi notification đến một device cụ thể
   */
  async sendToDevice(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    try {
      const message: Message = {
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'plantracker_notifications',
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message to device: ${response}`);
      return response;
    } catch (error) {
      this.logger.error('Error sending message to device', error);
      throw error;
    }
  }

  /**
   * Gửi notification đến nhiều devices
   */
  async sendToMultipleDevices(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<admin.messaging.BatchResponse> {
    try {
      const messages: Message[] = fcmTokens.map((token) => ({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'plantracker_notifications',
          },
        },
      }));

      const response = await admin.messaging().sendEach(messages);
      this.logger.log(
        `Successfully sent ${response.successCount} messages out of ${fcmTokens.length}`,
      );
      return response;
    } catch (error) {
      this.logger.error('Error sending messages to multiple devices', error);
      throw error;
    }
  }

  /**
   * Gửi notification đến một topic
   */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    try {
      const message: Message = {
        topic,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'plantracker_notifications',
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message to topic ${topic}: ${response}`);
      return response;
    } catch (error) {
      this.logger.error(`Error sending message to topic ${topic}`, error);
      throw error;
    }
  }

  /**
   * Gửi notification cho tất cả members trong workspace
   */
  async sendToWorkspaceMembers(
    workspaceId: number,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      // Lấy danh sách members có FCM token
      const members = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          user: {
            fcmToken: {
              not: null,
            },
          },
        },
        include: {
          user: {
            select: {
              fcmToken: true,
            },
          },
        },
      });

      const fcmTokens = members
        .map((member) => member.user.fcmToken)
        .filter((token): token is string => token !== null);

      if (fcmTokens.length === 0) {
        this.logger.warn(`No FCM tokens found for workspace ${workspaceId}`);
        return;
      }

      await this.sendToMultipleDevices(fcmTokens, title, body, data);
    } catch (error) {
      this.logger.error(
        `Error sending notification to workspace ${workspaceId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Gửi notification cho một user cụ thể
   */
  async sendToUser(
    userId: number,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });

      if (!user?.fcmToken) {
        this.logger.warn(`No FCM token found for user ${userId}`);
        return;
      }

      await this.sendToDevice(user.fcmToken, title, body, data);
    } catch (error) {
      this.logger.error(`Error sending notification to user ${userId}`, error);
      throw error;
    }
  }
}
```

### 3.3 FCM Controller (`src/fcm/fcm.controller.ts`)

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FcmService } from './fcm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendNotificationDto } from './dto/send-notification.dto';
import { SendTopicNotificationDto } from './dto/send-topic-notification.dto';

@ApiTags('FCM')
@ApiBearerAuth()
@Controller('fcm')
@UseGuards(JwtAuthGuard)
export class FcmController {
  constructor(private readonly fcmService: FcmService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send notification to specific device' })
  async sendNotification(@Body() dto: SendNotificationDto) {
    return this.fcmService.sendToDevice(
      dto.fcmToken,
      dto.title,
      dto.body,
      dto.data,
    );
  }

  @Post('send-topic')
  @ApiOperation({ summary: 'Send notification to topic' })
  async sendToTopic(@Body() dto: SendTopicNotificationDto) {
    return this.fcmService.sendToTopic(
      dto.topic,
      dto.title,
      dto.body,
      dto.data,
    );
  }
}
```

### 3.4 DTOs

**`src/fcm/dto/send-notification.dto.ts`**
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({ example: 'dXXXXXX...' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @ApiProperty({ example: 'New Task Assigned' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'You have been assigned to Update Homepage' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({
    example: { type: 'task_assigned', taskId: '123' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}
```

**`src/fcm/dto/send-topic-notification.dto.ts`**
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class SendTopicNotificationDto {
  @ApiProperty({ example: 'workspace_123' })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({ example: 'Workspace Update' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'New project has been created' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({
    example: { type: 'workspace_update', workspaceId: '123' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}
```

---

## 🗄️ 4. Database Schema Update

Thêm field `fcmToken` vào User model:

```prisma
model User {
  id               Int      @id @default(autoincrement())
  email            String   @unique
  password         String?
  username         String?  @unique
  displayName      String?
  avatar           String?
  fcmToken         String?  // FCM Token for push notifications
  googleId         String?  @unique
  isEmailVerified  Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  // ... các relations khác
}
```

Sau đó chạy migration:
```bash
npx prisma migrate dev --name add_fcm_token
```

---

## 👤 5. User API - Save FCM Token

Update User Controller để nhận FCM token từ client:

**`src/modules/users/users.controller.ts`**
```typescript
@Patch('fcm-token')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Update user FCM token' })
async updateFcmToken(
  @Request() req,
  @Body() body: { fcmToken: string },
) {
  const userId = req.user.id;
  return this.usersService.updateFcmToken(userId, body.fcmToken);
}

@Delete('fcm-token')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Clear user FCM token (on logout)' })
async clearFcmToken(@Request() req) {
  const userId = req.user.id;
  return this.usersService.clearFcmToken(userId);
}
```

**`src/modules/users/users.service.ts`**
```typescript
async updateFcmToken(userId: number, fcmToken: string) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { fcmToken },
  });
}

async clearFcmToken(userId: number) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { fcmToken: null },
  });
}
```

---

## 🔔 6. Notification Use Cases

### 6.1 Task Assigned Notification

**`src/modules/tasks/tasks.service.ts`**
```typescript
import { FcmService } from '../../fcm/fcm.service';

constructor(
  private prisma: PrismaService,
  private fcmService: FcmService,
) {}

async assignTask(taskId: number, assigneeId: number, assignedBy: string) {
  const task = await this.prisma.task.update({
    where: { id: taskId },
    data: { assigneeId },
    include: { workspace: true },
  });

  // Send FCM notification
  await this.fcmService.sendToUser(
    assigneeId,
    'New Task Assigned',
    `${assignedBy} assigned you to "${task.title}"`,
    {
      type: 'task_assigned',
      taskId: taskId.toString(),
      workspaceId: task.workspaceId.toString(),
    },
  );

  return task;
}
```

### 6.2 Comment Added Notification

**`src/modules/comments/comments.service.ts`**
```typescript
async createComment(taskId: number, userId: number, content: string) {
  const comment = await this.prisma.comment.create({
    data: {
      taskId,
      userId,
      content,
    },
    include: {
      user: { select: { displayName: true } },
      task: { select: { title: true, assigneeId: true } },
    },
  });

  // Notify task assignee
  if (comment.task.assigneeId && comment.task.assigneeId !== userId) {
    await this.fcmService.sendToUser(
      comment.task.assigneeId,
      'New Comment',
      `${comment.user.displayName}: ${content.substring(0, 50)}...`,
      {
        type: 'comment_added',
        taskId: taskId.toString(),
        commentId: comment.id.toString(),
      },
    );
  }

  return comment;
}
```

### 6.3 Deadline Reminder (Using Scheduled Jobs)

**`src/modules/tasks/tasks-scheduler.service.ts`**
```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from '../../fcm/fcm.service';

@Injectable()
export class TasksSchedulerService {
  constructor(
    private prisma: PrismaService,
    private fcmService: FcmService,
  ) {}

  // Run every hour
  @Cron(CronExpression.EVERY_HOUR)
  async sendDeadlineReminders() {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Find tasks with deadline in next 2 hours
    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: twoHoursLater,
        },
        status: { not: 'DONE' },
        assigneeId: { not: null },
      },
      include: {
        assignee: true,
      },
    });

    for (const task of tasks) {
      if (task.assigneeId) {
        await this.fcmService.sendToUser(
          task.assigneeId,
          'Deadline Reminder',
          `Task "${task.title}" is due in 2 hours!`,
          {
            type: 'deadline_reminder',
            taskId: task.id.toString(),
            dueDate: task.dueDate?.toISOString() || '',
          },
        );
      }
    }
  }
}
```

### 6.4 Workspace Announcement

```typescript
async sendWorkspaceAnnouncement(
  workspaceId: number,
  title: string,
  message: string,
) {
  await this.fcmService.sendToWorkspaceMembers(
    workspaceId,
    title,
    message,
    {
      type: 'workspace_announcement',
      workspaceId: workspaceId.toString(),
    },
  );
}
```

---

## ⚙️ 7. Environment Variables

**`.env`**
```bash
# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"
```

**Hoặc** sử dụng file JSON:
```typescript
// Trong fcm.service.ts
admin.initializeApp({
  credential: admin.credential.cert(
    require('../config/firebase-service-account.json')
  ),
});
```

---

## 📝 8. Import FCM Module

**`src/app.module.ts`**
```typescript
import { FcmModule } from './fcm/fcm.module';

@Module({
  imports: [
    // ... other modules
    FcmModule,
  ],
})
export class AppModule {}
```

---

## 🧪 9. Testing FCM

### 9.1 Test Endpoint với Swagger

1. Chạy backend: `npm run dev`
2. Mở Swagger: `http://localhost:3000/api`
3. Authenticate với JWT token
4. Test endpoint `/fcm/send`:

```json
{
  "fcmToken": "dXXXXXXXXXXXXXXXXXXXX",
  "title": "Test Notification",
  "body": "This is a test from backend",
  "data": {
    "type": "test",
    "timestamp": "2025-10-21T10:00:00Z"
  }
}
```

### 9.2 Test với cURL

```bash
curl -X POST http://localhost:3000/fcm/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fcmToken": "dXXXXXXXXXXXXXXXXXXXX",
    "title": "Test Notification",
    "body": "Hello from backend"
  }'
```

---

## 📊 10. Notification Types Reference

```typescript
// Type definitions for notification data
export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_UPDATED = 'task_updated',
  TASK_COMPLETED = 'task_completed',
  COMMENT_ADDED = 'comment_added',
  DEADLINE_REMINDER = 'deadline_reminder',
  WORKSPACE_ANNOUNCEMENT = 'workspace_announcement',
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
}

// Data payload structure
interface NotificationData {
  type: NotificationType;
  taskId?: string;
  workspaceId?: string;
  commentId?: string;
  userId?: string;
  [key: string]: string | undefined;
}
```

---

## ✅ Checklist

- [ ] Install `firebase-admin` package (✅ Đã có)
- [ ] Download Firebase service account key
- [ ] Add service account key to `.gitignore`
- [ ] Setup environment variables
- [ ] Create FCM module, service, controller
- [ ] Add `fcmToken` field to User schema
- [ ] Run Prisma migration
- [ ] Create API endpoints for saving/clearing FCM token
- [ ] Implement notification use cases (task assigned, comments, etc.)
- [ ] Test FCM with real device/token
- [ ] Setup scheduled jobs for deadline reminders
- [ ] Monitor FCM logs and error handling

---

## 🔒 Security Best Practices

1. ✅ **Never commit** `firebase-service-account.json` to Git
2. ✅ **Use environment variables** for sensitive data
3. ✅ **Validate FCM tokens** before sending notifications
4. ✅ **Rate limit** notification endpoints to prevent spam
5. ✅ **Handle expired tokens** and remove from database
6. ✅ **Log all FCM operations** for debugging
7. ✅ **Use topics** for group notifications instead of sending to many devices

---

## 🐛 Troubleshooting

### Error: "Invalid argument: credential is required"
- Check environment variables are loaded correctly
- Verify service account JSON file path

### Error: "Requested entity was not found"
- Check Firebase project ID is correct
- Verify service account has proper permissions

### Notifications not received on Android
- Check FCM token is valid and saved in database
- Verify Android app is configured correctly (google-services.json)
- Check notification payload format

### High failure rate when sending
- Remove invalid/expired tokens from database
- Implement retry logic for temporary failures

---

## 📚 Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [FCM HTTP v1 API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages)
- [NestJS Documentation](https://docs.nestjs.com/)
