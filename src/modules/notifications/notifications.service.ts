import { Injectable, Logger } from '@nestjs/common';
import { FcmService } from '../fcm/fcm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import {
  notification_type,
  notification_priority,
  notification_status,
  Prisma,
} from '@prisma/client';

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
        title: 'New Task',
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
        this.logger.log(`User ${data.assigneeId} is OFFLINE → sending via FCM`);

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
            title: 'New Task',
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

  /**
   * Gửi notification khi có user được mời vào project
   * Strategy: WebSocket nếu online, FCM nếu offline
   */
  async sendProjectInvite(data: {
    projectId: string;
    projectName: string;
    inviteeId: string;
    invitedBy: string;
    invitedByName: string;
    role: string;
  }): Promise<void> {
    try {
      const message = `${data.invitedByName} đã mời bạn tham gia project "${data.projectName}" với vai trò ${data.role}`;
      const notificationPayload = {
        id: crypto.randomUUID(),
        type: 'PROJECT_INVITE',
        title: 'Project Invite',
        body: message,
        data: {
          projectId: data.projectId,
          projectName: data.projectName,
          invitedBy: data.invitedBy,
          invitedByName: data.invitedByName,
          role: data.role,
          deeplink: `/projects/${data.projectId}`,
        },
        createdAt: new Date().toISOString(),
      };

      // Check if user is online (WebSocket connected)
      const isOnline = this.notificationsGateway.isUserOnline(data.inviteeId);

      if (isOnline) {
        // User is online → send via WebSocket (real-time)
        this.logger.log(
          `User ${data.inviteeId} is ONLINE → sending via WebSocket`,
        );
        this.notificationsGateway.emitToUser(
          data.inviteeId,
          'notification',
          notificationPayload,
        );

        // Log as DELIVERED (WebSocket delivered instantly)
        await this.logNotification({
          userId: data.inviteeId,
          type: 'PROJECT_INVITE',
          projectId: data.projectId,
          message,
          status: 'DELIVERED',
        });
      } else {
        // User is offline → send via FCM (push notification)
        this.logger.log(`User ${data.inviteeId} is OFFLINE → sending via FCM`);

        await this.fcmService.sendNotification({
          userId: data.inviteeId,
          notification: {
            title: '🎯 Lời Mời Project',
            body: message,
          },
          data: {
            type: 'PROJECT_INVITE',
            projectId: data.projectId,
            projectName: data.projectName,
            invitedBy: data.invitedBy,
            invitedByName: data.invitedByName,
            role: data.role,
            deeplink: `/projects/${data.projectId}`,
          },
        });

        // Log as SENT (FCM queued)
        await this.logNotification({
          userId: data.inviteeId,
          type: 'PROJECT_INVITE',
          projectId: data.projectId,
          message,
          status: 'SENT',
        });
      }

      this.logger.log(
        `Project invite notification sent to user ${data.inviteeId}`,
      );
    } catch (error) {
      this.logger.error('Failed to send project invite notification:', error);
    }
  }

  /**
   * Gửi notification khi có comment mới trên task
   * Strategy: WebSocket nếu online, FCM nếu offline
   */
  async sendTaskComment(data: {
    taskId: string;
    taskTitle: string;
    projectName: string;
    commenterId: string;
    commenterName: string;
    commentBody: string;
    notifyUserIds: string[];
  }): Promise<void> {
    try {
      const message = `${data.commenterName} đã comment trên task "${data.taskTitle}": ${data.commentBody.substring(0, 50)}...`;

      // Send to all users (except commenter)
      for (const userId of data.notifyUserIds) {
        if (userId === data.commenterId) continue;

        const notificationPayload = {
          id: crypto.randomUUID(),
          type: 'TASK_COMMENT',
          title: 'New Comment',
          body: message,
          data: {
            taskId: data.taskId,
            taskTitle: data.taskTitle,
            projectName: data.projectName,
            commenterId: data.commenterId,
            commenterName: data.commenterName,
            deeplink: `/tasks/${data.taskId}`,
          },
          createdAt: new Date().toISOString(),
        };

        const isOnline = this.notificationsGateway.isUserOnline(userId);

        if (isOnline) {
          this.notificationsGateway.emitToUser(
            userId,
            'notification',
            notificationPayload,
          );
          await this.logNotification({
            userId,
            type: 'TASK_COMMENT',
            taskId: data.taskId,
            message,
            status: 'DELIVERED',
          });
        } else {
          await this.fcmService.sendNotification({
            userId,
            notification: {
              title: 'New Comment',
              body: message,
            },
            data: {
              type: 'TASK_COMMENT',
              taskId: data.taskId,
              taskTitle: data.taskTitle,
              projectName: data.projectName,
              commenterId: data.commenterId,
              commenterName: data.commenterName,
              deeplink: `/tasks/${data.taskId}`,
            },
          });
          await this.logNotification({
            userId,
            type: 'TASK_COMMENT',
            taskId: data.taskId,
            message,
            status: 'SENT',
          });
        }
      }

      this.logger.log(
        `Task comment notification sent to ${data.notifyUserIds.length} users`,
      );
    } catch (error) {
      this.logger.error('Failed to send task comment notification:', error);
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
          title: 'Task Reminder',
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
    projectId?: string;
    message: string;
    status?: string;
  }): Promise<void> {
    try {
      // Map notification type to enum
      const notificationType = this.mapNotificationType(data.type);
      const priority: notification_priority =
        notificationType === 'TIME_REMINDER' ||
        notificationType === 'TASK_ASSIGNED'
          ? 'HIGH'
          : 'NORMAL';

      const notificationData: Record<string, string> = {};
      if (data.taskId) notificationData.taskId = data.taskId;
      if (data.projectId) notificationData.projectId = data.projectId;

      await this.prisma.notifications.create({
        data: {
          user_id: data.userId,
          type: notificationType,
          title: this.getNotificationTitle(data.type),
          body: data.message,
          channel: 'PUSH',
          priority: priority,
          status: (data.status || 'SENT') as notification_status,
          sent_at: new Date(),
          data:
            Object.keys(notificationData).length > 0
              ? (notificationData as Prisma.InputJsonValue)
              : undefined,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log notification:', error);
    }
  }

  private mapNotificationType(type: string): notification_type {
    const typeMap: Record<string, notification_type> = {
      task_reminder: 'TIME_REMINDER',
      TIME_REMINDER: 'TIME_REMINDER',
      daily_summary: 'SYSTEM',
      SYSTEM: 'SYSTEM',
      task_assigned: 'TASK_ASSIGNED',
      TASK_ASSIGNED: 'TASK_ASSIGNED',
      TASK_MOVED: 'TASK_MOVED',
      PROJECT_INVITE: 'SYSTEM', // Map to SYSTEM since PROJECT_INVITE not in enum
      TASK_COMMENT: 'SYSTEM', // Map to SYSTEM since TASK_COMMENT not in enum
      EVENT_INVITE: 'EVENT_INVITE',
      EVENT_UPDATED: 'EVENT_UPDATED',
      MEETING_REMINDER: 'MEETING_REMINDER',
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
                priority: notification.priority === 'HIGH' ? 'high' : 'default',
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
      userIds.map((userId) =>
        this.sendNotificationToUser(userId, notification),
      ),
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
          status: 'READ',
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
   * Get all notifications with pagination
   */
  async getAllNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notifications.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notifications.count({
      where: {
        user_id: userId,
        status: {
          in: ['SENT', 'DELIVERED'],
        },
      },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await this.prisma.notifications.updateMany({
        where: {
          user_id: userId,
          status: {
            in: ['SENT', 'DELIVERED'],
          },
        },
        data: {
          status: 'READ',
          read_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to mark all notifications as read:', error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.prisma.notifications.deleteMany({
        where: {
          id: notificationId,
          user_id: userId,
        },
      });
    } catch (error) {
      this.logger.error('Failed to delete notification:', error);
      throw error;
    }
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
