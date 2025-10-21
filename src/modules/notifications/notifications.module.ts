import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FcmModule } from '../fcm/fcm.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [FcmModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
