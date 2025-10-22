import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, tasks, task_comments } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

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
  }): Promise<tasks> {
    const last = await this.prisma.tasks.findFirst({
      where: { board_id: dto.boardId, deleted_at: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPos = last?.position
      ? new Prisma.Decimal(last.position).plus(1024)
      : new Prisma.Decimal(1024);

    return this.prisma.tasks.create({
      data: {
        project_id: dto.projectId,
        board_id: dto.boardId,
        title: dto.title,
        assignee_id: dto.assigneeId ?? null,
        position: nextPos,
      },
    });
  }

  update(
    id: string,
    dto: { title?: string; description?: string; assigneeId?: string; position?: number },
  ): Promise<tasks> {
    return this.prisma.tasks.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        assignee_id: dto.assigneeId,
        position: dto.position,
      },
    });
  }

  // move + reorder: chuyển board và chèn giữa before/after
  async move(
    id: string,
    toBoardId: string,
    beforeId?: string,
    afterId?: string,
  ): Promise<tasks> {
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

    return this.prisma.tasks.update({
      where: { id },
      data: { board_id: toBoardId, position },
    });
  }

  // soft delete (nếu DB có cột deleted_at)
  softDelete(id: string): Promise<tasks> {
    return this.prisma.tasks.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  async createQuickTask(
    userId: string,
    dto: { title: string; description?: string },
  ): Promise<tasks> {
    const workspace = await this.prisma.workspaces.findFirst({
      where: {
        owner_id: userId,
        type: 'PERSONAL',
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
        type: 'PERSONAL',
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
