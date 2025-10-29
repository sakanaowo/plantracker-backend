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

  update(id: string, dto: { name?: string; order?: number }): Promise<boards> {
    return this.prisma.boards.update({
      where: { id },
      data: {
        name: dto.name,
        order: dto.order,
      },
    });
  }

  remove(id: string): Promise<boards> {
    return this.prisma.boards.delete({
      where: { id },
    });
  }
}
