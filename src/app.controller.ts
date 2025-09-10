import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get('health/db')
  async health() {
    const now = await this.prisma.$queryRawUnsafe(`select now() as now`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    return { ok: true, now: now?.[0]?.now ?? null };
  }
}
