import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly notificationsService: NotificationsService,
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

    // Parse @mentions and send notifications
    const mentionedUserIds = this.parseMentions(dto.body);
    if (mentionedUserIds.length > 0) {
      await this.notifyMentionedUsers({
        taskId,
        taskTitle: task.title,
        commentBody: dto.body,
        mentionedUserIds,
        commentAuthorId: userId,
      });
    }

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
    const where: any = { task_id: taskId };

    // Add cursor for pagination
    if (query.cursor) {
      const cursorComment = await this.prisma.task_comments.findUnique({
        where: { id: query.cursor },
      });

      if (cursorComment) {
        where.created_at =
          sort === 'desc'
            ? { lt: cursorComment.created_at }
            : { gt: cursorComment.created_at };
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

    return { success: true, deletedId: commentId };
  }

  /**
   * Helper: Parse @mentions from comment text
   * Supports format: @[userId]
   */
  private parseMentions(text: string): string[] {
    const mentionRegex = /@\[([a-f0-9-]{36})\]/g;
    const matches = [...text.matchAll(mentionRegex)];
    return matches.map((m) => m[1]);
  }

  /**
   * Helper: Send notifications to mentioned users
   */
  private async notifyMentionedUsers(params: {
    taskId: string;
    taskTitle: string;
    commentBody: string;
    mentionedUserIds: string[];
    commentAuthorId: string;
  }) {
    // Get comment author name
    const author = await this.prisma.users.findUnique({
      where: { id: params.commentAuthorId },
      select: { name: true },
    });

    const authorName = author?.name ?? 'Someone';

    // Send notification to each mentioned user (except author)
    for (const userId of params.mentionedUserIds) {
      if (userId === params.commentAuthorId) continue; // Don't notify self

      // TODO: Implement mention notification type in NotificationsService
      // For now, we skip this or use a generic notification
      // await this.notificationsService.sendMentionNotification({
      //   userId,
      //   taskId: params.taskId,
      //   taskTitle: params.taskTitle,
      //   mentionedBy: params.commentAuthorId,
      //   mentionedByName: authorName,
      //   commentBody: params.commentBody.substring(0, 100),
      // });
    }
  }

  /**
   * Helper: Validate task exists and user has access
   */
  private async validateTaskAccess(taskId: string, userId: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
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
