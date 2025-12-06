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

      // Try to send via WebSocket (returns true if user is online)
      const wsSuccess = this.notificationsGateway.emitToUser(
        data.assigneeId,
        'notification',
        notificationPayload,
      );

      if (wsSuccess) {
        // User is online → WebSocket delivered
        this.logger.log(
          `User ${data.assigneeId} is ONLINE → sent via WebSocket`,
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
    invitationId: string;
  }): Promise<void> {
    try {
      console.log('=== SENDING PROJECT INVITE NOTIFICATION ===');
      console.log('Invitee ID:', data.inviteeId);
      console.log('Inviter:', data.invitedByName);
      console.log('Project:', data.projectName);

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

      // Try to send via WebSocket (returns true if user is online)
      console.log('📡 Attempting WebSocket delivery...');
      const wsSuccess = this.notificationsGateway.emitToUser(
        data.inviteeId,
        'notification',
        notificationPayload,
      );
      console.log(
        `🎯 WebSocket result: ${wsSuccess ? 'ONLINE → Delivered' : 'OFFLINE'}`,
      );

      if (wsSuccess) {
        // User is online → WebSocket delivered
        this.logger.log(
          `User ${data.inviteeId} is ONLINE → sent via WebSocket`,
        );
        console.log('✅ WebSocket notification sent');

        // ALSO send FCM as backup (in case WebSocket message is lost due to race condition)
        // Android will filter it out if app is foreground (show_fcm_notifications = false)
        console.log(
          '📱 [BACKUP] Also sending FCM (Android will filter if foreground)',
        );
        const fcmBackupResult = await this.fcmService.sendNotification({
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
            invitationId: data.invitationId,
            deeplink: `/projects/${data.projectId}`,
            hasActions: 'true',
            actionAccept: 'accept',
            actionDecline: 'decline',
          },
        });

        if (fcmBackupResult === 'NO_FCM_TOKEN') {
          console.log(`⚠️ [FCM BACKUP] No token, relying on WebSocket only`);
        } else {
          console.log(
            `✅ [FCM BACKUP] Sent successfully (will be filtered by Android if foreground)`,
          );
        }

        // Log as DELIVERED (WebSocket delivered instantly)
        await this.logNotification({
          userId: data.inviteeId,
          type: 'PROJECT_INVITE',
          projectId: data.projectId,
          message,
          status: 'DELIVERED',
        });
        console.log('✅ Notification logged as DELIVERED');
      } else {
        // User is offline → send via FCM (push notification)
        this.logger.log(`User ${data.inviteeId} is OFFLINE → sending via FCM`);
        console.log('📱 Sending via FCM (push notification)...');

        const fcmResult = await this.fcmService.sendNotification({
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
            invitationId: data.invitationId, // Thêm invitation ID
            deeplink: `/projects/${data.projectId}`,
            // Action buttons data
            hasActions: 'true',
            actionAccept: 'accept',
            actionDecline: 'decline',
          },
        });

        // Check FCM result
        if (fcmResult === 'NO_FCM_TOKEN') {
          console.log(
            `⚠️ [FCM] User ${data.inviteeId} has NO FCM TOKEN registered!`,
          );
          this.logger.warn(
            `User ${data.inviteeId} cannot receive push notifications - no FCM token`,
          );
        } else {
          console.log(`✅ [FCM] Notification sent successfully: ${fcmResult}`);
        }

        // Log as SENT (FCM queued)
        await this.logNotification({
          userId: data.inviteeId,
          type: 'PROJECT_INVITE',
          projectId: data.projectId,
          message,
          status: 'SENT',
        });
        console.log('✅ Notification logged as SENT');
      }

      this.logger.log(
        `Project invite notification sent to user ${data.inviteeId}`,
      );
      console.log('=== NOTIFICATION PROCESS COMPLETE ===');
    } catch (error) {
      this.logger.error('Failed to send project invite notification:', error);
      console.error('❌ NOTIFICATION ERROR:', error);
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

        const wsSuccess = this.notificationsGateway.emitToUser(
          userId,
          'notification',
          notificationPayload,
        );

        if (wsSuccess) {
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

  /**
   * Gửi notification khi task được di chuyển
   * Strategy: WebSocket nếu online, FCM nếu offline
   */
  async sendTaskMoved(data: {
    taskId: string;
    taskTitle: string;
    fromProject?: string;
    toProject?: string;
    fromBoard?: string;
    toBoard?: string;
    movedBy: string;
    movedByName: string;
    notifyUserIds: string[];
  }): Promise<void> {
    try {
      // Build movement description
      let movementDesc = '';
      if (
        data.fromProject &&
        data.toProject &&
        data.fromProject !== data.toProject
      ) {
        movementDesc = `từ project "${data.fromProject}" sang "${data.toProject}"`;
      } else if (
        data.fromBoard &&
        data.toBoard &&
        data.fromBoard !== data.toBoard
      ) {
        movementDesc = `từ board "${data.fromBoard}" sang "${data.toBoard}"`;
      } else {
        movementDesc = 'sang vị trí mới';
      }

      const message = `${data.movedByName} đã di chuyển task "${data.taskTitle}" ${movementDesc}`;

      // Send to all relevant users
      for (const userId of data.notifyUserIds) {
        if (userId === data.movedBy) continue; // Skip the mover

        const notificationPayload = {
          id: crypto.randomUUID(),
          type: 'TASK_MOVED',
          title: 'Task Moved',
          body: message,
          data: {
            taskId: data.taskId,
            taskTitle: data.taskTitle,
            fromProject: data.fromProject,
            toProject: data.toProject,
            fromBoard: data.fromBoard,
            toBoard: data.toBoard,
            movedBy: data.movedBy,
            movedByName: data.movedByName,
            deeplink: `/tasks/${data.taskId}`,
          },
          createdAt: new Date().toISOString(),
        };

        const wsSuccess = this.notificationsGateway.emitToUser(
          userId,
          'notification',
          notificationPayload,
        );

        if (wsSuccess) {
          await this.logNotification({
            userId,
            type: 'TASK_MOVED',
            taskId: data.taskId,
            message,
            status: 'DELIVERED',
          });
        } else {
          await this.fcmService.sendNotification({
            userId,
            notification: {
              title: '📦 Task Moved',
              body: message,
            },
            data: {
              type: 'TASK_MOVED',
              taskId: data.taskId,
              taskTitle: data.taskTitle,
              fromProject: data.fromProject || '',
              toProject: data.toProject || '',
              fromBoard: data.fromBoard || '',
              toBoard: data.toBoard || '',
              movedBy: data.movedBy,
              movedByName: data.movedByName,
              deeplink: `/tasks/${data.taskId}`,
            },
          });
          await this.logNotification({
            userId,
            type: 'TASK_MOVED',
            taskId: data.taskId,
            message,
            status: 'SENT',
          });
        }
      }

      this.logger.log(
        `Task moved notification sent to ${data.notifyUserIds.length} users`,
      );
    } catch (error) {
      this.logger.error('Failed to send task moved notification:', error);
    }
  }

  /**
   * Gửi notification khi được mời vào event
   * Strategy: WebSocket nếu online, FCM nếu offline
   */
  async sendEventInvite(data: {
    eventId: string;
    eventTitle: string;
    eventDescription?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    organizerId: string;
    organizerName: string;
    meetLink?: string;
    inviteeIds: string[];
  }): Promise<void> {
    try {
      const startTimeStr = data.startTime.toLocaleString('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const message = `${data.organizerName} đã mời bạn tham gia sự kiện "${data.eventTitle}" vào ${startTimeStr}`;

      // Send to all invitees
      for (const userId of data.inviteeIds) {
        if (userId === data.organizerId) continue; // Skip organizer

        const notificationPayload = {
          id: crypto.randomUUID(),
          type: 'EVENT_INVITE',
          title: 'Event Invitation',
          body: message,
          data: {
            eventId: data.eventId,
            eventTitle: data.eventTitle,
            eventDescription: data.eventDescription || '',
            startTime: data.startTime.toISOString(),
            endTime: data.endTime.toISOString(),
            location: data.location || '',
            organizerId: data.organizerId,
            organizerName: data.organizerName,
            meetLink: data.meetLink || '',
            deeplink: `/events/${data.eventId}`,
            // Action buttons
            hasActions: 'true',
            actionAccept: 'accept',
            actionDecline: 'decline',
            actionTentative: 'tentative',
          },
          createdAt: new Date().toISOString(),
        };

        const wsSuccess = this.notificationsGateway.emitToUser(
          userId,
          'notification',
          notificationPayload,
        );

        if (wsSuccess) {
          await this.logNotification({
            userId,
            type: 'EVENT_INVITE',
            message,
            status: 'DELIVERED',
          });
        } else {
          await this.fcmService.sendNotification({
            userId,
            notification: {
              title: '📅 Event Invitation',
              body: message,
            },
            data: {
              type: 'EVENT_INVITE',
              eventId: data.eventId,
              eventTitle: data.eventTitle,
              startTime: data.startTime.toISOString(),
              endTime: data.endTime.toISOString(),
              location: data.location || '',
              organizerName: data.organizerName,
              meetLink: data.meetLink || '',
              deeplink: `/events/${data.eventId}`,
              // Action buttons
              hasActions: 'true',
              actionAccept: 'accept',
              actionDecline: 'decline',
              actionTentative: 'tentative',
            },
          });
          await this.logNotification({
            userId,
            type: 'EVENT_INVITE',
            message,
            status: 'SENT',
          });
        }
      }

      this.logger.log(
        `Event invite notification sent to ${data.inviteeIds.length} users`,
      );
    } catch (error) {
      this.logger.error('Failed to send event invite notification:', error);
    }
  }

  /**
   * Gửi notification khi event được cập nhật
   * Strategy: WebSocket nếu online, FCM nếu offline
   */
  async sendEventUpdated(data: {
    eventId: string;
    eventTitle: string;
    changes: {
      time?: boolean;
      location?: boolean;
      description?: boolean;
    };
    newStartTime?: Date;
    newEndTime?: Date;
    newLocation?: string;
    updatedBy: string;
    updatedByName: string;
    participantIds: string[];
  }): Promise<void> {
    try {
      // Build change description
      const changesList: string[] = [];
      if (data.changes.time) changesList.push('thời gian');
      if (data.changes.location) changesList.push('địa điểm');
      if (data.changes.description) changesList.push('mô tả');

      const changesDesc = changesList.join(', ');
      const message = `${data.updatedByName} đã cập nhật ${changesDesc} cho sự kiện "${data.eventTitle}"`;

      // Send to all participants
      for (const userId of data.participantIds) {
        if (userId === data.updatedBy) continue; // Skip updater

        const notificationPayload = {
          id: crypto.randomUUID(),
          type: 'EVENT_UPDATED',
          title: 'Event Updated',
          body: message,
          data: {
            eventId: data.eventId,
            eventTitle: data.eventTitle,
            changes: JSON.stringify(data.changes),
            newStartTime: data.newStartTime?.toISOString() || '',
            newEndTime: data.newEndTime?.toISOString() || '',
            newLocation: data.newLocation || '',
            updatedBy: data.updatedBy,
            updatedByName: data.updatedByName,
            deeplink: `/events/${data.eventId}`,
          },
          createdAt: new Date().toISOString(),
        };

        const wsSuccess = this.notificationsGateway.emitToUser(
          userId,
          'notification',
          notificationPayload,
        );

        if (wsSuccess) {
          await this.logNotification({
            userId,
            type: 'EVENT_UPDATED',
            message,
            status: 'DELIVERED',
          });
        } else {
          await this.fcmService.sendNotification({
            userId,
            notification: {
              title: '📝 Event Updated',
              body: message,
            },
            data: {
              type: 'EVENT_UPDATED',
              eventId: data.eventId,
              eventTitle: data.eventTitle,
              changes: JSON.stringify(data.changes),
              newStartTime: data.newStartTime?.toISOString() || '',
              newEndTime: data.newEndTime?.toISOString() || '',
              newLocation: data.newLocation || '',
              updatedByName: data.updatedByName,
              deeplink: `/events/${data.eventId}`,
            },
          });
          await this.logNotification({
            userId,
            type: 'EVENT_UPDATED',
            message,
            status: 'SENT',
          });
        }
      }

      this.logger.log(
        `Event updated notification sent to ${data.participantIds.length} users`,
      );
    } catch (error) {
      this.logger.error('Failed to send event updated notification:', error);
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

  /**
   * Send event reminder notification
   */
  async sendEventReminder(data: {
    eventId: string;
    eventTitle: string;
    eventStartAt: Date;
    senderName: string;
    message?: string | null;
    recipientIds: string[];
    projectId?: string; // ✅ Add optional projectId for deep link navigation
  }): Promise<void> {
    this.logger.log(`🔔 [NOTIFICATION] Starting sendEventReminder`);
    this.logger.log(`📊 [NOTIFICATION] Input data:`);
    this.logger.log(`   - Event ID: ${data.eventId}`);
    this.logger.log(`   - Event Title: ${data.eventTitle}`);
    this.logger.log(`   - Project ID: ${data.projectId || 'N/A'}`);
    this.logger.log(`   - Sender: ${data.senderName}`);
    this.logger.log(`   - Recipients: ${data.recipientIds.length} users`);
    this.logger.log(`   - Recipient IDs: ${JSON.stringify(data.recipientIds)}`);

    try {
      const formattedDate = data.eventStartAt.toLocaleDateString('vi-VN');
      const formattedTime = data.eventStartAt.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      this.logger.log(
        `⏰ [NOTIFICATION] Formatted time: ${formattedTime}, ${formattedDate}`,
      );

      const body = data.message
        ? `${data.senderName}: ${data.message}`
        : `${data.senderName} nhắc bạn về sự kiện "${data.eventTitle}" lúc ${formattedTime}, ${formattedDate}`;

      this.logger.log(`📝 [NOTIFICATION] Message body: ${body}`);

      const notificationPayload = {
        id: crypto.randomUUID(),
        type: 'EVENT_REMINDER',
        title: '🔔 Event Reminder',
        body,
        data: {
          eventId: data.eventId,
          eventTitle: data.eventTitle,
          eventStartAt: data.eventStartAt.toISOString(),
          senderName: data.senderName,
          message: data.message || '',
          projectId: data.projectId || '', // ✅ Include projectId for navigation
          deeplink: `/events/${data.eventId}`,
        },
        createdAt: new Date().toISOString(),
      };

      this.logger.log(
        `📦 [NOTIFICATION] Payload created with ID: ${notificationPayload.id}`,
      );

      // Send to all recipients
      let wsSuccessCount = 0;
      let fcmSuccessCount = 0;
      let dbSuccessCount = 0;

      for (const recipientId of data.recipientIds) {
        this.logger.log(
          `👤 [NOTIFICATION] Processing recipient: ${recipientId}`,
        );

        // Try WebSocket first
        this.logger.log(
          `🔌 [NOTIFICATION] Attempting WebSocket delivery to ${recipientId}...`,
        );
        const wsSuccess = this.notificationsGateway.emitToUser(
          recipientId,
          'notification',
          notificationPayload,
        );

        if (wsSuccess) {
          wsSuccessCount++;
          this.logger.log(
            `✅ [NOTIFICATION] WebSocket delivery successful to ${recipientId}`,
          );
        } else {
          this.logger.warn(
            `⚠️ [NOTIFICATION] WebSocket delivery failed for ${recipientId}, falling back to FCM`,
          );

          // Fallback to FCM
          const devices = await this.prisma.user_devices.findMany({
            where: { user_id: recipientId, is_active: true },
          });

          this.logger.log(
            `📱 [NOTIFICATION] Found ${devices.length} active devices for user ${recipientId}`,
          );

          for (const device of devices) {
            this.logger.log(
              `📲 [NOTIFICATION] Sending FCM to device: ${device.id.substring(0, 8)}...`,
            );

            try {
              await this.fcmService.sendNotification({
                token: device.fcm_token,
                notification: {
                  title: notificationPayload.title,
                  body: notificationPayload.body,
                },
                data: {
                  type: 'event_reminder',
                  eventId: data.eventId,
                  eventTitle: data.eventTitle,
                  projectId: data.projectId || '',
                  clickAction: 'OPEN_EVENT_DETAIL',
                },
                android: {
                  priority: 'high',
                  notification: {
                    channelId: 'event_reminders',
                    priority: 'high',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                  },
                },
              });
              fcmSuccessCount++;
              this.logger.log(
                `✅ [NOTIFICATION] FCM sent successfully to device ${device.id.substring(0, 8)}`,
              );
            } catch (fcmError) {
              this.logger.error(
                `❌ [NOTIFICATION] FCM failed for device ${device.id}:`,
                fcmError.message,
              );
            }
          }
        }

        // Log to database
        try {
          this.logger.log(
            `💾 [NOTIFICATION] Logging to database for user ${recipientId}...`,
          );
          await this.logNotification({
            userId: recipientId,
            type: 'EVENT_REMINDER' as notification_type,
            message: body,
          });
          dbSuccessCount++;
          this.logger.log(
            `✅ [NOTIFICATION] Database log successful for ${recipientId}`,
          );
        } catch (dbError) {
          this.logger.error(
            `❌ [NOTIFICATION] Database log failed for ${recipientId}:`,
            dbError.message,
          );
        }
      }

      this.logger.log(`📊 [NOTIFICATION] Summary:`);
      this.logger.log(`   - Total recipients: ${data.recipientIds.length}`);
      this.logger.log(`   - WebSocket successful: ${wsSuccessCount}`);
      this.logger.log(`   - FCM successful: ${fcmSuccessCount}`);
      this.logger.log(`   - Database logs: ${dbSuccessCount}`);
      this.logger.log(
        `✅ [NOTIFICATION] sendEventReminder completed successfully`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [NOTIFICATION] Failed to send event reminder:`,
        error,
      );
      this.logger.error(`❌ [NOTIFICATION] Error message: ${error.message}`);
      this.logger.error(`❌ [NOTIFICATION] Error stack: ${error.stack}`);
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
      PROJECT_INVITE: 'PROJECT_INVITE', // ✅ Fixed: Now maps correctly
      PROJECT_INVITE_ACCEPTED: 'PROJECT_INVITE', // ✅ Use same type for accepted
      PROJECT_INVITE_DECLINED: 'PROJECT_INVITE', // ✅ Use same type for declined
      TASK_COMMENT: 'TASK_COMMENT', // ✅ Fixed: Now maps correctly
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
      TASK_MOVED: 'Task được di chuyển',
      TASK_COMMENT: 'Bình luận mới',
      PROJECT_INVITE: 'Lời mời Project',
      EVENT_INVITE: 'Lời mời sự kiện',
      EVENT_UPDATED: 'Sự kiện cập nhật',
      MEETING_REMINDER: 'Nhắc nhở cuộc họp',
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

      // Try to send via WebSocket
      const wsSuccess = this.notificationsGateway.emitToUser(
        userId,
        'notification',
        payload,
      );

      if (wsSuccess) {
        // User is online → WebSocket delivered
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
