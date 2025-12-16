import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { project_role } from '@prisma/client';
import { ERROR_MESSAGES } from '../constants';

export interface TaskAccessOptions {
  includeAssignees?: boolean;
  includeComments?: boolean;
  includeAttachments?: boolean;
}

export interface ProjectAccessOptions {
  checkTeamMembership?: boolean; // For TEAM projects
}

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate user has access to task
   * Returns task with selected includes
   *
   * Replaces:
   * - attachments.service.ts → validateTaskAccess()
   * - comments.service.ts → validateTaskAccess()
   */
  async validateTaskAccess(
    taskId: string,
    userId: string,
    options: TaskAccessOptions = {},
  ) {
    const task = await this.prisma.tasks.findUnique({
      where: { id: taskId },
      include: {
        task_assignees: options.includeAssignees
          ? {
              include: {
                users: {
                  select: { id: true, name: true, email: true },
                },
              },
            }
          : undefined,
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
      throw new NotFoundException(ERROR_MESSAGES.TASK_NOT_FOUND);
    }

    if (task.projects.workspaces.memberships.length === 0) {
      throw new ForbiddenException(ERROR_MESSAGES.TASK_ACCESS_DENIED);
    }

    return task;
  }

  /**
   * Validate user has access to project
   *
   * Replaces:
   * - labels.service.ts → validateProjectAccess()
   * - project-members.service.ts → validateProjectAccess()
   */
  async validateProjectAccess(
    projectId: string,
    userId: string,
    options: ProjectAccessOptions = {},
  ) {
    const project = await this.prisma.projects.findUnique({
      where: { id: projectId },
      include: {
        workspaces: true,
        project_members: {
          where: { user_id: userId },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(ERROR_MESSAGES.PROJECT_NOT_FOUND);
    }

    // Check if user is project member OR workspace owner
    const isProjectMember = project.project_members.length > 0;
    const isWorkspaceOwner = project.workspaces.owner_id === userId;

    if (!isProjectMember && !isWorkspaceOwner) {
      throw new ForbiddenException(ERROR_MESSAGES.PROJECT_ACCESS_DENIED);
    }

    // For TEAM projects, ensure user is explicit member
    if (options.checkTeamMembership && project.type === 'TEAM') {
      if (!isProjectMember) {
        throw new ForbiddenException(ERROR_MESSAGES.PROJECT_ACCESS_DENIED);
      }
    }

    return project;
  }

  /**
   * Validate user has workspace membership
   *
   * Replaces:
   * - workspaces.service.ts → ensureMemberOfWorkspace()
   * - labels.service.ts → validateWorkspaceAccess()
   */
  async validateWorkspaceAccess(workspaceId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: workspaceId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_NOT_MEMBER);
    }

    return membership;
  }

  /**
   * Check if user has required role in project
   *
   * Replaces:
   * - project-members.service.ts → checkProjectRole()
   */
  async checkProjectRole(
    projectId: string,
    userId: string,
    requiredRoles: project_role[],
  ) {
    let member = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userId,
        },
      },
    });

    // AUTO-FIX: Check if user is workspace owner (missing project_member record)
    if (!member) {
      const project = await this.prisma.projects.findUnique({
        where: { id: projectId },
        include: {
          workspaces: {
            select: { owner_id: true },
          },
        },
      });

      if (project?.workspaces?.owner_id === userId) {
        console.log(
          '🔧 AUTO-FIX: Workspace owner missing project_member record',
        );
        member = await this.prisma.project_members.create({
          data: {
            project_id: projectId,
            user_id: userId,
            role: 'OWNER',
            added_by: userId,
          },
        });
      } else {
        throw new ForbiddenException(ERROR_MESSAGES.PROJECT_NOT_MEMBER);
      }
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(
        `${ERROR_MESSAGES.INSUFFICIENT_PERMISSION}: ${requiredRoles.join(', ')}`,
      );
    }

    return member;
  }

  /**
   * Check if user can modify task
   * Logic: creator, assignee, or project OWNER/ADMIN
   *
   * Replaces:
   * - tasks.service.ts → checkTaskPermission()
   */
  async checkTaskPermission(
    projectId: string,
    userId: string,
    taskCreatorId: string | null,
    taskAssigneeIds: string[],
  ) {
    // If user is the task creator, allow
    if (taskCreatorId === userId) {
      return true;
    }

    // If user is assigned to the task, allow
    if (taskAssigneeIds.includes(userId)) {
      return true;
    }

    // Check user's project role
    const member = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException(ERROR_MESSAGES.PROJECT_NOT_MEMBER);
    }

    // OWNER and ADMIN can modify any task
    if (member.role === 'OWNER' || member.role === 'ADMIN') {
      return true;
    }

    throw new ForbiddenException(ERROR_MESSAGES.ONLY_CREATOR_OR_ASSIGNEE);
  }

  /**
   * Check if user is workspace owner or admin
   *
   * Replaces:
   * - workspaces.service.ts → ensureOwnerOfWorkspace()
   */
  async checkWorkspaceOwnership(workspaceId: string, userId: string) {
    const membership = await this.validateWorkspaceAccess(workspaceId, userId);

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException(ERROR_MESSAGES.WORKSPACE_NOT_OWNER);
    }

    return membership;
  }

  /**
   * Check event permission (creator or project admin/owner)
   */
  async checkEventPermission(
    projectId: string,
    userId: string,
    eventCreatorId: string | null,
  ) {
    // Event creator can modify
    if (eventCreatorId === userId) {
      return true;
    }

    // Check project role
    const member = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException(ERROR_MESSAGES.PROJECT_NOT_MEMBER);
    }

    if (member.role === 'OWNER' || member.role === 'ADMIN') {
      return true;
    }

    throw new ForbiddenException(
      'Only event creator or project admin/owner can modify this event',
    );
  }
}
