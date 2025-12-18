import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Message } from 'firebase-admin/messaging';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * Gửi notification với cấu hình đầy đủ
   */
  async sendNotification(
    message:
      | Message
      | {
          userId: string;
          notification: { title: string; body: string };
          data: Record<string, string>;
        },
  ): Promise<string> {
    try {
      this.logger.log(`[FCM] Starting sendNotification`);

      // If message contains userId, fetch FCM token first
      if ('userId' in message) {
        this.logger.log(`👤 [FCM] Sending to userId: ${message.userId}`);
        this.logger.log(
          `📝 [FCM] Notification title: ${message.notification.title}`,
        );
        this.logger.log(
          `📄 [FCM] Notification body: ${message.notification.body}`,
        );
        this.logger.log(
          `📦 [FCM] Data payload: ${JSON.stringify(message.data)}`,
        );

        const user = await this.getUserFcmToken(message.userId);
        if (!user?.fcmToken) {
          this.logger.warn(
            `⚠️ [FCM] User ${message.userId} does not have FCM token registered`,
          );
          return 'NO_FCM_TOKEN';
        }

        this.logger.log(
          `🔑 [FCM] FCM token found: ${user.fcmToken.substring(0, 20)}...`,
        );

        const fcmMessage: Message = {
          token: user.fcmToken,
          notification: message.notification,
          data: message.data || {},
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'plantracker_notifications',
            },
          },
        };

        this.logger.log(`🚀 [FCM] Sending message via Firebase Admin SDK...`);
        const response = await admin.messaging().send(fcmMessage);
        this.logger.log(`✅ [FCM] Successfully sent notification: ${response}`);
        return response;
      }

      // Standard Message object
      this.logger.log(`📨 [FCM] Sending standard Message object`);
      if ('token' in message && message.token) {
        this.logger.log(`🔑 [FCM] Token: ${message.token.substring(0, 20)}...`);
      }

      const response = await admin.messaging().send(message);
      this.logger.log(`✅ [FCM] Successfully sent notification: ${response}`);
      return response;
    } catch (error) {
      this.logger.error(`❌ [FCM] Error sending notification:`, error);
      this.logger.error(`❌ [FCM] Error message: ${error.message}`);
      this.logger.error(`❌ [FCM] Error code: ${error.code || 'N/A'}`);
      if (error.errorInfo) {
        this.logger.error(
          `❌ [FCM] Error info: ${JSON.stringify(error.errorInfo)}`,
        );
      }

      // Handle invalid/expired FCM tokens
      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        this.logger.warn(
          `🧹 [FCM] Invalid token detected, cleaning up database...`,
        );

        // Extract userId and token for cleanup
        let tokenToRemove: string | null = null;
        let userIdToLog: string | null = null;

        if ('userId' in message) {
          userIdToLog = message.userId;
          const user = await this.getUserFcmToken(message.userId);
          tokenToRemove = user?.fcmToken || null;
        } else if ('token' in message) {
          tokenToRemove = message.token;
        }

        // Remove invalid token from database
        if (tokenToRemove) {
          await this.removeInvalidToken(tokenToRemove, userIdToLog);
        }

        // Return gracefully instead of throwing - notification failed but app should continue
        this.logger.warn(
          `⚠️ [FCM] Notification skipped due to invalid token (cleaned up)`,
        );
        return 'TOKEN_INVALID_CLEANED';
      }

      // For other errors, still throw
      throw error;
    }
  }

  private async getUserFcmToken(
    userId: string,
  ): Promise<{ fcmToken: string | null } | null> {
    const device = await this.prisma.user_devices.findFirst({
      where: {
        user_id: userId,
        fcm_token: { not: '' },
      },
      select: { fcm_token: true },
      orderBy: { last_active_at: 'desc' },
    });

    return device ? { fcmToken: device.fcm_token } : null;
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
   * Validate FCM token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // Try to send a dry-run message
      await admin.messaging().send(
        {
          token,
          notification: {
            title: 'Test',
            body: 'Test',
          },
        },
        true, // dry run
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Invalid FCM token: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Remove invalid FCM token from database
   */
  private async removeInvalidToken(
    fcmToken: string,
    userId?: string | null,
  ): Promise<void> {
    try {
      const result = await this.prisma.user_devices.updateMany({
        where: {
          fcm_token: fcmToken,
        },
        data: {
          fcm_token: '', // Clear the invalid token
        },
      });

      this.logger.log(
        `✅ [FCM] Removed invalid token from ${result.count} device(s)${userId ? ` for user ${userId}` : ''}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [FCM] Failed to remove invalid token from database:`,
        error,
      );
    }
  }
}
