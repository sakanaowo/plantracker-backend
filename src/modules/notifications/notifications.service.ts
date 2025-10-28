import { Injectable, Logger } from '@nestjs/common';
import { FcmService } from '../fcm/fcm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly fcmService: FcmService,
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Gửi notification khi task được assign cho user
   * Strategy: WebSocket nếu online, FCM nếu offline
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
      const message = `${data.assignedByName} đã giao task cho bạn trong project "${data.projectName}"`;
      const notificationPayload = {
        id: crypto.randomUUID(),
        type: 'TASK_ASSIGNED',
        title: '📋 Task Mới',
        body: message,
        data: {
          taskId: data.taskId,
          taskTitle: data.taskTitle,
          projectName: data.projectName,
          assignedBy: data.assignedBy,
          assignedByName: data.assignedByName,
          deeplink: `/tasks/${data.taskId}`,
        },
        createdAt: new Date().toISOString(),
      };

      // Check if user is online (WebSocket connected)
      const isOnline = this.notificationsGateway.isUserOnline(data.assigneeId);

      if (isOnline) {
        // User is online → send via WebSocket (real-time)
        this.logger.log(
          `User ${data.assigneeId} is ONLINE → sending via WebSocket`,
        );
        this.notificationsGateway.emitToUser(
          data.assigneeId,
          'notification',
          notificationPayload,
        );

        // Log as DELIVERED (WebSocket delivered instantly)
        await this.logNotification({
          userId: data.assigneeId,
          type: 'TASK_ASSIGNED',
          taskId: data.taskId,
          message,
          status: 'DELIVERED',
        });
      } else {
        // User is offline → send via FCM (push notification)
        this.logger.log(
          `User ${data.assigneeId} is OFFLINE → sending via FCM`,
        );

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

        // Log as SENT (FCM queued)
        await this.logNotification({
          userId: data.assigneeId,
          type: 'TASK_ASSIGNED',
          taskId: data.taskId,
          message,
          status: 'SENT',
        });
      }

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
    status?: string;
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
          status: (data.status || 'SENT') as any,
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

  /**
   * Send notification to user (WebSocket + FCM hybrid)
   * @param userId - User ID to send notification to
   * @param notification - Notification payload
   */
  async sendNotificationToUser(
    userId: string,
    notification: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, any>;
      priority?: 'HIGH' | 'NORMAL' | 'LOW';
    },
  ): Promise<void> {
    try {
      const notificationId = crypto.randomUUID();
      const payload = {
        id: notificationId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        createdAt: new Date().toISOString(),
      };

      // Check if user is online
      const isOnline = this.notificationsGateway.isUserOnline(userId);

      if (isOnline) {
        // Send via WebSocket
        this.notificationsGateway.emitToUser(userId, 'notification', payload);
        await this.logNotification({
          userId,
          type: notification.type,
          message: notification.body,
          status: 'DELIVERED',
        });
      } else {
        // Send via FCM
        const device = await this.prisma.user_devices.findFirst({
          where: { user_id: userId, is_active: true },
          orderBy: { last_active_at: 'desc' },
        });

        if (device?.fcm_token) {
          await this.fcmService.sendNotification({
            token: device.fcm_token,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: {
              ...notification.data,
              notificationId,
            },
            android: {
              priority: notification.priority === 'HIGH' ? 'high' : 'normal',
              notification: {
                channelId: this.getChannelId(notification.type),
                priority:
                  notification.priority === 'HIGH' ? 'high' : 'default',
                defaultSound: true,
              },
            },
          });

          await this.logNotification({
            userId,
            type: notification.type,
            message: notification.body,
            status: 'SENT',
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to send notification:', error);
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendNotificationToUsers(
    userIds: string[],
    notification: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, any>;
      priority?: 'HIGH' | 'NORMAL' | 'LOW';
    },
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.sendNotificationToUser(userId, notification)),
    );
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await this.prisma.notifications.updateMany({
        where: {
          id: notificationId,
          user_id: userId,
        },
        data: {
          status: 'READ' as any,
          read_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Get user's unread notifications
   */
  async getUnreadNotifications(userId: string) {
    return this.prisma.notifications.findMany({
      where: {
        user_id: userId,
        status: {
          in: ['SENT', 'DELIVERED'],
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 50,
    });
  }

  /**
   * Get notification channel ID based on type
   */
  private getChannelId(type: string): string {
    const channelMap: Record<string, string> = {
      TASK_ASSIGNED: 'task_updates',
      TASK_UPDATED: 'task_updates',
      TASK_MOVED: 'task_updates',
      TIME_REMINDER: 'task_reminders',
      EVENT_INVITE: 'event_updates',
      EVENT_UPDATED: 'event_updates',
      MEETING_REMINDER: 'meeting_reminders',
      SYSTEM: 'system_notifications',
    };
    return channelMap[type] || 'default';
  }
}
