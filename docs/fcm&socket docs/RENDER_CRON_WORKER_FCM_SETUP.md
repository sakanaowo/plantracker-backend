# Hướng Dẫn Triển Khai Cron Job + Worker trên Render để Tạo Notification với FCM Android

## Mục Lục
1. [Tổng Quan Kiến Trúc](#tổng-quan-kiến-trúc)
2. [Cấu Hình Dự Án](#cấu-hình-dự-án)
3. [Thiết Lập Cron Job trên Render](#thiết-lập-cron-job-trên-render)
4. [Triển Khai Worker Service](#triển-khai-worker-service)
5. [Tích Hợp FCM](#tích-hợp-fcm)
6. [Testing và Monitoring](#testing-và-monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Tổng Quan Kiến Trúc

### Luồng Hoạt Động
```
┌─────────────────┐
│   Cron Job      │  ← Chạy theo lịch (mỗi giờ/ngày)
│   (Render)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Worker API     │  ← Xử lý logic notification
│  Endpoint       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database       │  ← Lấy danh sách tasks/users
│  (PostgreSQL)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FCM Service    │  ← Gửi notification đến thiết bị
│  (Firebase)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Android App    │  ← Nhận và hiển thị notification
└─────────────────┘
```

### Các Thành Phần Chính

1. **Cron Job**: Scheduled job chạy định kỳ trên Render
2. **Worker Endpoint**: API endpoint xử lý logic tạo notification
3. **FCM Service**: Firebase Cloud Messaging để gửi notification
4. **Database**: Lưu trữ thông tin tasks, users, FCM tokens

---

## Cấu Hình Dự Án

### 1. Cài Đặt Dependencies

```bash
npm install --save @nestjs/schedule
npm install --save firebase-admin
npm install --save @nestjs/axios axios
npm install --save-dev @types/cron
```

### 2. Cấu Trúc Thư Mục

```
src/
├── modules/
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.service.ts
│   │   ├── notifications.controller.ts
│   │   ├── dto/
│   │   │   ├── send-notification.dto.ts
│   │   │   └── notification-payload.dto.ts
│   │   └── interfaces/
│   │       └── notification.interface.ts
│   ├── fcm/
│   │   ├── fcm.module.ts
│   │   ├── fcm.service.ts
│   │   └── fcm.config.ts
│   └── worker/
│       ├── worker.module.ts
│       ├── worker.service.ts
│       └── worker.controller.ts
└── app.module.ts
```

---

## Thiết Lập Cron Job trên Render

### 1. Tạo Worker Module

**File: `src/modules/worker/worker.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [NotificationsModule, PrismaModule],
  controllers: [WorkerController],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
```

### 2. Tạo Worker Service

**File: `src/modules/worker/worker.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Gửi notification cho tasks sắp đến hạn (trong 24 giờ tới)
   */
  async sendUpcomingTaskReminders(): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    this.logger.log('Starting upcoming task reminders job...');

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
      // Lấy danh sách tasks sắp đến hạn
      const upcomingTasks = await this.prisma.tasks.findMany({
        where: {
          due_at: {
            gte: now,
            lte: tomorrow,
          },
          status: {
            not: 'DONE',
          },
          deleted_at: null, // Chỉ lấy tasks chưa bị xóa
        },
        include: {
          users_tasks_assignee_idTousers: {
            select: {
              id: true,
              name: true,
              user_devices: {
                where: {
                  is_active: true,
                },
                select: {
                  fcm_token: true,
                  platform: true,
                },
                take: 1, // Lấy device active đầu tiên
              },
            },
          },
          projects: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`Found ${upcomingTasks.length} upcoming tasks`);

      let sent = 0;
      let failed = 0;

      // Gửi notification cho từng task
      for (const task of upcomingTasks) {
        const assignee = task.users_tasks_assignee_idTousers;
        const activeDevice = assignee?.user_devices?.[0];
        
        if (!assignee || !activeDevice?.fcm_token) {
          this.logger.warn(
            `Task ${task.id}: User ${assignee?.id || 'unknown'} has no active FCM token, skipping...`,
          );
          failed++;
          continue;
        }

        try {
          const timeUntilDue = this.getTimeUntilDue(task.due_at);

          await this.notificationsService.sendTaskReminder({
            userId: assignee.id,
            fcmToken: activeDevice.fcm_token,
            task: {
              id: task.id,
              title: task.title,
              dueDate: task.due_at,
              projectName: task.projects.name,
            },
            message: `Task "${task.title}" đến hạn trong ${timeUntilDue}`,
          });

          sent++;
          this.logger.log(
            `Sent reminder for task ${task.id} to user ${assignee.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send notification for task ${task.id}:`,
            error,
          );
          failed++;
        }
      }

      this.logger.log(
        `Job completed: ${sent} sent, ${failed} failed out of ${upcomingTasks.length} tasks`,
      );

      return {
        success: true,
        sent,
        failed,
      };
    } catch (error) {
      this.logger.error('Error in sendUpcomingTaskReminders:', error);
      throw error;
    }
  }

  /**
   * Gửi notification cho tasks quá hạn
   */
  async sendOverdueTaskReminders(): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    this.logger.log('Starting overdue task reminders job...');

    const now = new Date();

    try {
      // Lấy danh sách tasks quá hạn
      const overdueTasks = await this.prisma.tasks.findMany({
        where: {
          due_at: {
            lt: now,
          },
          status: {
            not: 'DONE',
          },
          deleted_at: null,
        },
        include: {
          users_tasks_assignee_idTousers: {
            select: {
              id: true,
              name: true,
              user_devices: {
                where: {
                  is_active: true,
                },
                select: {
                  fcm_token: true,
                },
                take: 1,
              },
            },
          },
          projects: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

      let sent = 0;
      let failed = 0;

      for (const task of overdueTasks) {
        const assignee = task.users_tasks_assignee_idTousers;
        const activeDevice = assignee?.user_devices?.[0];
        
        if (!assignee || !activeDevice?.fcm_token) {
          failed++;
          continue;
        }

        try {
          const daysOverdue = this.getDaysOverdue(task.due_at);

          await this.notificationsService.sendTaskReminder({
            userId: assignee.id,
            fcmToken: activeDevice.fcm_token,
            task: {
              id: task.id,
              title: task.title,
              dueDate: task.due_at,
              projectName: task.projects.name,
            },
            message: `⚠️ Task "${task.title}" đã quá hạn ${daysOverdue} ngày`,
          });

          sent++;
        } catch (error) {
          this.logger.error(
            `Failed to send overdue notification for task ${task.id}:`,
            error,
          );
          failed++;
        }
      }

      this.logger.log(
        `Job completed: ${sent} sent, ${failed} failed out of ${overdueTasks.length} tasks`,
      );

      return {
        success: true,
        sent,
        failed,
      };
    } catch (error) {
      this.logger.error('Error in sendOverdueTaskReminders:', error);
      throw error;
    }
  }

  /**
   * Gửi daily summary notification
   */
  async sendDailySummary(): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    this.logger.log('Starting daily summary job...');

    try {
      // Lấy danh sách users có tasks active
      const usersWithTasks = await this.prisma.users.findMany({
        where: {
          user_devices: {
            some: {
              is_active: true,
            },
          },
          tasks_tasks_assignee_idTousers: {
            some: {
              status: {
                not: 'DONE',
              },
              deleted_at: null,
            },
          },
        },
        include: {
          user_devices: {
            where: {
              is_active: true,
            },
            select: {
              fcm_token: true,
            },
            take: 1,
          },
          tasks_tasks_assignee_idTousers: {
            where: {
              status: {
                not: 'DONE',
              },
              deleted_at: null,
            },
            select: {
              id: true,
              title: true,
              due_at: true,
              status: true,
            },
          },
        },
      });

      this.logger.log(`Found ${usersWithTasks.length} users with active tasks`);

      let sent = 0;
      let failed = 0;

      for (const user of usersWithTasks) {
        const activeDevice = user.user_devices?.[0];
        
        if (!activeDevice?.fcm_token) {
          failed++;
          continue;
        }

        try {
          const totalTasks = user.tasks_tasks_assignee_idTousers.length;
          const now = new Date();
          const upcomingTasks = user.tasks_tasks_assignee_idTousers.filter(
            (task) => task.due_at && task.due_at > now,
          ).length;
          const overdueTasks = user.tasks_tasks_assignee_idTousers.filter(
            (task) => task.due_at && task.due_at < now,
          ).length;

          await this.notificationsService.sendDailySummary({
            userId: user.id,
            fcmToken: activeDevice.fcm_token,
            summary: {
              totalTasks,
              upcomingTasks,
              overdueTasks,
            },
          });

          sent++;
        } catch (error) {
          this.logger.error(
            `Failed to send daily summary to user ${user.id}:`,
            error,
          );
          failed++;
        }
      }

      this.logger.log(
        `Job completed: ${sent} sent, ${failed} failed out of ${usersWithTasks.length} users`,
      );

      return {
        success: true,
        sent,
        failed,
      };
    } catch (error) {
      this.logger.error('Error in sendDailySummary:', error);
      throw error;
    }
  }

  /**
   * Helper: Tính thời gian còn lại đến deadline
   */
  private getTimeUntilDue(dueDate: Date): string {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} phút`;
    } else if (hours < 24) {
      return `${hours} giờ`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} ngày`;
    }
  }

  /**
   * Helper: Tính số ngày quá hạn
   */
  private getDaysOverdue(dueDate: Date): number {
    const now = new Date();
    const diff = now.getTime() - dueDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
```

### 3. Tạo Worker Controller

**File: `src/modules/worker/worker.controller.ts`**

```typescript
import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { WorkerService } from './worker.service';

/**
 * Guard để bảo vệ worker endpoints
 * Chỉ cho phép request từ Render Cron Job (với secret token)
 */
@Controller('worker')
export class WorkerController {
  private readonly logger = new Logger(WorkerController.name);

  constructor(private readonly workerService: WorkerService) {}

  /**
   * Validate worker secret token
   */
  private validateWorkerToken(authHeader: string): boolean {
    const workerSecret = process.env.WORKER_SECRET_TOKEN;

    if (!workerSecret) {
      this.logger.error('WORKER_SECRET_TOKEN not configured');
      return false;
    }

    const token = authHeader?.replace('Bearer ', '');
    return token === workerSecret;
  }

  /**
   * Endpoint: Gửi reminder cho tasks sắp đến hạn
   * Được gọi bởi Render Cron Job mỗi giờ
   */
  @Post('upcoming-reminders')
  @HttpCode(HttpStatus.OK)
  async sendUpcomingReminders(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('Received upcoming reminders request');

    if (!this.validateWorkerToken(authHeader)) {
      this.logger.warn('Unauthorized worker request');
      throw new UnauthorizedException('Invalid worker token');
    }

    const result = await this.workerService.sendUpcomingTaskReminders();

    return {
      success: true,
      job: 'upcoming-reminders',
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  /**
   * Endpoint: Gửi reminder cho tasks quá hạn
   * Được gọi bởi Render Cron Job mỗi ngày lúc 9 AM
   */
  @Post('overdue-reminders')
  @HttpCode(HttpStatus.OK)
  async sendOverdueReminders(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('Received overdue reminders request');

    if (!this.validateWorkerToken(authHeader)) {
      throw new UnauthorizedException('Invalid worker token');
    }

    const result = await this.workerService.sendOverdueTaskReminders();

    return {
      success: true,
      job: 'overdue-reminders',
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  /**
   * Endpoint: Gửi daily summary
   * Được gọi bởi Render Cron Job mỗi ngày lúc 8 AM
   */
  @Post('daily-summary')
  @HttpCode(HttpStatus.OK)
  async sendDailySummary(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('Received daily summary request');

    if (!this.validateWorkerToken(authHeader)) {
      throw new UnauthorizedException('Invalid worker token');
    }

    const result = await this.workerService.sendDailySummary();

    return {
      success: true,
      job: 'daily-summary',
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  /**
   * Health check endpoint cho worker
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(@Headers('authorization') authHeader: string): Promise<any> {
    if (!this.validateWorkerToken(authHeader)) {
      throw new UnauthorizedException('Invalid worker token');
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'worker',
    };
  }
}
```

---

## Triển Khai Worker Service

### 1. Tạo Notifications Service

**File: `src/modules/notifications/notifications.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { FcmService } from '../fcm/fcm.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly fcmService: FcmService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Gửi task reminder notification
   */
  async sendTaskReminder(data: {
    userId: string; // UUID string
    fcmToken: string;
    task: {
      id: string; // UUID string
      title: string;
      dueDate: Date;
      projectName: string;
    };
    message: string;
  }): Promise<void> {
    try {
      await this.fcmService.sendNotification({
        token: data.fcmToken,
        notification: {
          title: '📋 Nhắc nhở Task',
          body: data.message,
        },
        data: {
          type: 'task_reminder',
          taskId: data.task.id,
          taskTitle: data.task.title,
          projectName: data.task.projectName,
          dueDate: data.task.dueDate.toISOString(),
          clickAction: 'OPEN_TASK_DETAIL',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'task_reminders',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
      });

      // Log notification to database
      await this.logNotification({
        userId: data.userId,
        type: 'TIME_REMINDER',
        taskId: data.task.id,
        message: data.message,
      });

      this.logger.log(`Task reminder sent to user ${data.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send task reminder:`, error);
      throw error;
    }
  }

  /**
   * Gửi daily summary notification
   */
  async sendDailySummary(data: {
    userId: string; // UUID string
    fcmToken: string;
    summary: {
      totalTasks: number;
      upcomingTasks: number;
      overdueTasks: number;
    };
  }): Promise<void> {
    try {
      const message = this.buildSummaryMessage(data.summary);

      await this.fcmService.sendNotification({
        token: data.fcmToken,
        notification: {
          title: '☀️ Tổng Kết Ngày',
          body: message,
        },
        data: {
          type: 'daily_summary',
          totalTasks: data.summary.totalTasks.toString(),
          upcomingTasks: data.summary.upcomingTasks.toString(),
          overdueTasks: data.summary.overdueTasks.toString(),
          clickAction: 'OPEN_TASKS_LIST',
        },
        android: {
          priority: 'default',
          notification: {
            channelId: 'daily_summary',
            priority: 'default',
            defaultSound: true,
          },
        },
      });

      await this.logNotification({
        userId: data.userId,
        type: 'SYSTEM',
        message,
      });

      this.logger.log(`Daily summary sent to user ${data.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send daily summary:`, error);
      throw error;
    }
  }

  /**
   * Build summary message
   */
  private buildSummaryMessage(summary: {
    totalTasks: number;
    upcomingTasks: number;
    overdueTasks: number;
  }): string {
    const parts: string[] = [];

    parts.push(`Bạn có ${summary.totalTasks} task đang hoạt động`);

    if (summary.upcomingTasks > 0) {
      parts.push(`${summary.upcomingTasks} task sắp đến hạn`);
    }

    if (summary.overdueTasks > 0) {
      parts.push(`${summary.overdueTasks} task quá hạn`);
    }

    return parts.join(', ') + '.';
  }

  /**
   * Log notification to database
   */
  private async logNotification(data: {
    userId: string;
    type: string;
    taskId?: string;
    message: string;
  }): Promise<void> {
    try {
      // Map notification type to enum
      const notificationType = this.mapNotificationType(data.type);
      
      await this.prisma.notifications.create({
        data: {
          user_id: data.userId,
          type: notificationType,
          title: this.getNotificationTitle(data.type),
          body: data.message,
          channel: 'PUSH',
          priority: data.type === 'TIME_REMINDER' ? 'HIGH' : 'NORMAL',
          status: 'SENT',
          sent_at: new Date(),
          data: data.taskId ? { taskId: data.taskId } : undefined,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log notification:', error);
      // Don't throw - logging failure shouldn't break notification sending
    }
  }
  
  /**
   * Map notification type string to enum
   */
  private mapNotificationType(type: string): string {
    const typeMap = {
      'task_reminder': 'TIME_REMINDER',
      'TIME_REMINDER': 'TIME_REMINDER',
      'daily_summary': 'SYSTEM',
      'SYSTEM': 'SYSTEM',
    };
    return typeMap[type] || 'SYSTEM';
  }
  
  /**
   * Get notification title based on type
   */
  private getNotificationTitle(type: string): string {
    const titleMap = {
      'task_reminder': 'Nhắc nhở Task',
      'TIME_REMINDER': 'Nhắc nhở Task',
      'daily_summary': 'Tổng kết ngày',
      'SYSTEM': 'Thông báo hệ thống',
    };
    return titleMap[type] || 'Thông báo';
  }
}
```

### 2. Tạo FCM Service

**File: `src/modules/fcm/fcm.service.ts`**

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Message } from 'firebase-admin/messaging';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);

  async onModuleInit() {
    try {
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        const serviceAccount = JSON.parse(
          process.env.FIREBASE_SERVICE_ACCOUNT || '{}',
        );

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        this.logger.log('Firebase Admin SDK initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  }

  /**
   * Gửi notification đến một thiết bị
   */
  async sendNotification(message: Message): Promise<string> {
    try {
      const response = await admin.messaging().send(message);
      this.logger.log(`Notification sent successfully: ${response}`);
      return response;
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Gửi notification đến nhiều thiết bị
   */
  async sendMulticastNotification(
    tokens: string[],
    notification: {
      title: string;
      body: string;
    },
    data?: Record<string, string>,
  ): Promise<admin.messaging.BatchResponse> {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification,
        data,
        android: {
          priority: 'high',
        },
      };

      const response = await admin.messaging().sendMulticast(message);
      this.logger.log(
        `Multicast sent: ${response.successCount} success, ${response.failureCount} failed`,
      );

      return response;
    } catch (error) {
      this.logger.error('Error sending multicast notification:', error);
      throw error;
    }
  }
}
```

---

## Thiết Lập Cron Job trên Render

### 1. Tạo Cron Jobs trên Render Dashboard

#### A. Upcoming Task Reminders (Chạy mỗi giờ)

```yaml
Name: upcoming-task-reminders
Schedule: 0 * * * * (Every hour)
Command: curl -X POST https://your-api.onrender.com/worker/upcoming-reminders \
  -H "Authorization: Bearer ${WORKER_SECRET_TOKEN}" \
  -H "Content-Type: application/json"
```

#### B. Overdue Task Reminders (Chạy mỗi ngày lúc 9 AM)

```yaml
Name: overdue-task-reminders
Schedule: 0 9 * * * (Daily at 9 AM UTC)
Command: curl -X POST https://your-api.onrender.com/worker/overdue-reminders \
  -H "Authorization: Bearer ${WORKER_SECRET_TOKEN}" \
  -H "Content-Type: application/json"
```

#### C. Daily Summary (Chạy mỗi ngày lúc 8 AM)

```yaml
Name: daily-summary
Schedule: 0 8 * * * (Daily at 8 AM UTC)
Command: curl -X POST https://your-api.onrender.com/worker/daily-summary \
  -H "Authorization: Bearer ${WORKER_SECRET_TOKEN}" \
  -H "Content-Type: application/json"
```

### 2. Cấu Hình Environment Variables trên Render

Vào **Dashboard > Your Service > Environment**:

```bash
# Worker Security
WORKER_SECRET_TOKEN=your-super-secret-token-here-minimum-32-chars

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"..."}

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Timezone (Optional)
TZ=Asia/Ho_Chi_Minh
```

### 3. Cron Expression Reference

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *

Examples:
0 * * * *     - Every hour
0 9 * * *     - Daily at 9 AM
0 8,20 * * *  - Daily at 8 AM and 8 PM
*/30 * * * *  - Every 30 minutes
0 0 * * 0     - Weekly on Sunday at midnight
0 0 1 * *     - Monthly on 1st day at midnight
```

### 4. Tạo render.yaml (Infrastructure as Code)

**File: `render.yaml`** (Tại root của project)

```yaml
services:
  # Main Web Service
  - type: web
    name: plantracker-backend
    env: node
    region: singapore
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm run start:prod
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: plantracker-db
          property: connectionString
      - key: FIREBASE_SERVICE_ACCOUNT
        sync: false
      - key: WORKER_SECRET_TOKEN
        generateValue: true
      - key: JWT_SECRET
        generateValue: true

# Cron Jobs
  - type: cron
    name: upcoming-task-reminders
    env: docker
    schedule: "0 * * * *"
    dockerCommand: >
      curl -X POST https://plantracker-backend.onrender.com/worker/upcoming-reminders
      -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
      -H "Content-Type: application/json"
    
  - type: cron
    name: overdue-task-reminders
    env: docker
    schedule: "0 9 * * *"
    dockerCommand: >
      curl -X POST https://plantracker-backend.onrender.com/worker/overdue-reminders
      -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
      -H "Content-Type: application/json"
    
  - type: cron
    name: daily-summary
    env: docker
    schedule: "0 8 * * *"
    dockerCommand: >
      curl -X POST https://plantracker-backend.onrender.com/worker/daily-summary
      -H "Authorization: Bearer $WORKER_SECRET_TOKEN"
      -H "Content-Type: application/json"

databases:
  - name: plantracker-db
    databaseName: plantracker
    user: plantracker_user
    plan: starter
```

---

## Tích Hợp FCM

### 1. Cấu Hình Prisma Schema

**Schema hiện tại đã hỗ trợ đầy đủ cho FCM notifications:**

```prisma
// Model users - đã có sẵn
model users {
  id           String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name         String
  email        String         @unique
  firebase_uid String         @unique
  // ... other fields
  
  user_devices                   user_devices[]  // FCM tokens
  notifications                  notifications[] // Notification logs
  tasks_tasks_assignee_idTousers tasks[]        // Assigned tasks
}

// Model user_devices - Lưu FCM tokens theo device
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

// Model notifications - Log notification history
model notifications {
  id           String                @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  user_id      String                @db.Uuid
  type         notification_type     // TASK_ASSIGNED, TIME_REMINDER, SYSTEM, etc.
  title        String
  body         String?
  data         Json?                 // Custom data payload
  channel      notification_channel  // PUSH, IN_APP, EMAIL
  priority     notification_priority? // LOW, NORMAL, HIGH
  status       notification_status   // QUEUED, SENT, DELIVERED, READ, FAILED
  scheduled_at DateTime?             @db.Timestamptz(6)
  sent_at      DateTime?             @db.Timestamptz(6)
  delivered_at DateTime?             @db.Timestamptz(6)
  read_at      DateTime?             @db.Timestamptz(6)
  retry_count  Int                   @default(0)
  last_error   String?
  created_at   DateTime              @default(now()) @db.Timestamptz(6)
  
  users users @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  @@index([user_id, status, scheduled_at])
}

// Model tasks - Tasks với due date
model tasks {
  id          String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  title       String
  description String?
  status      issue_status? @default(TO_DO) // TO_DO, IN_PROGRESS, IN_REVIEW, DONE
  priority    priority?     // LOW, MEDIUM, HIGH
  due_at      DateTime?     @db.Timestamptz(6)
  assignee_id String?       @db.Uuid
  project_id  String        @db.Uuid
  deleted_at  DateTime?     @db.Timestamptz(6)
  // ... other fields
  
  users_tasks_assignee_idTousers users?   @relation("tasks_assignee_idTousers", fields: [assignee_id], references: [id])
  projects                       projects @relation(fields: [project_id], references: [id])
  
  @@index([assignee_id])
  @@index([due_at])
  @@index([status])
}

// Enums
enum notification_type {
  TASK_ASSIGNED
  TASK_MOVED
  TIME_REMINDER
  EVENT_INVITE
  EVENT_UPDATED
  MEETING_REMINDER
  SYSTEM
}

enum notification_channel {
  PUSH
  IN_APP
  EMAIL
}

enum notification_priority {
  LOW
  NORMAL
  HIGH
}

enum notification_status {
  QUEUED
  SENT
  DELIVERED
  READ
  FAILED
}

enum issue_status {
  TO_DO
  IN_PROGRESS
  IN_REVIEW
  DONE
}

enum platform {
  ANDROID
  IOS
  WEB
}
```

**✅ Schema đã sẵn sàng - KHÔNG cần migration!**

### 2. Cập Nhật FCM Token từ Android

**File: `src/modules/users/users.controller.ts`**

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register or update FCM token for user's device
   */
  @Post('devices/register')
  @UseGuards(JwtAuthGuard)
  async registerDevice(
    @CurrentUser() user: any,
    @Body() dto: {
      fcmToken: string;
      platform?: 'ANDROID' | 'IOS' | 'WEB';
      deviceModel?: string;
      appVersion?: string;
    },
  ): Promise<any> {
    // Deactivate old devices with same token (in case token changed)
    await this.prisma.user_devices.updateMany({
      where: {
        fcm_token: dto.fcmToken,
      },
      data: {
        is_active: false,
      },
    });

    // Upsert device
    const device = await this.prisma.user_devices.upsert({
      where: {
        fcm_token: dto.fcmToken,
      },
      create: {
        user_id: user.userId,
        fcm_token: dto.fcmToken,
        platform: dto.platform || 'ANDROID',
        device_model: dto.deviceModel,
        app_version: dto.appVersion,
        is_active: true,
        last_active_at: new Date(),
      },
      update: {
        user_id: user.userId,
        is_active: true,
        device_model: dto.deviceModel,
        app_version: dto.appVersion,
        last_active_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Device registered successfully',
      deviceId: device.id,
    };
  }

  /**
   * Deactivate device (on logout)
   */
  @Post('devices/deactivate')
  @UseGuards(JwtAuthGuard)
  async deactivateDevice(
    @CurrentUser() user: any,
    @Body() dto: { fcmToken: string },
  ): Promise<any> {
    await this.prisma.user_devices.updateMany({
      where: {
        user_id: user.userId,
        fcm_token: dto.fcmToken,
      },
      data: {
        is_active: false,
      },
    });

    return {
      success: true,
      message: 'Device deactivated',
    };
  }
}
```

---

## Testing và Monitoring

### 1. Test Locally

```bash
# Test worker endpoint
curl -X POST http://localhost:3000/worker/upcoming-reminders \
  -H "Authorization: Bearer your-local-secret" \
  -H "Content-Type: application/json"

# Test với specific user
curl -X POST http://localhost:3000/worker/daily-summary \
  -H "Authorization: Bearer your-local-secret" \
  -H "Content-Type: application/json"
```

### 2. Test Script

**File: `test-scripts/test-worker.http`**

```http
### Test Upcoming Reminders
POST {{baseUrl}}/worker/upcoming-reminders
Authorization: Bearer {{workerToken}}
Content-Type: application/json

### Test Overdue Reminders
POST {{baseUrl}}/worker/overdue-reminders
Authorization: Bearer {{workerToken}}
Content-Type: application/json

### Test Daily Summary
POST {{baseUrl}}/worker/daily-summary
Authorization: Bearer {{workerToken}}
Content-Type: application/json

### Health Check
POST {{baseUrl}}/worker/health
Authorization: Bearer {{workerToken}}
```

### 3. Monitoring Dashboard

**File: `src/modules/worker/worker.monitoring.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkerMonitoringService {
  private readonly logger = new Logger(WorkerMonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy thống kê notification trong 24h qua
   */
  async getNotificationStats(): Promise<any> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await this.prisma.notificationLog.groupBy({
      by: ['type'],
      where: {
        sentAt: {
          gte: oneDayAgo,
        },
      },
      _count: {
        id: true,
      },
    });

    return stats;
  }

  /**
   * Lấy users không có FCM token
   */
  async getUsersWithoutFcmToken(): Promise<any> {
    const users = await this.prisma.user.findMany({
      where: {
        fcmToken: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return users;
  }
}
```

### 4. Logging Best Practices

```typescript
// Structured logging
this.logger.log({
  message: 'Notification sent',
  userId: user.id,
  taskId: task.id,
  type: 'task_reminder',
  timestamp: new Date().toISOString(),
});

// Error logging with context
this.logger.error({
  message: 'Failed to send notification',
  error: error.message,
  stack: error.stack,
  userId: user.id,
  fcmToken: user.fcmToken ? 'present' : 'missing',
});
```

---

## Troubleshooting

### 1. Common Issues

#### Issue: Cron job không chạy

**Solution:**
```bash
# Check logs trên Render Dashboard
# Verify cron expression tại: https://crontab.guru/
# Kiểm tra timezone setting (default là UTC)
```

#### Issue: 401 Unauthorized khi gọi worker endpoint

**Solution:**
```typescript
// Kiểm tra WORKER_SECRET_TOKEN trong environment variables
// Verify Authorization header format: "Bearer <token>"
// Check logs để xem token có đúng không
```

#### Issue: FCM notification không gửi được

**Solution:**
```typescript
// 1. Verify Firebase credentials
console.log(process.env.FIREBASE_SERVICE_ACCOUNT);

// 2. Check FCM token validity
await admin.messaging().send({
  token: userToken,
  notification: {
    title: 'Test',
    body: 'Test notification',
  },
});

// 3. Check Android app FCM setup
// - google-services.json correct?
// - Firebase Cloud Messaging API enabled?
```

### 2. Debug Commands

```bash
# Check cron job logs trên Render
render logs --service=upcoming-task-reminders

# Test worker endpoint manually
curl -X POST https://your-api.onrender.com/worker/health \
  -H "Authorization: Bearer ${WORKER_SECRET_TOKEN}"

# Check database connection
npx prisma db pull

# Verify Firebase connection
node -e "
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
console.log('Firebase connected');
"
```

### 3. Performance Optimization

```typescript
// Batch notifications (gửi nhiều notification cùng lúc)
async sendBatchNotifications(tokens: string[], message: any) {
  const BATCH_SIZE = 500; // FCM limit
  
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    await this.fcmService.sendMulticastNotification(
      batch,
      message.notification,
      message.data,
    );
  }
}

// Parallel processing
async processTasksInParallel(tasks: Task[]) {
  await Promise.allSettled(
    tasks.map(task => this.sendTaskReminder(task))
  );
}
```

### 4. Monitoring Checklist

- [ ] Cron jobs chạy đúng schedule
- [ ] Worker endpoints response < 5s
- [ ] FCM notification delivery rate > 95%
- [ ] Error logs được track và alert
- [ ] Database queries optimized (với indexes)
- [ ] Environment variables được set đúng
- [ ] Firebase quota không bị vượt giới hạn

---

## Kết Luận

Với setup này, bạn đã có một hệ thống notification hoàn chỉnh với:

✅ **Cron Jobs** chạy tự động trên Render  
✅ **Worker Endpoints** xử lý logic notification  
✅ **FCM Integration** gửi push notification đến Android  
✅ **Security** với worker secret token  
✅ **Monitoring & Logging** đầy đủ  
✅ **Scalable Architecture** dễ mở rộng  

### Next Steps

1. Deploy lên Render và test cron jobs
2. Implement Android side FCM receiver
3. Add notification preferences cho users
4. Setup alerting cho failed notifications
5. Optimize performance và reduce costs

### Resources

- [Render Cron Jobs Docs](https://render.com/docs/cronjobs)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [NestJS Schedule](https://docs.nestjs.com/techniques/task-scheduling)
- [Crontab Guru](https://crontab.guru/) - Test cron expressions
