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
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Check if user has Google Calendar connected
    const integration = await this.prisma.integration_tokens.findFirst({
      where: {
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
      },
    });

    const hasCalendarIntegration = !!integration;

    // Prepare update data
    const dataToUpdate: any = {};

    if (updateData.title !== undefined && updateData.title !== null) {
      dataToUpdate.title = updateData.title;
    }

    if (updateData.dueAt !== undefined && updateData.dueAt !== null) {
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
        // Create new calendar event for this user
        const calendarEventId =
          await this.googleCalendarService.createTaskReminderEvent(
            userId,
            taskId,
            taskTitle,
            taskDueAt,
            reminderTime,
          );

        // ✅ Add userId to task_calendar_sync_users array
        const currentSyncUsers = task.task_calendar_sync_users || [];
        if (!currentSyncUsers.includes(userId)) {
          dataToUpdate.task_calendar_sync_users = [...currentSyncUsers, userId];
        }
      } else if (!updateData.calendarReminderEnabled) {
        // ✅ Remove userId from task_calendar_sync_users array
        const currentSyncUsers = task.task_calendar_sync_users || [];
        dataToUpdate.task_calendar_sync_users = currentSyncUsers.filter(
          (id) => id !== userId,
        );
      }
    }

    // Update task in database

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

    return updatedTask;
  }

  /**
   * Unsync task from Google Calendar (remove calendar event)
   */
  async unsyncTaskFromCalendar(userId: string, taskId: string): Promise<tasks> {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // ✅ Remove userId from task_calendar_sync_users array
    const currentSyncUsers = task.task_calendar_sync_users || [];
    const updatedSyncUsers = currentSyncUsers.filter((id) => id !== userId);

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

    return updatedTask;
  }
}
