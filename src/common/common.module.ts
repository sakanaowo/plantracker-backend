import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionService } from './services/permission.service';
import { ContextService } from './services/context.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [PermissionService, ContextService],
  exports: [PermissionService, ContextService],
})
export class CommonModule {}
