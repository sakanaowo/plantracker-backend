import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { BoardsModule } from './modules/boards/boards.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { TimerModule } from './modules/timers/timer.module';
import { FcmModule } from './modules/fcm/fcm.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WorkerModule } from './modules/worker/worker.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { LabelsModule } from './modules/labels/labels.module';
import { CommentsModule } from './modules/comments/comments.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { ProjectMembersModule } from './modules/project-members/project-members.module';
import { ChecklistsModule } from './modules/checklists/checklists.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { EventsModule } from './modules/events/events.module';
import { GoogleAuthModule } from './modules/google-auth/google-auth.module';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    BoardsModule,
    TasksModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    TimerModule,
    FcmModule,
    NotificationsModule,
    WorkerModule,
    ActivityLogsModule,
    LabelsModule,
    CommentsModule,
    AttachmentsModule,
    ProjectMembersModule,
    ChecklistsModule,
    CalendarModule,
    EventsModule,
    GoogleAuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
