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
      dueDate: Date | null;
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
          dueDate: data.task.dueDate?.toISOString() || '',
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
          priority: 'normal',
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
          type: notificationType as any,
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
    const typeMap: Record<string, string> = {
      task_reminder: 'TIME_REMINDER',
      TIME_REMINDER: 'TIME_REMINDER',
      daily_summary: 'SYSTEM',
      SYSTEM: 'SYSTEM',
    };
    return typeMap[type] || 'SYSTEM';
  }

  /**
   * Get notification title based on type
   */
  private getNotificationTitle(type: string): string {
    const titleMap: Record<string, string> = {
      task_reminder: 'Nhắc nhở Task',
      TIME_REMINDER: 'Nhắc nhở Task',
      daily_summary: 'Tổng kết ngày',
      SYSTEM: 'Thông báo hệ thống',
    };
    return titleMap[type] || 'Thông báo';
  }
}
