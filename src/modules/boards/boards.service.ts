import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { boards } from '@prisma/client';

@Injectable()
export class BoardsService {
  constructor(private prisma: PrismaService) {}

  listByProject(projectId: string): Promise<boards[]> {
    return this.prisma.boards.findMany({
      where: { project_id: projectId },
      orderBy: { order: 'asc' },
    });
  }

  async create(dto: {
    projectId: string;
    name: string;
    order?: number;
  }): Promise<boards> {
    const max = await this.prisma.boards.findFirst({
      where: { project_id: dto.projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = dto.order ?? (max?.order ?? 0) + 1;
    return this.prisma.boards.create({
      data: {
        project_id: dto.projectId,
        name: dto.name,
        order: nextOrder,
      },
    });
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
