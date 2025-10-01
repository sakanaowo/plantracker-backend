import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { CombinedAuthGuard } from './combined-auth.guard';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [PrismaModule, forwardRef(() => UsersModule)],
  controllers: [],
  providers: [
    FirebaseAdminProvider,
    CombinedAuthGuard,
    {
      provide: APP_GUARD,
      useClass: CombinedAuthGuard,
    },
  ],
  exports: [CombinedAuthGuard],
})
export class AuthModule {}
