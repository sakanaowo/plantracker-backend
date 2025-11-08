import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CalendarController } from './calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { MeetingSchedulerService } from './meeting-scheduler.service';
import { MeetingSchedulerController } from './meeting-scheduler.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, PrismaModule, UsersModule],
  controllers: [CalendarController, MeetingSchedulerController],
  providers: [GoogleCalendarService, MeetingSchedulerService],
  exports: [GoogleCalendarService, MeetingSchedulerService],
})
export class CalendarModule {}
