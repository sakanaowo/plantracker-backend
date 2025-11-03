import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { role as Role } from '@prisma/client';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async ensurePersonalWorkspaceByUserId(userId: string, name?: string) {
    const workspace = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.workspaces.findFirst({
          where: { owner_id: userId },
          include: { projects: true },
        });

        if (existing) {
          await tx.memberships.upsert({
            where: {
              user_id_workspace_id: {
                user_id: userId,
                workspace_id: existing.id,
              },
            },
            update: {},
            create: {
              user_id: userId,
              workspace_id: existing.id,
              role: 'OWNER',
            },
          });
          return existing;
        }

        const ws = await tx.workspaces.create({
          data: {
            name: name?.trim() + "'s Workspace",
            owner_id: userId,
          },
        });

        // 3) Tạo membership
        await tx.memberships.create({
          data: {
            user_id: userId,
            workspace_id: ws.id,
            role: 'OWNER',
          },
        });

        return { ...ws, projects: [] }; // Mark as new workspace with no projects
      },
      {
        maxWait: 10000, // Maximum wait time to acquire a connection (10s)
        timeout: 20000, // Maximum time the transaction can run (20s)
      },
    );

    if (workspace.projects.length === 0) {
      try {
        await this.createDefaultProjectForWorkspace(workspace.id);
      } catch (error) {
        // Log error nhưng không throw - workspace vẫn được tạo thành công
        console.error(
          `Failed to create default project for workspace ${workspace.id}:`,
          error,
        );
        // User có thể tự tạo project sau
      }
    }

    return workspace;
  }

  private async createDefaultProjectForWorkspace(workspaceId: string) {
    // Kiểm tra xem đã có project nào chưa (đề phòng race condition)
    const existingProjects = await this.prisma.projects.count({
      where: { workspace_id: workspaceId },
    });

    if (existingProjects > 0) {
      console.log(
        `Workspace ${workspaceId} already has projects, skipping default project creation`,
      );
      return null;
    }

    try {
      // Create default project (boards are automatically created by projectsService.create)
      const project = await this.projectsService.create({
        name: 'Default Project',
        workspaceId: workspaceId,
        key: 'DP',
        description:
          'Welcome to your first project! Start organizing your tasks here.',
      });

      return project;
    } catch (error: unknown) {
      const errorMessage =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
          ? (error as { message: string }).message
          : '';

      if (errorMessage.includes('already exists')) {
        console.log(
          `Key conflict for workspace ${workspaceId}, trying with auto-generated key`,
        );
        // Create project without specifying key (auto-generate)
        // Boards are automatically created by projectsService.create
        const project = await this.projectsService.create({
          name: 'Default Project',
          workspaceId: workspaceId,
          description:
            'Welcome to your first project! Start organizing your tasks here.',
        });

        return project;
      }

      // Throw lại error khác
      throw error;
    }
  }

  private async ensureMemberOfWorkspace(workspaceId: string, userId: string) {
    const member = await this.prisma.memberships.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: workspaceId,
        },
      },
      select: { role: true },
    });
    if (!member) {
      throw new ForbiddenException('User is not a member of the workspace');
    }
    return member.role;
  }

  private async ensureOwnerOfWorkspace(workspaceId: string, userId: string) {
    const role = await this.ensureMemberOfWorkspace(workspaceId, userId);
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('User is not the owner of the workspace');
    }
  }
  // create workspace (no longer needs type parameter)
  async createWorkspace(ownerId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const ws = await tx.workspaces.create({
        data: {
          name: dto.name,
          owner_id: ownerId,
        },
      });

      await tx.memberships.create({
        data: {
          user_id: ownerId,
          workspace_id: ws.id,
          role: 'OWNER',
        },
      });
      return ws;
    });
  }

  async listMine(userId: string) {
    // Get workspaces where user is member or owner
    const [asMember, asOwner, viaProjects] = await Promise.all([
      // Workspaces where user is explicit member
      this.prisma.workspaces.findMany({
        where: { memberships: { some: { user_id: userId } } },
        orderBy: { created_at: 'desc' },
      }),
      // Workspaces where user is owner
      this.prisma.workspaces.findMany({
        where: { owner_id: userId },
        orderBy: { created_at: 'desc' },
      }),
      // Workspaces where user is member of ANY project in that workspace
      this.prisma.workspaces.findMany({
        where: {
          projects: {
            some: {
              project_members: {
                some: { user_id: userId },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // Deduplicate workspaces and add isOwner flag
    // Process in order: asMember, viaProjects, then asOwner (so owner flag takes priority)
    const map = new Map<string, any>();

    // First add all workspaces with their owner flag
    [...asMember, ...viaProjects, ...asOwner].forEach((w) => {
      const isOwner = w.owner_id === userId;

      if (!map.has(w.id)) {
        // First time seeing this workspace
        map.set(w.id, {
          ...w,
          is_owner: isOwner,
        });
      } else if (isOwner) {
        // Already exists but user is owner, update the flag
        const existing = map.get(w.id);
        map.set(w.id, {
          ...existing,
          is_owner: true,
        });
      }
    });

    return Array.from(map.values());
  }

  async getById(workspaceId: string, userId: string) {
    await this.ensureMemberOfWorkspace(workspaceId, userId);
    const ws = await this.prisma.workspaces.findUnique({
      where: { id: workspaceId },
      include: {
        memberships: {
          include: {
            users: {
              select: { id: true, name: true, email: true, avatar_url: true },
            },
          },
        },
        projects: true,
      },
    });
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ) {
    const role = await this.ensureMemberOfWorkspace(workspaceId, userId);
    if (role !== Role.OWNER && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only owners and admins are allowed to update the workspace',
      );
    }
    return this.prisma.workspaces.update({
      where: { id: workspaceId },
      data: {
        name: dto.name,
      },
    });
  }

  async removeWorkspace(workspaceId: string, userId: string) {
    await this.ensureOwnerOfWorkspace(workspaceId, userId);
    return this.prisma.workspaces.delete({
      where: { id: workspaceId },
    });
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.ensureMemberOfWorkspace(workspaceId, userId);
    return this.prisma.memberships.findMany({
      where: { workspace_id: workspaceId },
      include: {
        users: {
          select: { id: true, name: true, email: true, avatar_url: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async addMember(workspaceId: string, userId: string, dto: AddMemberDto) {
    await this.ensureOwnerOfWorkspace(workspaceId, userId);
    try {
      return await this.prisma.memberships.create({
        data: {
          workspace_id: workspaceId,
          user_id: dto.userId,
          role: dto.role,
        },
      });
    } catch (error: unknown) {
      // Check for Prisma unique constraint violation
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'User is already a member of the workspace',
        );
      }
      throw error;
    }
  }

  async removeMember(
    workspaceId: string,
    userId: string,
    targetUserId: string,
  ) {
    await this.ensureOwnerOfWorkspace(workspaceId, userId);
    const actorRole = await this.ensureMemberOfWorkspace(workspaceId, userId);
    if (actorRole === 'ADMIN') {
      const target = await this.prisma.memberships.findUnique({
        where: {
          user_id_workspace_id: {
            user_id: targetUserId,
            workspace_id: workspaceId,
          },
        },
        select: { role: true },
      });
      if (!target) throw new NotFoundException('Member not found');
      if (target.role !== 'MEMBER') {
        throw new ForbiddenException('Admins can only remove members');
      }
    }
    // Prevent self-removal if the only owner (policy-dependent)
    return this.prisma.memberships.delete({
      where: {
        user_id_workspace_id: {
          user_id: targetUserId,
          workspace_id: workspaceId,
        },
      },
    });
  }
}
