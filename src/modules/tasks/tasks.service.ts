import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, tasks, task_comments, issue_status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { TaskCalendarSyncService } from '../calendar/task-calendar-sync.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly taskCalendarSyncService: TaskCalendarSyncService,
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

  listByBoard(boardId: string) {
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
        boards: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getMyAssignedTasksInProject(
    userId: string,
    projectId: string,
  ): Promise<tasks[]> {
    return this.prisma.tasks.findMany({
      where: {
        project_id: projectId,
        deleted_at: null,
        task_assignees: {
          some: {
            user_id: userId,
          },
        },
      },
      orderBy: [{ due_at: 'asc' }, { created_at: 'asc' }],
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
        boards: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get ALL tasks in a project (not just assigned to current user)
   * For "All Work" view in project - shows complete project overview
   */
  async getAllTasksInProject(projectId: string): Promise<tasks[]> {
    return this.prisma.tasks.findMany({
      where: {
        project_id: projectId,
        deleted_at: null,
      },
      orderBy: [
        { status: 'asc' }, // Group by status first (TO_DO, IN_PROGRESS, DONE)
        { due_at: 'asc' }, // Then by due date
        { created_at: 'desc' }, // Then by creation date (newest first)
      ],
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
        boards: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get statistics for All Work view
   * Returns counts by status, overdue tasks, and total tasks
   */
  async getAllWorkStatistics(projectId: string) {
    const now = new Date();

    // Get all active tasks
    const allTasks = await this.prisma.tasks.findMany({
      where: {
        project_id: projectId,
        deleted_at: null,
      },
      select: {
        status: true,
        due_at: true,
      },
    });

    // Count by status
    const todoCount = allTasks.filter((t) => t.status === 'TO_DO').length;
    const inProgressCount = allTasks.filter(
      (t) => t.status === 'IN_PROGRESS',
    ).length;
    const doneCount = allTasks.filter((t) => t.status === 'DONE').length;

    // Count overdue (has due_at in past and not DONE)
    const overdueCount = allTasks.filter(
      (t) => t.due_at && t.due_at < now && t.status !== 'DONE',
    ).length;

    return {
      totalCount: allTasks.length,
      todoCount,
      inProgressCount,
      doneCount,
      overdueCount,
    };
  }

  getById(id: string): Promise<tasks | null> {
    return this.prisma.tasks.findFirst({
      where: { id },
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
        boards: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

    // ✅ Get board to determine correct status based on board name
    const board = await this.prisma.boards.findUnique({
      where: { id: dto.boardId },
      select: { name: true },
    });

    // Map board name to status
    let status: issue_status = issue_status.TO_DO; // Default
    if (board) {
      const boardName = board.name.toLowerCase();
      if (
        boardName.includes('to do') ||
        boardName.includes('todo') ||
        boardName.includes('backlog')
      ) {
        status = issue_status.TO_DO;
      } else if (
        boardName.includes('in progress') ||
        boardName.includes('doing')
      ) {
        status = issue_status.IN_PROGRESS;
      } else if (
        boardName.includes('review') ||
        boardName.includes('testing')
      ) {
        status = issue_status.IN_REVIEW;
      } else if (
        boardName.includes('done') ||
        boardName.includes('completed')
      ) {
        status = issue_status.DONE;
      }
    }

    const task = await this.prisma.tasks.create({
      data: {
        project_id: dto.projectId,
        board_id: dto.boardId,
        title: dto.title,
        status: status, // ✅ Set status based on board name
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
      dueAt?: string;
      startAt?: string;
      priority?: string;
      type?: string;
      status?: string;
      sprintId?: string;
      epicId?: string;
      parentTaskId?: string;
      storyPoints?: number;
      originalEstimateSec?: number;
      remainingEstimateSec?: number;
      calendarReminderEnabled?: boolean;
      calendarReminderTime?: number;
      updatedBy?: string;
    },
  ): Promise<tasks> {
    console.log('\n🔵 [TASK-UPDATE] Starting update for task:', id);
    console.log('  DTO received:', JSON.stringify(dto, null, 2));

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

    // Prepare update data with type conversions
    // ✅ ONLY update fields that are explicitly set AND not null
    const updateData: any = {};

    if (dto.title !== undefined && dto.title !== null)
      updateData.title = dto.title;
    if (dto.description !== undefined && dto.description !== null)
      updateData.description = dto.description;
    // ⚠️ Position should ONLY be updated via move() method, not here
    if (dto.position !== undefined && dto.position !== null)
      updateData.position = dto.position;

    // Date fields - convert string to Date (allow explicit null to clear dates)
    if (dto.dueAt !== undefined) {
      updateData.due_at = dto.dueAt ? new Date(dto.dueAt) : null;
    }
    if (dto.startAt !== undefined) {
      updateData.start_at = dto.startAt ? new Date(dto.startAt) : null;
    }

    // Enum fields - skip if null
    if (dto.priority !== undefined && dto.priority !== null)
      updateData.priority = dto.priority;
    if (dto.type !== undefined && dto.type !== null) updateData.type = dto.type;
    if (dto.status !== undefined && dto.status !== null)
      updateData.status = dto.status;

    // Relationship fields - skip if null (not implemented yet)
    if (dto.sprintId !== undefined && dto.sprintId !== null)
      updateData.sprint_id = dto.sprintId;
    if (dto.epicId !== undefined && dto.epicId !== null)
      updateData.epic_id = dto.epicId;
    if (dto.parentTaskId !== undefined && dto.parentTaskId !== null)
      updateData.parent_task_id = dto.parentTaskId;

    // Numeric fields - skip if null (not implemented yet)
    if (dto.storyPoints !== undefined && dto.storyPoints !== null)
      updateData.story_points = dto.storyPoints;
    if (
      dto.originalEstimateSec !== undefined &&
      dto.originalEstimateSec !== null
    )
      updateData.original_estimate_sec = dto.originalEstimateSec;
    if (
      dto.remainingEstimateSec !== undefined &&
      dto.remainingEstimateSec !== null
    )
      updateData.remaining_estimate_sec = dto.remainingEstimateSec;

    // Calendar sync fields - allow boolean false, skip only if null
    if (
      dto.calendarReminderEnabled !== undefined &&
      dto.calendarReminderEnabled !== null
    )
      updateData.calendar_reminder_enabled = dto.calendarReminderEnabled;
    if (
      dto.calendarReminderTime !== undefined &&
      dto.calendarReminderTime !== null
    )
      updateData.calendar_reminder_time = dto.calendarReminderTime;

    console.log(
      '  📝 Update data prepared:',
      JSON.stringify(updateData, null, 2),
    );

    const updatedTask = await this.prisma.tasks.update({
      where: { id },
      data: updateData,
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

    console.log('  ✅ Task updated successfully');
    console.log('    - Title:', updatedTask.title);
    console.log(
      '    - Description:',
      updatedTask.description?.substring(0, 50) || 'null',
    );
    console.log('    - Priority:', updatedTask.priority);
    console.log('    - Due At:', updatedTask.due_at);
    console.log(
      '    - Calendar Enabled:',
      updatedTask.calendar_reminder_enabled,
    );
    console.log(
      '    - Assignees count:',
      updatedTask.task_assignees?.length || 0,
    );
    console.log('    - Labels count:', updatedTask.task_labels?.length || 0);

    // Log task update
    if (dto.updatedBy) {
      const changes: Record<string, { old: any; new: any }> = {};

      // Track text changes
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

      // Track date changes
      if (dto.dueAt !== undefined) {
        const newDueAt = dto.dueAt ? new Date(dto.dueAt) : null;
        if (newDueAt?.getTime() !== currentTask.due_at?.getTime()) {
          changes.dueAt = { old: currentTask.due_at, new: newDueAt };
        }
      }
      if (dto.startAt !== undefined) {
        const newStartAt = dto.startAt ? new Date(dto.startAt) : null;
        if (newStartAt?.getTime() !== currentTask.start_at?.getTime()) {
          changes.startAt = { old: currentTask.start_at, new: newStartAt };
        }
      }

      // Track enum changes
      if (dto.priority !== undefined && dto.priority !== currentTask.priority) {
        changes.priority = { old: currentTask.priority, new: dto.priority };
      }
      if (dto.type !== undefined && dto.type !== currentTask.type) {
        changes.type = { old: currentTask.type, new: dto.type };
      }
      if (dto.status !== undefined && dto.status !== currentTask.status) {
        changes.status = { old: currentTask.status, new: dto.status };
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

    // Get target board to determine status
    const toBoard = await this.prisma.boards.findUnique({
      where: { id: toBoardId },
      select: { name: true },
    });

    // Map board name to status
    let newStatus: issue_status | undefined;
    if (toBoard) {
      const boardName = toBoard.name.toLowerCase();
      if (
        boardName.includes('to do') ||
        boardName.includes('todo') ||
        boardName.includes('backlog')
      ) {
        newStatus = issue_status.TO_DO;
      } else if (
        boardName.includes('in progress') ||
        boardName.includes('doing')
      ) {
        newStatus = issue_status.IN_PROGRESS;
      } else if (
        boardName.includes('review') ||
        boardName.includes('testing')
      ) {
        newStatus = issue_status.IN_REVIEW;
      } else if (
        boardName.includes('done') ||
        boardName.includes('completed')
      ) {
        newStatus = issue_status.DONE;
      }
    }

    // Update task with new board_id, position, and status
    const updateData: any = { board_id: toBoardId, position };
    if (newStatus) {
      updateData.status = newStatus;
    }

    const updatedTask = await this.prisma.tasks.update({
      where: { id },
      data: updateData,
    });

    // Log task move if board changed
    if (movedBy && currentTask && currentTask.board_id !== toBoardId) {
      const context = await this.getTaskContext(id);

      // Get board names for activity log and notification
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

      await this.activityLogsService.logTaskMoved({
        taskId: id,
        userId: movedBy,
        fromBoardId: currentTask.board_id,
        toBoardId: toBoardId,
        fromBoardName: fromBoard?.name,
        toBoardName: toBoard?.name,
        taskTitle: currentTask.title,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
      });

      // 🔔 Send TASK_MOVED notification
      try {
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
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
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
   * Update task with calendar sync (delegates to TaskCalendarSyncService)
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
    return this.taskCalendarSyncService.updateTaskWithCalendarSync(
      userId,
      taskId,
      updateData,
    );
  }

  /**
   * Unsync task from Google Calendar (delegates to TaskCalendarSyncService)
   */
  async unsyncTaskFromCalendar(userId: string, taskId: string): Promise<tasks> {
    return this.taskCalendarSyncService.unsyncTaskFromCalendar(userId, taskId);
  }

  /**
   * Get tasks with calendar info for Calendar Tab
   * Returns tasks in the same format as listByBoard for consistency
   */
  async getTasksForCalendar(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.prisma.tasks.findMany({
      where: {
        project_id: projectId,
        due_at: {
          gte: startDate,
          lte: endDate,
        },
        deleted_at: null,
      },
      include: {
        boards: {
          select: {
            id: true,
            name: true,
          },
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
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: [
        { due_at: 'asc' },
        { priority: 'desc' },
        { created_at: 'desc' },
      ],
    });
  }

  /**
   * Sync status field for all tasks in a project based on their board names
   * Use this to fix existing tasks after deploying status sync feature
   */
  async syncTaskStatusByBoard(projectId: string): Promise<{
    updated: number;
    message: string;
  }> {
    console.log(
      `\n🔄 [SYNC-STATUS] Starting status sync for project: ${projectId}`,
    );

    // Get all tasks with their boards
    const tasks = await this.prisma.tasks.findMany({
      where: {
        project_id: projectId,
        deleted_at: null,
      },
      include: {
        boards: {
          select: { id: true, name: true },
        },
      },
    });

    console.log(`  📋 Found ${tasks.length} tasks to check`);

    let updatedCount = 0;

    for (const task of tasks) {
      const boardName = task.boards.name.toLowerCase();

      // Determine correct status from board name
      let newStatus: issue_status | null = null;
      if (
        boardName.includes('to do') ||
        boardName.includes('todo') ||
        boardName.includes('backlog')
      ) {
        newStatus = issue_status.TO_DO;
      } else if (
        boardName.includes('in progress') ||
        boardName.includes('doing')
      ) {
        newStatus = issue_status.IN_PROGRESS;
      } else if (
        boardName.includes('review') ||
        boardName.includes('testing')
      ) {
        newStatus = issue_status.IN_REVIEW;
      } else if (
        boardName.includes('done') ||
        boardName.includes('completed')
      ) {
        newStatus = issue_status.DONE;
      }

      // Update if status doesn't match
      if (newStatus && task.status !== newStatus) {
        console.log(
          `  ✏️  Updating task "${task.title}" (board: ${task.boards.name})`,
        );
        console.log(`     ${task.status} → ${newStatus}`);

        await this.prisma.tasks.update({
          where: { id: task.id },
          data: { status: newStatus },
        });

        updatedCount++;
      }
    }

    console.log(`\n✅ [SYNC-STATUS] Complete! Updated ${updatedCount} tasks`);

    return {
      updated: updatedCount,
      message: `Successfully synced status for ${updatedCount} out of ${tasks.length} tasks`,
    };
  }
}
