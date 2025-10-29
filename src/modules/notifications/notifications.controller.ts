import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('notifications')
@UseGuards(CombinedAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get all notifications with pagination
   */
  @Get()
  async getAllNotifications(
    @CurrentUser() userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.notificationsService.getAllNotifications(
      userId,
      page || 1,
      limit || 20,
    );
  }

  /**
   * Get unread notifications for current user
   */
  @Get('unread')
  async getUnreadNotifications(@CurrentUser() userId: string) {
    return this.notificationsService.getUnreadNotifications(userId);
  }

  /**
   * Get unread notification count
   */
  @Get('count')
  async getUnreadCount(@CurrentUser() userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark notification as read
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() userId: string) {
    await this.notificationsService.markAsRead(id, userId);
    return { success: true, message: 'Notification marked as read' };
  }

  /**
   * Mark all notifications as read
   */
  @Patch('read-all')
  async markAllAsRead(@CurrentUser() userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true, message: 'All notifications marked as read' };
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    await this.notificationsService.deleteNotification(id, userId);
    return { success: true, message: 'Notification deleted' };
  }

  /**
   * Test endpoint: Send test notification
   */
  @Post('test/send')
  async sendTestNotification(
    @CurrentUser() userId: string,
    @Body() data: { title?: string; body?: string; type?: string },
  ) {
    await this.notificationsService.sendNotificationToUser(userId, {
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
