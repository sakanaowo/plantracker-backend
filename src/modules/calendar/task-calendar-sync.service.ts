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
      '    - calendar_reminder_enabled:',
      task.calendar_reminder_enabled,
    );
    console.log('    - calendar_reminder_time:', task.calendar_reminder_time);
    console.log('    - calendar_event_id:', task.calendar_event_id);
    console.log('    - last_synced_at:', task.last_synced_at);

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
      dataToUpdate.calendar_reminder_enabled =
        updateData.calendarReminderEnabled;

      if (updateData.calendarReminderTime !== undefined) {
        dataToUpdate.calendar_reminder_time = updateData.calendarReminderTime;
      }

      const taskTitle = updateData.title || task.title;
      const taskDueAt = updateData.dueAt || task.due_at;
      const reminderTime =
        updateData.calendarReminderTime || task.calendar_reminder_time || 30;

      if (updateData.calendarReminderEnabled && taskDueAt) {
        console.log('  📅 Syncing to Google Calendar...');
        if (task.calendar_event_id) {
          console.log('    → Updating existing event:', task.calendar_event_id);
          // Update existing calendar event
          const success =
            await this.googleCalendarService.updateTaskReminderEvent(
              userId,
              task.calendar_event_id,
              taskTitle,
              taskDueAt,
              reminderTime,
            );

          if (success) {
            dataToUpdate.last_synced_at = new Date();
            console.log('    ✅ Event updated successfully');
          } else {
            console.log('    ❌ Event update failed');
          }
        } else {
          console.log('    → Creating new calendar event');
          // Create new calendar event
          const calendarEventId =
            await this.googleCalendarService.createTaskReminderEvent(
              userId,
              taskId,
              taskTitle,
              taskDueAt,
              reminderTime,
            );

          if (calendarEventId) {
            dataToUpdate.calendar_event_id = calendarEventId;
            dataToUpdate.last_synced_at = new Date();
            console.log('    ✅ Event created:', calendarEventId);
          } else {
            console.log('    ❌ Event creation failed');
          }
        }
      } else if (
        !updateData.calendarReminderEnabled &&
        task.calendar_event_id
      ) {
        console.log('  🗑️  Removing from Google Calendar...');
        console.log('    → Deleting event:', task.calendar_event_id);
        // Remove from calendar
        await this.googleCalendarService.deleteTaskReminderEvent(
          userId,
          task.calendar_event_id,
        );
        dataToUpdate.calendar_event_id = null;
        console.log('    ✅ Event deleted');
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
      '    - calendar_reminder_enabled:',
      updatedTask.calendar_reminder_enabled,
    );
    console.log(
      '    - calendar_reminder_time:',
      updatedTask.calendar_reminder_time,
    );
    console.log('    - calendar_event_id:', updatedTask.calendar_event_id);
    console.log('    - last_synced_at:', updatedTask.last_synced_at);

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

    console.log('  Current calendar_event_id:', task.calendar_event_id);

    // Delete from Google Calendar if event exists
    if (task.calendar_event_id) {
      console.log('  🗑️  Deleting calendar event:', task.calendar_event_id);
      await this.googleCalendarService.deleteTaskReminderEvent(
        userId,
        task.calendar_event_id,
      );
      console.log('  ✅ Calendar event deleted');
    } else {
      console.log('  ℹ️  No calendar event to delete');
    }

    // Update task to remove calendar sync
    const updatedTask = await this.prisma.tasks.update({
      where: { id: taskId },
      data: {
        calendar_reminder_enabled: false,
        calendar_event_id: null,
        calendar_reminder_time: null,
        last_synced_at: null,
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
      '  calendar_reminder_enabled:',
      updatedTask.calendar_reminder_enabled,
    );
    console.log('  calendar_event_id:', updatedTask.calendar_event_id);

    return updatedTask;
  }
}
