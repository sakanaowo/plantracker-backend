import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('notifications')
@UseGuards(CombinedAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get unread notifications for current user
   */
  @Get('unread')
  async getUnreadNotifications(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadNotifications(user.uid);
  }

  /**
   * Mark notification as read
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    await this.notificationsService.markAsRead(id, user.uid);
    return { success: true, message: 'Notification marked as read' };
  }

  /**
   * Test endpoint: Send test notification
   */
  @Post('test/send')
  async sendTestNotification(
    @CurrentUser() user: any,
    @Body() data: { title?: string; body?: string; type?: string },
  ) {
    await this.notificationsService.sendNotificationToUser(user.uid, {
      type: data.type || 'SYSTEM',
      title: data.title || 'Test Notification',
      body: data.body || 'This is a test notification from WebSocket/FCM',
      data: {
        testData: 'test',
        timestamp: new Date().toISOString(),
      },
      priority: 'NORMAL',
    });

    return {
      success: true,
      message: 'Test notification sent',
    };
  }
}
