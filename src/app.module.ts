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
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    BoardsModule,
    TasksModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
