import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkerService } from './worker.service';
import { WorkerController } from './worker.controller';

@Module({
  imports: [NotificationsModule, PrismaModule],
  providers: [WorkerService],
  controllers: [WorkerController],
  exports: [WorkerService],
})
export class WorkerModule {}
