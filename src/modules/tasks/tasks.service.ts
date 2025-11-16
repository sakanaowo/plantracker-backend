import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, tasks, task_comments } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { GoogleCalendarService } from '../calendar/google-calendar.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  /**
   * Helper to get workspace/project/board context for a task
   */
  private async getTaskContext(taskId: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
        projects: {
          select: {
            id: true,
            workspace_id: true,
          },
        },
        boards: {
          select: {
            id: true,
          },
        },
      },
    });

    return {
      workspaceId: task?.projects?.workspace_id,
      projectId: task?.project_id,
      boardId: task?.board_id,
    };
  }

  listByBoard(boardId: string): Promise<tasks[]> {
    return this.prisma.tasks.findMany({
      where: { board_id: boardId, deleted_at: null },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
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
      },
    });
  }

  getById(id: string): Promise<tasks | null> {
    return this.prisma.tasks.findFirst({
      where: { id },
    });
  }

  async create(dto: {
    projectId: string;
    boardId: string;
    title: string;
    assigneeIds?: string[]; // ✅ Changed to array
    createdBy?: string;
    checklists?: Array<{
      title: string;
      items: string[];
    }>;
  }): Promise<tasks> {
    const last = await this.prisma.tasks.findFirst({
      where: { board_id: dto.boardId, deleted_at: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPos = last?.position
      ? new Prisma.Decimal(last.position).plus(1024)
      : new Prisma.Decimal(1024);

    // ✅ No auto-assign - only use explicitly provided assignees
    const assigneeIds = dto.assigneeIds ?? [];

    const task = await this.prisma.tasks.create({
      data: {
        project_id: dto.projectId,
        board_id: dto.boardId,
        title: dto.title,
        created_by: dto.createdBy ?? null,
        position: nextPos,
      },
    });

    // Create task_assignees records
    if (assigneeIds.length > 0) {
      await this.prisma.task_assignees.createMany({
        data: assigneeIds.map((userId) => ({
          task_id: task.id,
          user_id: userId,
          assigned_by: dto.createdBy ?? null,
        })),
      });
    }

    // Get project with workspace_id for activity logging
    const project = await this.prisma.projects.findUnique({
      where: { id: dto.projectId },
      select: { name: true, workspace_id: true },
    });

    // Send notifications to all assignees (except creator if auto-assigned)
    for (const assigneeId of assigneeIds) {
      if (assigneeId !== dto.createdBy) {
        let assignedByName = 'Hệ thống';

        if (dto.createdBy) {
          const assigner = await this.prisma.users.findUnique({
            where: { id: dto.createdBy },
            select: { name: true },
          });
          assignedByName = assigner?.name ?? assignedByName;
        }

        await this.notificationsService.sendTaskAssigned({
          taskId: task.id,
          taskTitle: task.title,
          projectName: project?.name ?? 'Project',
          assigneeId: assigneeId,
          assignedBy: dto.createdBy ?? 'system',
          assignedByName,
        });
      }
    }

    // Log task creation
    if (project?.workspace_id) {
      await this.activityLogsService.logTaskCreated({
        taskId: task.id,
        userId: dto.createdBy ?? 'system',
        workspaceId: project.workspace_id,
        projectId: dto.projectId,
        boardId: dto.boardId,
        taskTitle: task.title,
      });

      // Log task assignments
      if (assigneeIds.length > 0 && dto.createdBy) {
        for (const assigneeId of assigneeIds) {
          await this.activityLogsService.logTaskAssigned({
            taskId: task.id,
            userId: dto.createdBy,
            newAssigneeId: assigneeId,
            taskTitle: task.title,
            workspaceId: project.workspace_id,
            projectId: dto.projectId,
            boardId: dto.boardId,
          });
        }
      }
    }

    // Create checklists if provided
    if (dto.checklists && dto.checklists.length > 0) {
      for (const checklistData of dto.checklists) {
        const checklist = await this.prisma.checklists.create({
          data: {
            task_id: task.id,
            title: checklistData.title,
          },
        });

        // Create checklist items
        if (checklistData.items && checklistData.items.length > 0) {
          await this.prisma.checklist_items.createMany({
            data: checklistData.items.map((content, index) => ({
              checklist_id: checklist.id,
              content,
              position: new Prisma.Decimal((index + 1) * 1024),
              is_done: false,
            })),
          });
        }
      }
    }

    return task;
  }

  async update(
    id: string,
    dto: {
      title?: string;
      description?: string;
      position?: number;
      updatedBy?: string;
    },
  ): Promise<tasks> {
    const currentTask = await this.prisma.tasks.findUnique({
      where: { id },
      include: {
        projects: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!currentTask) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const updatedTask = await this.prisma.tasks.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        position: dto.position,
      },
    });

    // Log task update
    if (dto.updatedBy) {
      const changes: Record<string, { old: string | null; new: string }> = {};
      if (dto.title !== undefined && dto.title !== currentTask.title) {
        changes.title = { old: currentTask.title, new: dto.title };
      }
      if (
        dto.description !== undefined &&
        dto.description !== currentTask.description
      ) {
        changes.description = {
          old: currentTask.description,
          new: dto.description,
        };
      }

      if (Object.keys(changes).length > 0) {
        const context = await this.getTaskContext(id);
        await this.activityLogsService.logTaskUpdated({
          taskId: id,
          userId: dto.updatedBy,
          taskTitle: updatedTask.title,
          oldValue: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v.old]),
          ),
          newValue: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v.new]),
          ),
          ...context,
        });
      }
    }

    return updatedTask;
  }

  // move + reorder: chuyển board và chèn giữa before/after
  async move(
    id: string,
    toBoardId: string,
    beforeId?: string,
    afterId?: string,
    movedBy?: string,
  ): Promise<tasks> {
    // Get current task info before moving
    const currentTask = await this.prisma.tasks.findUnique({
      where: { id },
      select: { board_id: true, title: true },
    });

    let position = new Prisma.Decimal(1024);

    if (beforeId || afterId) {
      const [before, after] = await Promise.all([
        beforeId
          ? this.prisma.tasks.findUnique({
              where: { id: beforeId },
              select: { position: true },
            })
          : null,
        afterId
          ? this.prisma.tasks.findUnique({
              where: { id: afterId },
              select: { position: true },
            })
          : null,
      ]);

      if (before && after) {
        position = new Prisma.Decimal(before.position)
          .plus(after.position)
          .dividedBy(2);
      } else if (before) {
        position = new Prisma.Decimal(before.position).minus(1);
      } else if (after) {
        position = new Prisma.Decimal(after.position).plus(1);
      }
    } else {
      const last = await this.prisma.tasks.findFirst({
        where: { board_id: toBoardId, deleted_at: null },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = last?.position
        ? new Prisma.Decimal(last.position).plus(1024)
        : new Prisma.Decimal(1024);
    }

    const updatedTask = await this.prisma.tasks.update({
      where: { id },
      data: { board_id: toBoardId, position },
    });

    // Log task move if board changed
    if (movedBy && currentTask && currentTask.board_id !== toBoardId) {
      const context = await this.getTaskContext(id);
      await this.activityLogsService.logTaskMoved({
        taskId: id,
        userId: movedBy,
        fromBoardId: currentTask.board_id,
        toBoardId: toBoardId,
        taskTitle: currentTask.title,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
      });

      // 🔔 Send TASK_MOVED notification
      try {
        // Get board names for notification
        const [fromBoard, toBoard] = await Promise.all([
          this.prisma.boards.findUnique({
            where: { id: currentTask.board_id },
            select: { name: true },
          }),
          this.prisma.boards.findUnique({
            where: { id: toBoardId },
            select: { name: true },
          }),
        ]);

        // Get project members to notify (exclude mover)
        const projectMembers = await this.prisma.project_members.findMany({
          where: {
            project_id: context.projectId,
            user_id: { not: movedBy },
          },
          select: { user_id: true },
        });

        // Get mover info
        const mover = await this.prisma.users.findUnique({
          where: { id: movedBy },
          select: { name: true, email: true },
        });

        if (projectMembers.length > 0 && mover) {
          await this.notificationsService.sendTaskMoved({
            taskId: id,
            taskTitle: currentTask.title,
            fromBoard: fromBoard?.name,
            toBoard: toBoard?.name,
            movedBy,
            movedByName: mover.name || mover.email,
            notifyUserIds: projectMembers.map((m) => m.user_id),
          });
        }
      } catch (error) {
        // Silently fail notification - don't block task move
        console.error('Failed to send task moved notification:', error);
      }
    }

    return updatedTask;
  }

  // soft delete (nếu DB có cột deleted_at)
  async softDelete(id: string, deletedBy?: string): Promise<tasks> {
    const task = await this.prisma.tasks.findUnique({
      where: { id },
      select: { title: true },
    });

    const deletedTask = await this.prisma.tasks.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    // Log task deletion
    if (deletedBy && task) {
      const context = await this.getTaskContext(id);
      await this.activityLogsService.logTaskDeleted({
        taskId: id,
        userId: deletedBy,
        taskTitle: task.title,
        ...context,
      });
    }

    return deletedTask;
  }

  async createQuickTask(
    userId: string,
    dto: { title: string; description?: string },
  ): Promise<tasks> {
    const workspace = await this.prisma.workspaces.findFirst({
      where: {
        owner_id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException(
        'Personal workspace not found. Please create a workspace first.',
      );
    }

    const defaultProject = await this.prisma.projects.findFirst({
      where: {
        workspace_id: workspace.id,
      },
      orderBy: {
        created_at: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!defaultProject) {
      throw new NotFoundException(
        'No projects found in your workspace. Please create a project first.',
      );
    }

    const todoBoard = await this.prisma.boards.findFirst({
      where: {
        project_id: defaultProject.id,
        name: {
          in: ['To Do', 'TODO', 'Todo', 'to do'],
        },
      },
      select: {
        id: true,
      },
    });

    const targetBoard =
      todoBoard ||
      (await this.prisma.boards.findFirst({
        where: {
          project_id: defaultProject.id,
        },
        orderBy: {
          order: 'asc',
        },
        select: {
          id: true,
        },
      }));

    if (!targetBoard) {
      throw new NotFoundException(
        `No boards found in project "${defaultProject.name}". Please create a board first.`,
      );
    }

    const lastTask = await this.prisma.tasks.findFirst({
      where: {
        board_id: targetBoard.id,
        deleted_at: null,
      },
      orderBy: {
        position: 'desc',
      },
      select: {
        position: true,
      },
    });

    const nextPosition = lastTask?.position
      ? new Prisma.Decimal(lastTask.position).plus(1024)
      : new Prisma.Decimal(1024);

    // Create task (no auto-assign for quick tasks)
    return this.prisma.tasks.create({
      data: {
        project_id: defaultProject.id,
        board_id: targetBoard.id,
        title: dto.title,
        description: dto.description ?? null,
        created_by: userId,
        position: nextPosition,
      },
    });
  }

  // ==================== COMMENTS ====================

  /**
   * Lấy tất cả comments của một task
   */
  async getComments(taskId: string): Promise<task_comments[]> {
    return this.prisma.task_comments.findMany({
      where: { task_id: taskId },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Lấy một comment cụ thể
   */
  async getComment(commentId: string): Promise<task_comments | null> {
    return this.prisma.task_comments.findUnique({
      where: { id: commentId },
    });
  }

  /**
   * Tạo comment mới cho task
   * userId được lấy tự động từ authentication guard (database user ID)
   */
  async createComment(
    taskId: string,
    userId: string,
    body: string,
  ): Promise<task_comments> {
    // Kiểm tra task có tồn tại không
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return this.prisma.task_comments.create({
      data: {
        task_id: taskId,
        user_id: userId,
        body,
      },
    });
  }

  /**
   * Cập nhật comment
   * Chỉ user tạo comment mới được phép cập nhật
   */
  async updateComment(
    commentId: string,
    userId: string,
    body: string,
  ): Promise<task_comments> {
    // Kiểm tra comment có tồn tại không
    const comment = await this.prisma.task_comments.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    // Kiểm tra user có phải là người tạo comment không
    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    return this.prisma.task_comments.update({
      where: { id: commentId },
      data: { body },
    });
  }

  /**
   * Xóa comment
   * Chỉ user tạo comment mới được phép xóa
   */
  async deleteComment(
    commentId: string,
    userId: string,
  ): Promise<task_comments> {
    // Kiểm tra comment có tồn tại không
    const comment = await this.prisma.task_comments.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    // Kiểm tra user có phải là người tạo comment không
    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    return this.prisma.task_comments.delete({
      where: { id: commentId },
    });
  }

  async getQuickTaskDefaults(userId: string): Promise<tasks[]> {
    const workspace = await this.prisma.workspaces.findFirst({
      where: {
        owner_id: userId,
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found for the user.');
    }

    // Lấy project đầu tiên (mặc định)
    const defaultProject = await this.prisma.projects.findFirst({
      where: { workspace_id: workspace.id },
      orderBy: { created_at: 'asc' },
    });
    if (!defaultProject) {
      throw new NotFoundException('No projects found in the workspace.');
    }

    const todoBoard = await this.prisma.boards.findFirst({
      where: {
        project_id: defaultProject.id,
        name: { in: ['To Do', 'TODO', 'Todo', 'to do'] },
      },
    });

    const targetBoard =
      todoBoard ||
      (await this.prisma.boards.findFirst({
        where: { project_id: defaultProject.id },
        orderBy: { order: 'asc' },
      }));

    if (!targetBoard) {
      throw new NotFoundException('No boards found');
    }

    return this.prisma.tasks.findMany({
      where: {
        board_id: targetBoard.id,
        deleted_at: null,
      },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
  }

  /**
   * Get all assignees for a task
   */
  async getAssignees(taskId: string) {
    return this.prisma.task_assignees.findMany({
      where: { task_id: taskId },
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
      orderBy: { assigned_at: 'asc' },
    });
  }

  /**
   * Assign multiple users to a task
   */
  async assignUsers(
    taskId: string,
    userIds: string[],
    assignedBy?: string,
  ): Promise<void> {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, project_id: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Get existing assignees
    const existingAssignees = await this.prisma.task_assignees.findMany({
      where: { task_id: taskId },
      select: { user_id: true },
    });

    const existingUserIds = new Set(existingAssignees.map((a) => a.user_id));

    // Filter out users who are already assigned
    const newUserIds = userIds.filter((userId) => !existingUserIds.has(userId));

    if (newUserIds.length === 0) {
      return; // All users already assigned
    }

    // Create new assignments
    await this.prisma.task_assignees.createMany({
      data: newUserIds.map((userId) => ({
        task_id: taskId,
        user_id: userId,
        assigned_by: assignedBy ?? null,
      })),
    });

    // Get project info for notifications
    const project = await this.prisma.projects.findUnique({
      where: { id: task.project_id },
      select: { name: true, workspace_id: true },
    });

    // Send notifications to new assignees (except the person who assigned)
    for (const userId of newUserIds) {
      if (userId !== assignedBy) {
        let assignedByName = 'Hệ thống';

        if (assignedBy) {
          const assigner = await this.prisma.users.findUnique({
            where: { id: assignedBy },
            select: { name: true },
          });
          assignedByName = assigner?.name ?? assignedByName;
        }

        await this.notificationsService.sendTaskAssigned({
          taskId: task.id,
          taskTitle: task.title,
          projectName: project?.name ?? 'Project',
          assigneeId: userId,
          assignedBy: assignedBy ?? 'system',
          assignedByName,
        });
      }

      // Log assignment
      if (assignedBy && project?.workspace_id) {
        const context = await this.getTaskContext(taskId);
        await this.activityLogsService.logTaskAssigned({
          taskId,
          userId: assignedBy,
          newAssigneeId: userId,
          taskTitle: task.title,
          ...context,
        });
      }
    }
  }

  /**
   * Unassign a user from a task
   */
  async unassignUser(
    taskId: string,
    userId: string,
    unassignedBy?: string,
  ): Promise<void> {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      select: { id: true, title: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const assignment = await this.prisma.task_assignees.findUnique({
      where: {
        task_id_user_id: {
          task_id: taskId,
          user_id: userId,
        },
      },
    });

    if (!assignment) {
      return; // User not assigned, nothing to do
    }

    // Delete assignment
    await this.prisma.task_assignees.delete({
      where: {
        task_id_user_id: {
          task_id: taskId,
          user_id: userId,
        },
      },
    });

    // Log unassignment
    if (unassignedBy) {
      const context = await this.getTaskContext(taskId);
      await this.activityLogsService.logTaskUnassigned({
        taskId,
        userId: unassignedBy,
        oldAssigneeId: userId,
        taskTitle: task.title,
        ...context,
      });
    }
  }

  /**
   * Unassign all users from a task
   */
  async unassignAll(taskId: string, unassignedBy?: string): Promise<void> {
    const assignees = await this.prisma.task_assignees.findMany({
      where: { task_id: taskId },
      select: { user_id: true },
    });

    for (const assignee of assignees) {
      await this.unassignUser(taskId, assignee.user_id, unassignedBy);
    }
  }

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
   * Get tasks with calendar info for Calendar Tab
   */
  async getTasksForCalendar(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const tasks = await this.prisma.tasks.findMany({
      where: {
        project_id: projectId,
        due_at: {
          gte: startDate,
          lte: endDate,
        },
        deleted_at: null,
      },
      include: {
        users_tasks_created_byTousers: {
          select: {
            name: true,
            email: true,
            avatar_url: true,
          },
        },
        boards: {
          select: { name: true },
        },
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
      },
      orderBy: { due_at: 'asc' },
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      dueAt: task.due_at,
      priority: task.priority,
      hasReminder: task.calendar_reminder_enabled,
      reminderTime: task.calendar_reminder_time,
      calendarEventId: task.calendar_event_id,
      lastSyncedAt: task.last_synced_at,
      creator: task.users_tasks_created_byTousers,
      boardName: task.boards.name,
      assignees: task.task_assignees.map((a) => a.users),
    }));
  }
}
