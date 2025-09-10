import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { projects } from '@prisma/client'; // type do Prisma generate

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  listByWorkSpace(workspaceId: string): Promise<projects[]> {
    return this.prisma.projects.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
    });
  }

  create(dto: {
    name: string;
    workspace_id: string;
    key?: string;
    description?: string;
  }): Promise<projects> {
    return this.prisma.projects.create({
      data: {
        name: dto.name,
        workspace_id: dto.workspace_id,
        key: dto.key ?? null,
        description: dto.description ?? null,
      },
    });
  }

  update(
    id: string,
    dto: { name?: string; key?: string; description?: string },
  ): Promise<projects> {
    return this.prisma.projects.update({
      where: { id },
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
      },
    });
  }
}
