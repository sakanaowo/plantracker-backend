import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleAuthService } from './google-auth.service';
import { GoogleAuthController } from './google-auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [ConfigModule, PrismaModule, UsersModule, AuthModule],
  providers: [GoogleAuthService],
  controllers: [GoogleAuthController],
  exports: [GoogleAuthService],
})
export class GoogleAuthModule {}
