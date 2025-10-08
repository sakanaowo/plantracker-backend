import { Injectable } from '@nestjs/common';
import { Prisma, tasks } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  listByBoard(boardId: string): Promise<tasks[]> {
    return this.prisma.tasks.findMany({
      where: { board_id: boardId, deleted_at: null },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
  }

  getById(id: string): Promise<tasks | null> {
    return this.prisma.tasks.findFirst({
      where: { id },
    });
  }

  async create(dto: {
    projectId: string;
    boardId: string;
    title: string;
    assigneeId?: string;
  }): Promise<tasks> {
    const last = await this.prisma.tasks.findFirst({
      where: { board_id: dto.boardId, deleted_at: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPos = last?.position
      ? new Prisma.Decimal(last.position).plus(1024)
      : new Prisma.Decimal(1024);

    return this.prisma.tasks.create({
      data: {
        project_id: dto.projectId,
        board_id: dto.boardId,
        title: dto.title,
        assignee_id: dto.assigneeId ?? null,
        position: nextPos,
      },
    });
  }

  update(
    id: string,
    dto: { title?: string; description?: string; assigneeId?: string },
  ): Promise<tasks> {
    return this.prisma.tasks.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        assignee_id: dto.assigneeId,
      },
    });
  }

  // move + reorder: chuyển board và chèn giữa before/after
  async move(
    id: string,
    toBoardId: string,
    beforeId?: string,
    afterId?: string,
  ): Promise<tasks> {
    let position = new Prisma.Decimal(1024);

    if (beforeId || afterId) {
      const [before, after] = await Promise.all([
        beforeId
          ? this.prisma.tasks.findUnique({
              where: { id: beforeId },
              select: { position: true },
            })
          : null,
        afterId
          ? this.prisma.tasks.findUnique({
              where: { id: afterId },
              select: { position: true },
            })
          : null,
      ]);

      if (before && after) {
        position = new Prisma.Decimal(before.position)
          .plus(after.position)
          .dividedBy(2);
      } else if (before) {
        position = new Prisma.Decimal(before.position).minus(1);
      } else if (after) {
        position = new Prisma.Decimal(after.position).plus(1);
      }
    } else {
      const last = await this.prisma.tasks.findFirst({
        where: { board_id: toBoardId, deleted_at: null },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = last?.position
        ? new Prisma.Decimal(last.position).plus(1024)
        : new Prisma.Decimal(1024);
    }

    return this.prisma.tasks.update({
      where: { id },
      data: { board_id: toBoardId, position },
    });
  }

  // soft delete (nếu DB có cột deleted_at)
  softDelete(id: string): Promise<tasks> {
    return this.prisma.tasks.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
