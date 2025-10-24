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
          `Task assigned notification skipped: user ${data.assigneeId} has no active FCM token`,
        );
        return;
      }

      const message = `${data.assignedByName} đã giao task cho bạn trong project "${data.projectName}"`;

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
          assignedByName: data.assignedByName,
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
      this.logger.error('Failed to send task assigned notification:', error);
    }
  }

  async sendTaskReminder(data: {
    userId: string;
    fcmToken: string;
    task: {
      id: string;
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

  private async logNotification(data: {
    userId: string;
    type: string;
    taskId?: string;
    message: string;
  }): Promise<void> {
    try {
      // Map notification type to enum
      const notificationType = this.mapNotificationType(data.type);
      const priority =
        notificationType === 'TIME_REMINDER' ||
        notificationType === 'TASK_ASSIGNED'
          ? 'HIGH'
          : 'NORMAL';

      await this.prisma.notifications.create({
        data: {
          user_id: data.userId,
          type: notificationType as any,
          title: this.getNotificationTitle(data.type),
          body: data.message,
          channel: 'PUSH',
          priority: priority as any,
          status: 'SENT',
          sent_at: new Date(),
          data: data.taskId ? { taskId: data.taskId } : undefined,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log notification:', error);
    }
  }

  private mapNotificationType(type: string): string {
    const typeMap: Record<string, string> = {
      task_reminder: 'TIME_REMINDER',
      TIME_REMINDER: 'TIME_REMINDER',
      daily_summary: 'SYSTEM',
      SYSTEM: 'SYSTEM',
      task_assigned: 'TASK_ASSIGNED',
      TASK_ASSIGNED: 'TASK_ASSIGNED',
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
      task_assigned: 'Task mới được giao',
      TASK_ASSIGNED: 'Task mới được giao',
    };
    return titleMap[type] || 'Thông báo';
  }
}
