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
import { role as Role, workspace_type as WorkspaceType } from '@prisma/client';
import { ProjectsService } from '../projects/projects.service';
import { BoardsService } from '../boards/boards.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly boardsService: BoardsService,
  ) {}

  async ensurePersonalWorkspaceByUserId(userId: string, name?: string) {
    // First, handle workspace creation/retrieval in transaction
    const workspace = await this.prisma.$transaction(async (tx) => {
      // 1) Tìm personal workspace hiện có
      const existing = await tx.workspaces.findFirst({
        where: { owner_id: userId, type: 'PERSONAL' },
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

      // 2) Tạo workspace mới
      const ws = await tx.workspaces.create({
        data: {
          name: name?.trim() || 'Default Workspace',
          owner_id: userId,
          type: 'PERSONAL',
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
    });

    // 4) Tạo default project nếu workspace chưa có project nào
    if (workspace.projects.length === 0) {
      await this.createDefaultProjectForWorkspace(workspace.id);
    }

    return workspace;
  }

  private async createDefaultProjectForWorkspace(workspaceId: string) {
    // Create default project
    const project = await this.projectsService.create({
      name: 'My First Project',
      workspace_id: workspaceId,
      key: 'MFP',
      description:
        'Welcome to your first project! Start organizing your tasks here.',
    });

    // Create default Kanban boards
    const defaultBoards = [
      { name: 'To Do', order: 1 },
      { name: 'In Progress', order: 2 },
      { name: 'Done', order: 3 },
    ];

    for (const board of defaultBoards) {
      await this.boardsService.create({
        projectId: project.id,
        name: board.name,
        order: board.order,
      });
    }

    return project;
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
  // create team workspace || create personal workspace
  async createWorkspace(ownerId: string, dto: CreateWorkspaceDto) {
    const type: WorkspaceType = dto.type ?? 'TEAM';
    return this.prisma.$transaction(async (tx) => {
      const ws = await tx.workspaces.create({
        data: {
          name: dto.name,
          owner_id: ownerId,
          type,
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
    const [asMember, asOwner] = await Promise.all([
      this.prisma.workspaces.findMany({
        where: { memberships: { some: { user_id: userId } } },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.workspaces.findMany({
        where: { owner_id: userId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const map = new Map<string, (typeof asMember)[0]>();
    [...asMember, ...asOwner].forEach((w) => map.set(w.id, w));
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
        labels: true,
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
        type: dto.type,
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
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.code === 'P2002')
        throw new ConflictException(
          'User is already a member of the workspace',
        );
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
