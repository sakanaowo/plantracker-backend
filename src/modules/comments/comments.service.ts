import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Create a comment on a task
   */
  async create(taskId: string, userId: string, dto: CreateCommentDto) {
    // Validate task exists and user has access
    const task = await this.validateTaskAccess(taskId, userId);

    // Create comment
    const comment = await this.prisma.task_comments.create({
      data: {
        task_id: taskId,
        user_id: userId,
        body: dto.body,
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
    });

    // Log activity
    await this.activityLogsService.logCommentCreated({
      taskId,
      commentId: comment.id,
      userId,
      workspaceId: task.projects.workspace_id,
      projectId: task.project_id,
      boardId: task.board_id,
      metadata: {
        commentBody: dto.body.substring(0, 100),
      },
    });

    // Get task assignees and creator for notification
    const notifyUserIds: string[] = [];
    // Add all assignees except the comment author
    task.task_assignees.forEach((assignment) => {
      if (assignment.user_id !== userId) {
        notifyUserIds.push(assignment.user_id);
      }
    });
    if (
      task.created_by &&
      task.created_by !== userId &&
      !notifyUserIds.includes(task.created_by)
    ) {
      notifyUserIds.push(task.created_by);
    }

    // Send comment notification to assignee/creator
    if (notifyUserIds.length > 0) {
      const commenter = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      await this.notificationsService.sendTaskComment({
        taskId,
        taskTitle: task.title,
        projectName: task.projects.name,
        commenterId: userId,
        commenterName: commenter?.name ?? 'Someone',
        commentBody: dto.body,
        notifyUserIds,
      });
    }

    // Emit WebSocket event to project for real-time comment update
    this.notificationsGateway.emitToProject(task.project_id, 'task_updated', {
      taskId,
      action: 'comment_created',
      comment,
    });
    console.log(`Emitted comment_created to project ${task.project_id}`);

    return comment;
  }

  /**
   * List comments for a task with pagination
   */
  async listByTask(
    taskId: string,
    userId: string,
    query: ListCommentsQueryDto,
  ) {
    // Validate task access
    await this.validateTaskAccess(taskId, userId);

    const limit = query.limit ?? 20;
    const sort = query.sort ?? 'desc';

    // Build where clause
    const where: Prisma.task_commentsWhereInput = { task_id: taskId };

    // Add cursor for pagination
    if (query.cursor) {
      const cursorComment = await this.prisma.task_comments.findUnique({
        where: { id: query.cursor },
      });

      if (cursorComment) {
        if (sort === 'desc') {
          where.created_at = { lt: cursorComment.created_at };
        } else {
          where.created_at = { gt: cursorComment.created_at };
        }
      }
    }

    // Fetch comments
    const comments = await this.prisma.task_comments.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: sort },
      take: limit + 1,
    });

    // Calculate pagination
    const hasMore = comments.length > limit;
    const data = hasMore ? comments.slice(0, -1) : comments;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }

  /**
   * Update a comment
   */
  async update(commentId: string, userId: string, dto: UpdateCommentDto) {
    // Get existing comment
    const oldComment = await this.prisma.task_comments.findUnique({
      where: { id: commentId },
      include: {
        tasks: {
          include: {
            projects: {
              select: { workspace_id: true },
            },
          },
        },
      },
    });

    if (!oldComment) {
      throw new NotFoundException('Comment not found');
    }

    // Check ownership
    if (oldComment.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    // Update comment
    const updated = await this.prisma.task_comments.update({
      where: { id: commentId },
      data: { body: dto.body },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
    });

    // Log activity
    await this.activityLogsService.logCommentUpdated({
      taskId: oldComment.task_id,
      commentId,
      userId,
      oldValue: { body: oldComment.body },
      newValue: { body: dto.body },
      metadata: { edited: true },
    });

    // Emit WebSocket event for real-time update
    this.notificationsGateway.emitToProject(
      oldComment.tasks.project_id,
      'task_updated',
      {
        taskId: oldComment.task_id,
        action: 'comment_updated',
        comment: updated,
      },
    );
    console.log(
      `Emitted comment_updated to project ${oldComment.tasks.project_id}`,
    );

    return updated;
  }

  /**
   * Delete a comment
   */
  async delete(commentId: string, userId: string) {
    const comment = await this.prisma.task_comments.findUnique({
      where: { id: commentId },
      include: {
        tasks: {
          include: {
            projects: {
              select: { workspace_id: true },
            },
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check ownership (or admin - TODO: implement admin check)
    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Delete comment
    await this.prisma.task_comments.delete({
      where: { id: commentId },
    });

    // Log activity
    await this.activityLogsService.logCommentDeleted({
      taskId: comment.task_id,
      commentId,
      userId,
      metadata: {
        body: comment.body.substring(0, 100),
      },
    });

    // Emit WebSocket event for real-time update
    this.notificationsGateway.emitToProject(
      comment.tasks.project_id,
      'task_updated',
      {
        taskId: comment.task_id,
        action: 'comment_deleted',
        commentId,
      },
    );
    console.log(
      `Emitted comment_deleted to project ${comment.tasks.project_id}`,
    );

    return { success: true, deletedId: commentId };
  }

  /**
   * Helper: Validate task exists and user has access
   */
  private async validateTaskAccess(taskId: string, userId: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
        task_assignees: {
          include: {
            users: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        projects: {
          include: {
            workspaces: {
              include: {
                memberships: {
                  where: { user_id: userId },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.projects.workspaces.memberships.length === 0) {
      throw new ForbiddenException('Access denied to this task');
    }

    return task;
  }
}
