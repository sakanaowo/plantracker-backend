import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL || process.env.DIRECT_URL,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Clear any existing prepared statements on startup (development only)
    if (process.env.NODE_ENV === 'development') {
      try {
        await this.$executeRawUnsafe('DEALLOCATE ALL');
      } catch {
        // Ignore errors - no prepared statements to deallocate
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanUp() {
    await this.$disconnect();
  }
}
