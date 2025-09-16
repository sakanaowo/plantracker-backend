import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthDebugController } from './firebase.controller';
import { AuthController } from './auth.controller';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { CombinedAuthGuard } from './combined-auth.guard';
import { UsersService } from 'src/modules/users/users.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthDebugController, AuthController],
  providers: [
    FirebaseAdminProvider,
    UsersService,
    CombinedAuthGuard, // Add as direct provider
    {
      provide: APP_GUARD,
      useClass: CombinedAuthGuard,
    },
  ],
  exports: [CombinedAuthGuard],
})
export class AuthModule {}
