import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthDebugController } from './firebase.controller';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { CombinedAuthGuard } from './combined-auth.guard';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthDebugController],
  providers: [
    FirebaseAdminProvider,
    CombinedAuthGuard, // Add as direct provider
    {
      provide: APP_GUARD,
      useClass: CombinedAuthGuard,
    },
  ],
  exports: [CombinedAuthGuard],
})
export class AuthModule {}
