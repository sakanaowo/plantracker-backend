import { Module } from '@nestjs/common';
import { AuthDebugController } from './firebase.controller';
import { FirebaseAdminProvider } from './firebase-admin.provider';

@Module({
  controllers: [AuthDebugController],
  providers: [FirebaseAdminProvider],
  exports: [],
})
export class AuthModule {}

