import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { projects } from '@prisma/client'; // type do Prisma generate
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private activityLogsService: ActivityLogsService,
  ) {}

  listByWorkSpace(workspaceId: string, userId: string): Promise<projects[]> {
    // Only return projects from workspaces where user is owner or member
    return this.prisma.projects.findMany({
      where: {
        workspace_id: workspaceId,
        workspaces: {
          OR: [
            { owner_id: userId },
            {
              memberships: {
                some: {
                  user_id: userId,
                },
              },
            },
          ],
        },
      },
      orderBy: { created_at: 'desc' },
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
    let projectKey: string;

    if (dto.key) {
      const existing = await this.prisma.projects.findFirst({
        where: {
          workspace_id: dto.workspaceId,
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
      projectKey = await this.ensureUniqueKey(dto.workspaceId, baseKey);
    }

    const project = await this.prisma.$transaction(async (tx) => {
      const newProject = await tx.projects.create({
        data: {
          name: dto.name,
          workspace_id: dto.workspaceId,
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
        workspaceId: dto.workspaceId,
        projectId: project.id,
        userId: createdBy,
        projectName: project.name,
        projectType: project.type,
      });
    }

    return project;
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
}
