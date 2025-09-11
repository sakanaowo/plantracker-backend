import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthDebugController } from './firebase.controller';
import { AuthController } from './auth.controller';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { CombinedAuthGuard } from './combined-auth.guard';
import { UsersService } from 'src/modules/users/users.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '31d' },
    }),
    PrismaModule,
  ],
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
  exports: [CombinedAuthGuard, JwtModule],
})
export class AuthModule {}
