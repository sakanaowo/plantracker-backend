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
      // If message contains userId, fetch FCM token first
      if ('userId' in message) {
        const user = await this.getUserFcmToken(message.userId);
        if (!user?.fcmToken) {
          this.logger.warn(
            `User ${message.userId} does not have FCM token registered`,
          );
          return 'NO_FCM_TOKEN';
        }

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

        const response = await admin.messaging().send(fcmMessage);
        this.logger.log(`Successfully sent notification: ${response}`);
        return response;
      }

      // Standard Message object
      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent notification: ${response}`);
      return response;
    } catch (error) {
      this.logger.error('Error sending notification', error);
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
}
