import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  listByWorkSpace(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
    });
  }

  create(dto: { name: string; workspace_id: string }) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        workspace_id: dto.workspace_id,
        key: dto.key ?? null,
        description: dto.description ?? null,
      },
    });
  }
}
