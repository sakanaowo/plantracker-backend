import { Module, forwardRef } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule), forwardRef(() => ProjectsModule)],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
