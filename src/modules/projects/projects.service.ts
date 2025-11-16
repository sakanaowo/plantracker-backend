import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { projects, Prisma } from '@prisma/client'; // type do Prisma generate
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private activityLogsService: ActivityLogsService,
  ) {}

  /**
   * Get all projects accessible by a user (across all workspaces)
   */
  async listAllUserProjects(userId: string) {
    console.log(`📋 listAllUserProjects called - user: ${userId}`);

    const projects = await this.prisma.projects.findMany({
      where: {
        OR: [
          // User owns the workspace containing the project
          {
            workspaces: {
              owner_id: userId,
            },
          },
          // User is a project member
          {
            project_members: {
              some: {
                user_id: userId,
              },
            },
          },
        ],
      },
      include: {
        project_members: {
          where: { user_id: userId },
          select: { role: true },
        },
        workspaces: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    console.log(`✅ Found ${projects.length} projects for user ${userId}`);
    projects.forEach((p: any) => {
      const userRole = p.project_members[0]?.role || 'WORKSPACE_ACCESS';
      console.log(
        `  - ${p.name} (workspace: ${p.workspaces?.name}, role: ${userRole})`,
      );
    });

    return projects as any;
  }

  /**
   * Get a single project by ID (with permission check)
   */
  async getProjectById(projectId: string, userId: string) {
    console.log(
      `📋 getProjectById called - project: ${projectId}, user: ${userId}`,
    );

    const project = await this.prisma.projects.findFirst({
      where: {
        id: projectId,
        OR: [
          // User is workspace owner
          {
            workspaces: {
              owner_id: userId,
            },
          },
          // User is project member
          {
            project_members: {
              some: {
                user_id: userId,
              },
            },
          },
        ],
      },
      include: {
        project_members: {
          where: { user_id: userId },
          select: { role: true },
        },
        workspaces: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      throw new ConflictException(
        'Project not found or you do not have access to this project',
      );
    }

    console.log(`✅ Found project: ${project.name}`);
    return project;
  }

  listByWorkSpace(workspaceId: string, userId: string): Promise<projects[]> {
    console.log(
      `📋 listByWorkSpace called - workspace: ${workspaceId}, user: ${userId}`,
    );

    // Return projects where:
    // 1. In the specified workspace
    // 2. User is workspace owner (can see ALL projects) OR
    // 3. User is explicit project member (can see ONLY those projects)
    //
    // NOTE: Being a workspace member does NOT automatically grant access to projects
    // User must be explicitly added as project member
    return this.prisma.projects
      .findMany({
        where: {
          workspace_id: workspaceId,
          OR: [
            // User is workspace owner - can see ALL projects in workspace
            {
              workspaces: {
                owner_id: userId,
              },
            },
            // User is explicit project member - can see THIS specific project only
            {
              project_members: {
                some: {
                  user_id: userId,
                },
              },
            },
          ],
        },
        include: {
          project_members: {
            where: { user_id: userId },
            select: { role: true },
          },
        },
        orderBy: { created_at: 'desc' },
      })
      .then((projects) => {
        console.log(
          `✅ Found ${projects.length} projects for user ${userId} in workspace ${workspaceId}:`,
        );
        projects.forEach((p) => {
          const userRole = p.project_members[0]?.role || 'WORKSPACE_ACCESS';
          console.log(
            `  - ${p.name} (type: ${p.type}, user role: ${userRole})`,
          );
        });
        return projects;
      });
  }

  private generateKeyFromName(name: string): string {
    const words = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length === 0) {
      return 'PROJ';
    }

    let key = words.map((w) => w[0]).join('');

    if (key.length < 2 && words[0]) {
      key = words[0].substring(0, 5);
    }

    return key.substring(0, 10);
  }

  private async ensureUniqueKey(
    workspaceId: string,
    baseKey: string,
  ): Promise<string> {
    let key = baseKey;
    let counter = 2;

    while (true) {
      const existing = await this.prisma.projects.findFirst({
        where: {
          workspace_id: workspaceId,
          key: key,
        },
      });

      if (!existing) {
        return key;
      }

      const suffix = counter.toString();
      const maxBaseLength = 10 - suffix.length;
      key = baseKey.substring(0, maxBaseLength) + suffix;
      counter++;
    }
  }

  async create(dto: CreateProjectDto, createdBy?: string): Promise<projects> {
    // ✅ Auto-find user's default workspace if workspaceId not provided
    let workspaceId = dto.workspaceId;

    if (!workspaceId && createdBy) {
      // Find first workspace where user is owner
      const ownedWorkspace = await this.prisma.workspaces.findFirst({
        where: {
          owner_id: createdBy,
        },
        orderBy: {
          created_at: 'asc', // Get the oldest (likely personal) workspace
        },
      });

      if (!ownedWorkspace) {
        throw new NotFoundException(
          'No workspace found for user. Please create a workspace first.',
        );
      }

      workspaceId = ownedWorkspace.id;
    }

    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }

    // ✅ SECURITY: Check workspace ownership/membership before allowing project creation
    if (createdBy) {
      const workspace = await this.prisma.workspaces.findFirst({
        where: {
          id: workspaceId,
          OR: [
            { owner_id: createdBy }, // User is workspace owner
            {
              memberships: {
                some: {
                  user_id: createdBy,
                  role: { in: ['OWNER', 'ADMIN'] }, // Or workspace admin
                },
              },
            },
          ],
        },
      });

      if (!workspace) {
        throw new ForbiddenException(
          'You do not have permission to create projects in this workspace',
        );
      }
    }

    let projectKey: string;

    if (dto.key) {
      const existing = await this.prisma.projects.findFirst({
        where: {
          workspace_id: workspaceId,
          key: dto.key,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Project key "${dto.key}" already exists in this workspace`,
        );
      }

      projectKey = dto.key;
    } else {
      const baseKey = this.generateKeyFromName(dto.name);
      projectKey = await this.ensureUniqueKey(workspaceId, baseKey);
    }

    const project = await this.prisma.$transaction(async (tx) => {
      const newProject = await tx.projects.create({
        data: {
          name: dto.name,
          workspace_id: workspaceId,
          key: projectKey,
          description: dto.description ?? null,
          type: dto.type ?? 'PERSONAL', // Default to PERSONAL if not specified
        },
      });

      const defaultBoards = [
        { name: 'To Do', order: 0 },
        { name: 'In Progress', order: 1 },
        { name: 'Done', order: 2 },
      ];

      await tx.boards.createMany({
        data: defaultBoards.map((board) => ({
          project_id: newProject.id,
          name: board.name,
          order: board.order,
        })),
      });

      return newProject;
    });

    // Log project creation
    if (createdBy) {
      await this.activityLogsService.logProjectCreated({
        workspaceId: workspaceId,
        projectId: project.id,
        userId: createdBy,
        projectName: project.name,
        projectType: project.type,
      });
    }

    return project;
  }

  async getMembers(projectId: string) {
    return this.prisma.project_members.findMany({
      where: { project_id: projectId },
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
      orderBy: { created_at: 'asc' },
    });
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    updatedBy?: string,
  ): Promise<projects> {
    // Get current project for logging
    const currentProject = await this.prisma.projects.findUnique({
      where: { id },
      select: {
        workspace_id: true,
        name: true,
        key: true,
        description: true,
        type: true,
      },
    });

    if (!currentProject) {
      throw new ConflictException('Project not found');
    }

    if (dto.key) {
      const existing = await this.prisma.projects.findFirst({
        where: {
          workspace_id: currentProject.workspace_id,
          key: dto.key,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Project key "${dto.key}" already exists in this workspace`,
        );
      }
    }

    const updatedProject = await this.prisma.projects.update({
      where: { id },
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        type: dto.type, // Allow changing project type
      },
    });

    // Log project update
    if (updatedBy) {
      const changes: Record<
        string,
        { old: string | null; new: string | null }
      > = {};

      if (dto.name !== undefined && dto.name !== currentProject.name) {
        changes.name = { old: currentProject.name, new: dto.name };
      }
      if (dto.key !== undefined && dto.key !== currentProject.key) {
        changes.key = { old: currentProject.key, new: dto.key };
      }
      if (
        dto.description !== undefined &&
        dto.description !== currentProject.description
      ) {
        changes.description = {
          old: currentProject.description,
          new: dto.description,
        };
      }
      if (dto.type !== undefined && dto.type !== currentProject.type) {
        changes.type = { old: currentProject.type, new: dto.type };
      }

      if (Object.keys(changes).length > 0) {
        await this.activityLogsService.logProjectUpdated({
          projectId: id,
          userId: updatedBy,
          projectName: updatedProject.name,
          oldValue: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v.old]),
          ),
          newValue: Object.fromEntries(
            Object.entries(changes).map(([k, v]) => [k, v.new]),
          ),
        });
      }
    }

    return updatedProject;
  }

  /**
   * Get project summary statistics (for Summary tab)
   * Returns simple stats matching the UI screenshot:
   * - Tasks done in last 7 days
   * - Tasks updated in last 7 days
   * - Tasks created in last 7 days
   * - Tasks due in next 7 days
   * - Status overview (last 14 days)
   */
  async getProjectSummary(projectId: string, userId: string) {
    // Validate user has access to this project
    const project = await this.prisma.projects.findFirst({
      where: {
        id: projectId,
        OR: [
          // User is workspace owner
          {
            workspaces: {
              owner_id: userId,
            },
          },
          // User is project member
          {
            project_members: {
              some: {
                user_id: userId,
              },
            },
          },
        ],
      },
    });

    if (!project) {
      throw new ConflictException(
        'Project not found or you do not have access to this project',
      );
    }

    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get all tasks for status overview
    const allTasks = await this.prisma.tasks.findMany({
      where: {
        project_id: projectId,
        created_at: { gte: last14Days },
      },
      select: {
        id: true,
        status: true,
      },
    });

    // Count by status
    const statusCounts = {
      TO_DO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };

    allTasks.forEach((task) => {
      if (task.status === 'TO_DO') statusCounts.TO_DO++;
      else if (task.status === 'IN_PROGRESS') statusCounts.IN_PROGRESS++;
      else if (task.status === 'IN_REVIEW') statusCounts.IN_REVIEW++;
      else if (task.status === 'DONE') statusCounts.DONE++;
    });

    // Tasks done in last 7 days
    const doneLast7Days = await this.prisma.tasks.count({
      where: {
        project_id: projectId,
        status: 'DONE',
        updated_at: { gte: last7Days },
      },
    });

    // Tasks updated in last 7 days (any status change)
    const updatedLast7Days = await this.prisma.tasks.count({
      where: {
        project_id: projectId,
        updated_at: { gte: last7Days },
      },
    });

    // Tasks created in last 7 days
    const createdLast7Days = await this.prisma.tasks.count({
      where: {
        project_id: projectId,
        created_at: { gte: last7Days },
      },
    });

    // Tasks due in next 7 days
    const dueNext7Days = await this.prisma.tasks.count({
      where: {
        project_id: projectId,
        due_at: {
          gte: now,
          lte: next7Days,
        },
      },
    });

    return {
      done: doneLast7Days,
      updated: updatedLast7Days,
      created: createdLast7Days,
      due: dueNext7Days,
      statusOverview: {
        period: 'last 14 days',
        total: allTasks.length,
        toDo: statusCounts.TO_DO,
        inProgress: statusCounts.IN_PROGRESS,
        inReview: statusCounts.IN_REVIEW,
        done: statusCounts.DONE,
      },
    };
  }
}
