import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { tasks } from '@prisma/client';

/**
 * TaskCalendarSyncService
 *
 * PURPOSE: Handle task-specific calendar synchronization operations
 *
 * RESPONSIBILITY:
 * - Sync individual tasks to Google Calendar
 * - Update calendar events when tasks change
 * - Remove calendar events when tasks are unsynced
 * - Manage calendar reminder settings
 */
@Injectable()
export class TaskCalendarSyncService {
  constructor(
    private prisma: PrismaService,
    private googleCalendarService: GoogleCalendarService,
  ) {}

  /**
   * Update task with calendar sync
   */
  async updateTaskWithCalendarSync(
    userId: string,
    taskId: string,
    updateData: {
      title?: string;
      dueAt?: Date;
      calendarReminderEnabled?: boolean;
      calendarReminderTime?: number;
    },
  ): Promise<tasks> {
    console.log('\n🟢 [CALENDAR-SYNC-SERVICE] Starting update...');
    console.log('  Task ID:', taskId);
    console.log('  User ID:', userId);

    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      console.log('❌ [CALENDAR-SYNC-SERVICE] Task not found!');
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    console.log('  Current task state:');
    console.log(
      '    - task_calendar_sync_users:',
      task.task_calendar_sync_users,
    );
    console.log(
      '    - User synced:',
      task.task_calendar_sync_users?.includes(userId),
    );

    // Check if user has Google Calendar connected
    const integration = await this.prisma.integration_tokens.findFirst({
      where: {
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
      },
    });

    const hasCalendarIntegration = !!integration;
    console.log(
      '  Google Calendar integration:',
      hasCalendarIntegration ? '✅ Connected' : '❌ Not connected',
    );

    // Prepare update data
    const dataToUpdate: any = {};

    if (updateData.title !== undefined) {
      dataToUpdate.title = updateData.title;
    }

    if (updateData.dueAt !== undefined) {
      dataToUpdate.due_at = updateData.dueAt;
    }

    // Handle calendar sync
    if (
      hasCalendarIntegration &&
      updateData.calendarReminderEnabled !== undefined
    ) {
      const taskTitle = updateData.title || task.title;
      const taskDueAt = updateData.dueAt || task.due_at;
      const reminderTime = updateData.calendarReminderTime || 30;

      if (updateData.calendarReminderEnabled && taskDueAt) {
        console.log('  📅 Syncing to Google Calendar...');

        console.log('    → Creating new calendar event');
        // Create new calendar event for this user
        const calendarEventId =
          await this.googleCalendarService.createTaskReminderEvent(
            userId,
            taskId,
            taskTitle,
            taskDueAt,
            reminderTime,
          );

        if (calendarEventId) {
          console.log('    ✅ Event created:', calendarEventId);
        } else {
          console.log('    ❌ Event creation failed');
        }

        // ✅ Add userId to task_calendar_sync_users array
        const currentSyncUsers = task.task_calendar_sync_users || [];
        if (!currentSyncUsers.includes(userId)) {
          dataToUpdate.task_calendar_sync_users = [...currentSyncUsers, userId];
          console.log('    ✅ Added user to sync list:', userId);
        }
      } else if (!updateData.calendarReminderEnabled) {
        console.log('  🗑️  Removing user from calendar sync...');

        // Delete user's calendar event (each user has their own)
        // TODO: Store per-user event IDs to delete specific events
        console.log('    → User event removal (future: per-user event ID)');

        // ✅ Remove userId from task_calendar_sync_users array
        const currentSyncUsers = task.task_calendar_sync_users || [];
        dataToUpdate.task_calendar_sync_users = currentSyncUsers.filter(
          (id) => id !== userId,
        );
        console.log('    ✅ Removed user from sync list:', userId);
      }
    }

    // Update task in database
    console.log('  💾 Updating database with:');
    console.log('    ', JSON.stringify(dataToUpdate, null, 2));

    const updatedTask = await this.prisma.tasks.update({
      where: { id: taskId },
      data: dataToUpdate,
      // ✅ Include assignees and labels in response
      include: {
        task_assignees: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar_url: true,
              },
            },
          },
        },
        task_labels: {
          include: {
            labels: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    console.log('\n✅ [CALENDAR-SYNC-SERVICE] Update complete!');
    console.log('  Final state:');
    console.log(
      '    - task_calendar_sync_users:',
      updatedTask.task_calendar_sync_users,
    );
    console.log(
      '    - User synced:',
      updatedTask.task_calendar_sync_users?.includes(userId),
    );

    return updatedTask;
  }

  /**
   * Unsync task from Google Calendar (remove calendar event)
   */
  async unsyncTaskFromCalendar(userId: string, taskId: string): Promise<tasks> {
    console.log('\n🔴 [CALENDAR-UNSYNC-SERVICE] Starting unsync...');
    console.log('  Task ID:', taskId);
    console.log('  User ID:', userId);

    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      console.log('❌ [CALENDAR-UNSYNC-SERVICE] Task not found!');
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    console.log('  Current sync users:', task.task_calendar_sync_users);

    // Delete from Google Calendar if user has synced
    // TODO: Store per-user event IDs to delete specific events
    const isUserSynced = task.task_calendar_sync_users?.includes(userId);

    if (isUserSynced) {
      console.log(
        '  🗑️  Removing user calendar event (future: per-user event ID)',
      );
    } else {
      console.log('  ℹ️  User has not synced this task');
    }

    // ✅ Remove userId from task_calendar_sync_users array
    const currentSyncUsers = task.task_calendar_sync_users || [];
    const updatedSyncUsers = currentSyncUsers.filter((id) => id !== userId);
    console.log('  ✅ Removed user from sync list:', userId);
    console.log('  Remaining synced users:', updatedSyncUsers.length);

    // Update task to remove user from sync list
    const updatedTask = await this.prisma.tasks.update({
      where: { id: taskId },
      data: {
        task_calendar_sync_users: updatedSyncUsers,
      },
      include: {
        task_assignees: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar_url: true,
              },
            },
          },
        },
        task_labels: {
          include: {
            labels: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    console.log('\n✅ [CALENDAR-UNSYNC-SERVICE] Task unsynced successfully!');
    console.log(
      '  task_calendar_sync_users:',
      updatedTask.task_calendar_sync_users,
    );
    console.log(
      '  Remaining synced users:',
      updatedTask.task_calendar_sync_users?.length,
    );

    return updatedTask;
  }
}
