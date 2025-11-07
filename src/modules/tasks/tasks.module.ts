import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    ActivityLogsModule,
    CalendarModule,
  ],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
