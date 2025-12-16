import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface TaskContext {
  workspaceId?: string;
  projectId: string;
  boardId: string;
}

export interface ProjectContext {
  workspaceId: string;
  projectId: string;
}

@Injectable()
export class ContextService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get workspace/project/board IDs from task
   * Used for activity logging
   */
  async getTaskContext(taskId: string): Promise<TaskContext | null> {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      select: {
        project_id: true,
        board_id: true,
        projects: {
          select: {
            workspace_id: true,
          },
        },
      },
    });

    if (!task) {
      return null;
    }

    return {
      workspaceId: task.projects?.workspace_id,
      projectId: task.project_id,
      boardId: task.board_id,
    };
  }

  /**
   * Get workspace ID from project
   */
  async getProjectContext(projectId: string): Promise<ProjectContext | null> {
    const project = await this.prisma.projects.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        workspace_id: true,
      },
    });

    if (!project) {
      return null;
    }

    return {
      workspaceId: project.workspace_id,
      projectId: project.id,
    };
  }

  /**
   * Get user name by ID (for notifications)
   */
  async getUserName(userId: string): Promise<string | null> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    return user?.name ?? null;
  }

  /**
   * Get project name by ID (for notifications)
   */
  async getProjectName(projectId: string): Promise<string | null> {
    const project = await this.prisma.projects.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    return project?.name ?? null;
  }
}
