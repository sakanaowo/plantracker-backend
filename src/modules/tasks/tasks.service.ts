import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, tasks, task_comments } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  listByBoard(boardId: string): Promise<tasks[]> {
    return this.prisma.tasks.findMany({
      where: { board_id: boardId, deleted_at: null },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
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
    assigneeId?: string;
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

    // Auto-assign: If no assignee specified, assign to creator
    const finalAssigneeId = dto.assigneeId ?? dto.createdBy ?? null;

    const task = await this.prisma.tasks.create({
      data: {
        project_id: dto.projectId,
        board_id: dto.boardId,
        title: dto.title,
        assignee_id: finalAssigneeId,
        created_by: dto.createdBy ?? null,
        position: nextPos,
      },
    });

    // Get project with workspace_id for activity logging
    const project = await this.prisma.projects.findUnique({
      where: { id: dto.projectId },
      select: { name: true, workspace_id: true },
    });

    // Send notification if someone else is assigned (not self-assign)
    if (finalAssigneeId && finalAssigneeId !== dto.createdBy) {
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
        assigneeId: finalAssigneeId,
        assignedBy: dto.createdBy ?? 'system',
        assignedByName,
      });
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

      // Log task assignment (including auto-assign)
      if (finalAssigneeId && dto.createdBy) {
        await this.activityLogsService.logTaskAssigned({
          taskId: task.id,
          userId: dto.createdBy,
          newAssigneeId: finalAssigneeId,
          taskTitle: task.title,
        });
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
      assigneeId?: string;
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
        assignee_id: dto.assigneeId,
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
        });
      }
    }

    // Handle assignment changes
    if (
      dto.assigneeId &&
      dto.assigneeId !== currentTask.assignee_id &&
      dto.assigneeId !== dto.updatedBy
    ) {
      const assigner = dto.updatedBy
        ? await this.prisma.users.findUnique({
            where: { id: dto.updatedBy },
            select: { name: true },
          })
        : null;

      await this.notificationsService.sendTaskAssigned({
        taskId: updatedTask.id,
        taskTitle: updatedTask.title,
        projectName: currentTask.projects?.name ?? 'Project',
        assigneeId: dto.assigneeId,
        assignedBy: dto.updatedBy ?? 'system',
        assignedByName: assigner?.name ?? 'Hệ thống',
      });

      // Log assignment change
      if (dto.updatedBy) {
        if (currentTask.assignee_id) {
          // Re-assignment
          await this.activityLogsService.logTaskAssigned({
            taskId: id,
            userId: dto.updatedBy,
            oldAssigneeId: currentTask.assignee_id,
            newAssigneeId: dto.assigneeId,
            taskTitle: updatedTask.title,
          });
        } else {
          // Initial assignment
          await this.activityLogsService.logTaskAssigned({
            taskId: id,
            userId: dto.updatedBy,
            newAssigneeId: dto.assigneeId,
            taskTitle: updatedTask.title,
          });
        }
      }
    } else if (
      dto.assigneeId === null &&
      currentTask.assignee_id &&
      dto.updatedBy
    ) {
      // Unassignment
      await this.activityLogsService.logTaskUnassigned({
        taskId: id,
        userId: dto.updatedBy,
        oldAssigneeId: currentTask.assignee_id,
        taskTitle: updatedTask.title,
      });
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
      await this.activityLogsService.logTaskMoved({
        taskId: id,
        userId: movedBy,
        fromBoardId: currentTask.board_id,
        toBoardId: toBoardId,
        taskTitle: currentTask.title,
      });
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
      await this.activityLogsService.logTaskDeleted({
        taskId: id,
        userId: deletedBy,
        taskTitle: task.title,
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

    return this.prisma.tasks.create({
      data: {
        project_id: defaultProject.id,
        board_id: targetBoard.id,
        title: dto.title,
        description: dto.description ?? null,
        assignee_id: userId,
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
}
