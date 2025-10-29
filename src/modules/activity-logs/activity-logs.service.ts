import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { activity_action, entity_type, Prisma } from '@prisma/client';

interface BaseLogParams {
  workspaceId?: string;
  projectId?: string;
  boardId?: string;
  taskId?: string;
  checklistItemId?: string;
  userId: string;
  action: activity_action;
  entityType: entity_type;
  entityId?: string;
  entityName?: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
}

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generic method to create activity log
   */
  private async log(data: BaseLogParams) {
    try {
      const result = await this.prisma.activity_logs.create({
        data: {
          workspace_id: data.workspaceId ?? null,
          project_id: data.projectId ?? null,
          board_id: data.boardId ?? null,
          task_id: data.taskId ?? null,
          checklist_item_id: data.checklistItemId ?? null,
          user_id: data.userId,
          action: data.action,
          entity_type: data.entityType,
          entity_id: data.entityId ?? null,
          entity_name: data.entityName ?? null,
          old_value: data.oldValue ?? null,
          new_value: data.newValue ?? null,
          metadata: data.metadata ?? null,
        },
      });
      console.log(`✅ Activity log created: ${data.action} ${data.entityType} by ${data.userId}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to create activity log:', error);
      console.error('Data:', JSON.stringify(data, null, 2));
      throw error;
    }
  }

  // ============================================================================
  // COMMENT ACTIONS
  // ============================================================================

  async logCommentCreated(params: {
    taskId: string;
    commentId: string;
    userId: string;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
    metadata?: any;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'COMMENTED',
      entityType: 'COMMENT',
      entityId: params.commentId,
      metadata: params.metadata,
    });
  }

  async logCommentUpdated(params: {
    taskId: string;
    commentId: string;
    userId: string;
    oldValue: any;
    newValue: any;
    metadata?: any;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'UPDATED',
      entityType: 'COMMENT',
      entityId: params.commentId,
      oldValue: params.oldValue,
      newValue: params.newValue,
      metadata: params.metadata,
    });
  }

  async logCommentDeleted(params: {
    taskId: string;
    commentId: string;
    userId: string;
    metadata?: any;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'DELETED',
      entityType: 'COMMENT',
      entityId: params.commentId,
      metadata: params.metadata,
    });
  }

  // ============================================================================
  // ATTACHMENT ACTIONS
  // ============================================================================

  async logAttachmentAdded(params: {
    taskId: string;
    attachmentId: string;
    userId: string;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
    metadata?: any;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'ATTACHED',
      entityType: 'ATTACHMENT',
      entityId: params.attachmentId,
      metadata: params.metadata,
    });
  }

  async logAttachmentRemoved(params: {
    taskId: string;
    attachmentId: string;
    userId: string;
    metadata?: any;
  }) {
    return this.log({
      taskId: params.taskId,
      userId: params.userId,
      action: 'REMOVED',
      entityType: 'ATTACHMENT',
      entityId: params.attachmentId,
      metadata: params.metadata,
    });
  }

  // ============================================================================
  // TASK ACTIONS
  // ============================================================================

  async logTaskCreated(params: {
    workspaceId: string;
    projectId: string;
    boardId: string;
    taskId: string;
    userId: string;
    taskTitle: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'CREATED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
    });
  }

  async logTaskUpdated(params: {
    taskId: string;
    userId: string;
    taskTitle?: string;
    oldValue: any;
    newValue: any;
    metadata?: any;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'UPDATED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
      oldValue: params.oldValue,
      newValue: params.newValue,
      metadata: params.metadata,
    });
  }

  async logTaskAssigned(params: {
    taskId: string;
    userId: string;
    oldAssigneeId?: string;
    newAssigneeId: string;
    taskTitle: string;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'ASSIGNED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
      oldValue: params.oldAssigneeId
        ? { assigneeId: params.oldAssigneeId }
        : null,
      newValue: { assigneeId: params.newAssigneeId },
    });
  }

  async logTaskUnassigned(params: {
    taskId: string;
    userId: string;
    oldAssigneeId: string;
    taskTitle: string;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'UNASSIGNED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
      oldValue: { assigneeId: params.oldAssigneeId },
      newValue: null,
    });
  }

  async logTaskMoved(params: {
    taskId: string;
    userId: string;
    fromBoardId: string;
    toBoardId: string;
    taskTitle: string;
    workspaceId?: string;
    projectId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.toBoardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'MOVED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
      oldValue: { boardId: params.fromBoardId },
      newValue: { boardId: params.toBoardId },
    });
  }

  async logTaskCompleted(params: {
    taskId: string;
    userId: string;
    taskTitle: string;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'COMPLETED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
    });
  }

  async logTaskReopened(params: {
    taskId: string;
    userId: string;
    taskTitle: string;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'REOPENED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
    });
  }

  async logTaskDeleted(params: {
    taskId: string;
    userId: string;
    taskTitle: string;
    metadata?: any;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'DELETED',
      entityType: 'TASK',
      entityId: params.taskId,
      entityName: params.taskTitle,
      metadata: params.metadata,
    });
  }

  // ============================================================================
  // LABEL ACTIONS
  // ============================================================================

  async logLabelAdded(params: {
    taskId: string;
    labelId: string;
    userId: string;
    labelName: string;
    labelColor?: string;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'ADDED',
      entityType: 'LABEL',
      entityId: params.labelId,
      entityName: params.labelName,
      metadata: params.labelColor ? { color: params.labelColor } : undefined,
    });
  }

  async logLabelRemoved(params: {
    taskId: string;
    labelId: string;
    userId: string;
    labelName: string;
    workspaceId?: string;
    projectId?: string;
    boardId?: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      taskId: params.taskId,
      userId: params.userId,
      action: 'REMOVED',
      entityType: 'LABEL',
      entityId: params.labelId,
      entityName: params.labelName,
    });
  }

  // ============================================================================
  // CHECKLIST ACTIONS
  // ============================================================================

  async logChecklistCreated(params: {
    taskId: string;
    checklistItemId: string;
    userId: string;
    content: string;
  }) {
    return this.log({
      taskId: params.taskId,
      checklistItemId: params.checklistItemId,
      userId: params.userId,
      action: 'CREATED',
      entityType: 'TASK_CHECKLIST_ITEM',
      entityId: params.checklistItemId,
      entityName: params.content,
    });
  }

  async logChecklistChecked(params: {
    taskId: string;
    checklistItemId: string;
    userId: string;
    content: string;
  }) {
    return this.log({
      taskId: params.taskId,
      checklistItemId: params.checklistItemId,
      userId: params.userId,
      action: 'CHECKED',
      entityType: 'TASK_CHECKLIST_ITEM',
      entityId: params.checklistItemId,
      entityName: params.content,
    });
  }

  async logChecklistUnchecked(params: {
    taskId: string;
    checklistItemId: string;
    userId: string;
    content: string;
  }) {
    return this.log({
      taskId: params.taskId,
      checklistItemId: params.checklistItemId,
      userId: params.userId,
      action: 'UNCHECKED',
      entityType: 'TASK_CHECKLIST_ITEM',
      entityId: params.checklistItemId,
      entityName: params.content,
    });
  }

  async logChecklistUpdated(params: {
    taskId: string;
    checklistItemId: string;
    userId: string;
    oldContent: string;
    newContent: string;
  }) {
    return this.log({
      taskId: params.taskId,
      checklistItemId: params.checklistItemId,
      userId: params.userId,
      action: 'UPDATED',
      entityType: 'TASK_CHECKLIST_ITEM',
      entityId: params.checklistItemId,
      entityName: params.newContent,
      oldValue: { content: params.oldContent },
      newValue: { content: params.newContent },
    });
  }

  async logChecklistDeleted(params: {
    taskId: string;
    checklistItemId: string;
    userId: string;
    content: string;
  }) {
    return this.log({
      taskId: params.taskId,
      checklistItemId: params.checklistItemId,
      userId: params.userId,
      action: 'DELETED',
      entityType: 'TASK_CHECKLIST_ITEM',
      entityId: params.checklistItemId,
      entityName: params.content,
    });
  }

  // ============================================================================
  // PROJECT & BOARD ACTIONS
  // ============================================================================

  async logProjectCreated(params: {
    workspaceId: string;
    projectId: string;
    userId: string;
    projectName: string;
    projectType: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      userId: params.userId,
      action: 'CREATED',
      entityType: 'PROJECT',
      entityId: params.projectId,
      entityName: params.projectName,
      metadata: { type: params.projectType },
    });
  }

  async logProjectUpdated(params: {
    projectId: string;
    userId: string;
    projectName?: string;
    oldValue: any;
    newValue: any;
  }) {
    return this.log({
      projectId: params.projectId,
      userId: params.userId,
      action: 'UPDATED',
      entityType: 'PROJECT',
      entityId: params.projectId,
      entityName: params.projectName,
      oldValue: params.oldValue,
      newValue: params.newValue,
    });
  }

  async logBoardCreated(params: {
    workspaceId: string;
    projectId: string;
    boardId: string;
    userId: string;
    boardName: string;
  }) {
    return this.log({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      boardId: params.boardId,
      userId: params.userId,
      action: 'CREATED',
      entityType: 'BOARD',
      entityId: params.boardId,
      entityName: params.boardName,
    });
  }

  // ============================================================================
  // MEMBERSHIP ACTIONS
  // ============================================================================

  async logMemberAdded(params: {
    projectId: string;
    userId: string;
    memberId: string;
    memberName: string;
    role: string;
    metadata?: any;
  }) {
    return this.log({
      projectId: params.projectId,
      userId: params.userId,
      action: 'ADDED',
      entityType: 'MEMBERSHIP',
      entityId: params.memberId,
      entityName: params.memberName,
      metadata: { role: params.role, ...params.metadata },
    });
  }

  async logMemberRoleUpdated(params: {
    projectId: string;
    userId: string;
    memberId: string;
    memberName: string;
    oldRole: string;
    newRole: string;
  }) {
    return this.log({
      projectId: params.projectId,
      userId: params.userId,
      action: 'UPDATED',
      entityType: 'MEMBERSHIP',
      entityId: params.memberId,
      entityName: params.memberName,
      oldValue: { role: params.oldRole },
      newValue: { role: params.newRole },
    });
  }

  async logMemberRemoved(params: {
    projectId: string;
    userId: string;
    memberId: string;
    memberName: string;
    role: string;
  }) {
    return this.log({
      projectId: params.projectId,
      userId: params.userId,
      action: 'REMOVED',
      entityType: 'MEMBERSHIP',
      entityId: params.memberId,
      entityName: params.memberName,
      metadata: { role: params.role },
    });
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get activity feed for a specific task
   */
  async getTaskActivityFeed(taskId: string, limit = 50) {
    return this.prisma.activity_logs.findMany({
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
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Get activity feed for a specific project
   */
  async getProjectActivityFeed(projectId: string, limit = 100) {
    return this.prisma.activity_logs.findMany({
      where: { project_id: projectId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Get activity feed for a specific workspace
   */
  async getWorkspaceActivityFeed(workspaceId: string, limit = 100) {
    return this.prisma.activity_logs.findMany({
      where: { workspace_id: workspaceId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Get activity feed for a specific user
   * @param userIdentifier - Can be either Firebase UID or database UUID
   */
  async getUserActivityFeed(userIdentifier: string, limit = 50) {
    // First, try to find the user by firebase_uid
    const user = await this.prisma.users.findUnique({
      where: { firebase_uid: userIdentifier },
      select: { id: true },
    });

    // If not found by firebase_uid, assume it's a database UUID
    const userId = user ? user.id : userIdentifier;

    return this.prisma.activity_logs.findMany({
      where: { user_id: userId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Get activity logs with pagination
   */
  async getActivityFeedWithPagination(params: {
    workspaceId?: string;
    projectId?: string;
    taskId?: string;
    userId?: string;
    limit?: number;
    cursor?: string; // activity_log id
  }) {
    const limit = params.limit ?? 50;

    const where: Prisma.activity_logsWhereInput = {};
    if (params.workspaceId) where.workspace_id = params.workspaceId;
    if (params.projectId) where.project_id = params.projectId;
    if (params.taskId) where.task_id = params.taskId;
    if (params.userId) where.user_id = params.userId;

    if (params.cursor) {
      const cursorLog = await this.prisma.activity_logs.findUnique({
        where: { id: params.cursor },
      });
      if (cursorLog) {
        where.created_at = { lt: cursorLog.created_at };
      }
    }

    const logs = await this.prisma.activity_logs.findMany({
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
      orderBy: { created_at: 'desc' },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, -1) : logs;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }
}
