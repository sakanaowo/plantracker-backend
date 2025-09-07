import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get('health/db')
  async health() {
    // eslint-disable-next-line prettier/prettier, @typescript-eslint/no-unsafe-call
    const now = (await this.prisma.$queryRawUnsafe(`select now() as now`)) as {
      now: Date;
    }[];
    return { ok: true, now: now?.[0]?.now ?? null };
  }
}
