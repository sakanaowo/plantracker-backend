import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { MAX_LABELS_PER_TASK, isValidLabelColor } from '../../common/constants';

@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  /**
   * Create a new label in workspace
   */
  async create(workspaceId: string, userId: string, dto: CreateLabelDto) {
    // Validate workspace access
    await this.validateWorkspaceAccess(workspaceId, userId);

    // Validate color is in predefined palette
    if (!isValidLabelColor(dto.color)) {
      throw new BadRequestException(
        'Color must be from the predefined palette',
      );
    }

    // Check for duplicate name in workspace
    const existing = await this.prisma.labels.findFirst({
      where: {
        workspace_id: workspaceId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException('Label with this name already exists');
    }

    // Create label
    const label = await this.prisma.labels.create({
      data: {
        workspace_id: workspaceId,
        name: dto.name,
        color: dto.color,
      },
    });

    return label;
  }

  /**
   * List all labels in workspace with task count
   */
  async listByWorkspace(workspaceId: string, userId: string) {
    // Validate workspace access
    await this.validateWorkspaceAccess(workspaceId, userId);

    const labels = await this.prisma.labels.findMany({
      where: { workspace_id: workspaceId },
      include: {
        task_labels: {
          select: { task_id: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Map with task count
    return labels.map((label) => ({
      id: label.id,
      workspaceId: label.workspace_id,
      name: label.name,
      color: label.color,
      taskCount: label.task_labels.length,
      createdAt: label.created_at,
      updatedAt: label.updated_at,
    }));
  }

  /**
   * Update label
   */
  async update(labelId: string, userId: string, dto: UpdateLabelDto) {
    const label = await this.prisma.labels.findUnique({
      where: { id: labelId },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    // Validate workspace access
    await this.validateWorkspaceAccess(label.workspace_id, userId);

    // Validate color if provided
    if (dto.color && !isValidLabelColor(dto.color)) {
      throw new BadRequestException(
        'Color must be from the predefined palette',
      );
    }

    // Check duplicate name if updating name
    if (dto.name && dto.name !== label.name) {
      const existing = await this.prisma.labels.findFirst({
        where: {
          workspace_id: label.workspace_id,
          name: dto.name,
          id: { not: labelId },
        },
      });

      if (existing) {
        throw new ConflictException('Label with this name already exists');
      }
    }

    // Update label
    const updated = await this.prisma.labels.update({
      where: { id: labelId },
      data: {
        name: dto.name ?? label.name,
        color: dto.color ?? label.color,
        updated_at: new Date(),
      },
    });

    return updated;
  }

  /**
   * Delete label (will cascade to task_labels)
   */
  async delete(labelId: string, userId: string) {
    const label = await this.prisma.labels.findUnique({
      where: { id: labelId },
      include: {
        task_labels: true,
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    // Validate workspace access
    await this.validateWorkspaceAccess(label.workspace_id, userId);

    // Delete label (cascade will remove task_labels)
    await this.prisma.labels.delete({
      where: { id: labelId },
    });

    return {
      success: true,
      removedFromTasks: label.task_labels.length,
    };
  }

  /**
   * Assign label to task
   */
  async assignToTask(taskId: string, labelId: string, userId: string) {
    // Get task and label in parallel
    const [task, label] = await Promise.all([
      this.prisma.tasks.findUnique({
        where: { id: taskId },
        include: {
          projects: {
            select: { workspace_id: true, name: true },
          },
          task_labels: true,
        },
      }),
      this.prisma.labels.findUnique({
        where: { id: labelId },
      }),
    ]);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    // Validate label belongs to task's workspace
    if (task.projects.workspace_id !== label.workspace_id) {
      throw new BadRequestException('Label not in same workspace as task');
    }

    // Validate workspace access
    await this.validateWorkspaceAccess(task.projects.workspace_id, userId);

    // Check max labels limit
    if (task.task_labels.length >= MAX_LABELS_PER_TASK) {
      throw new BadRequestException(
        `Task cannot have more than ${MAX_LABELS_PER_TASK} labels`,
      );
    }

    // Check if already assigned
    const existing = await this.prisma.task_labels.findUnique({
      where: {
        task_id_label_id: {
          task_id: taskId,
          label_id: labelId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Label already assigned to this task');
    }

    // Assign label
    await this.prisma.task_labels.create({
      data: {
        task_id: taskId,
        label_id: labelId,
      },
    });

    // Log activity
    await this.activityLogsService.logLabelAdded({
      taskId,
      labelId,
      userId,
      labelName: label.name,
      labelColor: label.color,
    });

    return { success: true, label };
  }

  /**
   * Remove label from task
   */
  async removeFromTask(taskId: string, labelId: string, userId: string) {
    const taskLabel = await this.prisma.task_labels.findUnique({
      where: {
        task_id_label_id: {
          task_id: taskId,
          label_id: labelId,
        },
      },
      include: {
        labels: true,
        tasks: {
          include: {
            projects: {
              select: { workspace_id: true },
            },
          },
        },
      },
    });

    if (!taskLabel) {
      throw new NotFoundException('Label not assigned to this task');
    }

    // Validate workspace access
    await this.validateWorkspaceAccess(
      taskLabel.tasks.projects.workspace_id,
      userId,
    );

    // Remove label
    await this.prisma.task_labels.delete({
      where: {
        task_id_label_id: {
          task_id: taskId,
          label_id: labelId,
        },
      },
    });

    // Log activity
    await this.activityLogsService.logLabelRemoved({
      taskId,
      labelId,
      userId,
      labelName: taskLabel.labels.name,
    });

    return { success: true };
  }

  /**
   * Get labels assigned to task
   */
  async getTaskLabels(taskId: string, userId: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
        projects: {
          select: { workspace_id: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Validate workspace access
    await this.validateWorkspaceAccess(task.projects.workspace_id, userId);

    const taskLabels = await this.prisma.task_labels.findMany({
      where: { task_id: taskId },
      include: {
        labels: true,
      },
    });

    return taskLabels.map((tl) => tl.labels);
  }

  /**
   * Helper: Validate user has access to workspace
   */
  private async validateWorkspaceAccess(workspaceId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: workspaceId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    return membership;
  }
}
