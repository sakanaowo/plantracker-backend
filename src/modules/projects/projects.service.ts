import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { projects } from '@prisma/client'; // type do Prisma generate
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  listByWorkSpace(workspaceId: string): Promise<projects[]> {
    return this.prisma.projects.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Generate a project key from the project name
   * Takes first letters of each word, uppercase, max 10 chars
   */
  private generateKeyFromName(name: string): string {
    const words = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length === 0) {
      return 'PROJ';
    }

    // Take first letter of each word
    let key = words.map((w) => w[0]).join('');

    // If too short, take first word
    if (key.length < 2 && words[0]) {
      key = words[0].substring(0, 5);
    }

    // Limit to 10 characters
    return key.substring(0, 10);
  }

  /**
   * Ensure the key is unique within the workspace
   * If collision, append number (e.g., PROJ, PROJ2, PROJ3)
   */
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

      // Append counter, ensure total length <= 10
      const suffix = counter.toString();
      const maxBaseLength = 10 - suffix.length;
      key = baseKey.substring(0, maxBaseLength) + suffix;
      counter++;

      // Safety check to prevent infinite loop
      if (counter > 999) {
        throw new ConflictException(
          'Unable to generate unique project key. Please provide a custom key.',
        );
      }
    }
  }

  async create(dto: CreateProjectDto): Promise<projects> {
    // Generate or validate key
    let projectKey: string;

    if (dto.key) {
      // User provided key - check if it's unique
      const existing = await this.prisma.projects.findFirst({
        where: {
          workspace_id: dto.workspaceId, // ✅ Use camelCase from DTO
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
      // Auto-generate key from name
      const baseKey = this.generateKeyFromName(dto.name);
      projectKey = await this.ensureUniqueKey(dto.workspaceId, baseKey); // ✅ Use camelCase
    }

    return this.prisma.projects.create({
      data: {
        name: dto.name,
        workspace_id: dto.workspaceId, // ✅ Transform: camelCase → snake_case for Prisma
        key: projectKey,
        description: dto.description ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto): Promise<projects> {
    // If updating key, ensure it's unique
    if (dto.key) {
      const project = await this.prisma.projects.findUnique({
        where: { id },
        select: { workspace_id: true },
      });

      if (!project) {
        throw new ConflictException('Project not found');
      }

      const existing = await this.prisma.projects.findFirst({
        where: {
          workspace_id: project.workspace_id,
          key: dto.key,
          id: { not: id }, // Exclude current project
        },
      });

      if (existing) {
        throw new ConflictException(
          `Project key "${dto.key}" already exists in this workspace`,
        );
      }
    }

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
