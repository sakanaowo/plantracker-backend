import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CalendarModule } from '../calendar/calendar.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, ActivityLogsModule, CalendarModule, UsersModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
