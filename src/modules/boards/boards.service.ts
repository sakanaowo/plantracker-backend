import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { boards } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class BoardsService {
  constructor(
    private prisma: PrismaService,
    private activityLogsService: ActivityLogsService,
  ) {}

  listByProject(projectId: string): Promise<boards[]> {
    return this.prisma.boards.findMany({
      where: { project_id: projectId },
      orderBy: { order: 'asc' },
    });
  }

  async create(
    dto: {
      projectId: string;
      name: string;
      order?: number;
    },
    createdBy?: string,
  ): Promise<boards> {
    const max = await this.prisma.boards.findFirst({
      where: { project_id: dto.projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = dto.order ?? (max?.order ?? 0) + 1;

    const board = await this.prisma.boards.create({
      data: {
        project_id: dto.projectId,
        name: dto.name,
        order: nextOrder,
      },
    });

    // Log board creation
    if (createdBy) {
      // Get project workspace_id for logging
      const project = await this.prisma.projects.findUnique({
        where: { id: dto.projectId },
        select: { workspace_id: true },
      });

      if (project?.workspace_id) {
        await this.activityLogsService.logBoardCreated({
          workspaceId: project.workspace_id,
          projectId: dto.projectId,
          boardId: board.id,
          userId: createdBy,
          boardName: board.name,
        });
      }
    }

    return board;
  }

  async update(
    id: string,
    dto: { name?: string; order?: number },
    userId?: string,
  ): Promise<boards> {
    // Get old board state for logging
    const oldBoard = await this.prisma.boards.findUnique({
      where: { id },
      include: {
        projects: {
          select: { workspace_id: true },
        },
      },
    });

    const updatedBoard = await this.prisma.boards.update({
      where: { id },
      data: {
        name: dto.name,
        order: dto.order,
      },
    });

    // Log board update
    if (userId && oldBoard?.projects?.workspace_id) {
      const oldValue: any = {};
      const newValue: any = {};

      if (dto.name !== undefined && dto.name !== oldBoard.name) {
        oldValue.name = oldBoard.name;
        newValue.name = dto.name;
      }
      if (dto.order !== undefined && dto.order !== oldBoard.order) {
        oldValue.order = oldBoard.order;
        newValue.order = dto.order;
      }

      if (Object.keys(oldValue).length > 0) {
        await this.activityLogsService.logBoardUpdated({
          workspaceId: oldBoard.projects.workspace_id,
          projectId: oldBoard.project_id,
          boardId: updatedBoard.id,
          userId,
          boardName: updatedBoard.name,
          oldValue,
          newValue,
        });
      }
    }

    return updatedBoard;
  }

  async remove(id: string, userId?: string): Promise<boards> {
    // Get board details before deletion for logging
    const board = await this.prisma.boards.findUnique({
      where: { id },
      include: {
        projects: {
          select: { workspace_id: true },
        },
      },
    });

    if (!board) {
      throw new Error(`Board with ID ${id} not found`);
    }

    const deletedBoard = await this.prisma.boards.delete({
      where: { id },
    });

    // Log board deletion
    if (userId && board.projects?.workspace_id) {
      await this.activityLogsService.logBoardDeleted({
        workspaceId: board.projects.workspace_id,
        projectId: board.project_id,
        boardId: board.id,
        userId,
        boardName: board.name,
      });
    }

    return deletedBoard;
  }
}
