import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { localLoginDto } from './dto/local-login.dto';
import { localSignupDto } from './dto/local-signup.dto';
import { FirebaseAuthDto } from './dto/firebase-auth.dto';
import { CombinedAuthGuard } from 'src/auth/combined-auth.guard';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { updateMeDto } from './dto/update-me.dto';
import {
  RegisterDeviceDto,
  UpdateTokenDto,
} from 'src/modules/notifications/dto';
// import type { UserPayload } from 'src/type/user-payload.type';
import { Public } from 'src/auth/public.decorator';
import * as admin from 'firebase-admin';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('local/signup')
  @Public()
  @ApiOperation({ summary: 'Sign up with email and password' })
  localSignup(@Body() dto: localSignupDto) {
    return this.users.localSignup(dto);
  }

  @Post('local/signin')
  @Public()
  @ApiOperation({ summary: 'Sign in with email and password' })
  localSignin(@Body() dto: localLoginDto) {
    return this.users.localLogin(dto);
  }

  @Post('firebase/auth')
  @Public()
  @ApiOperation({
    summary: 'Complete Firebase authentication (Google Sign-In)',
  })
  async firebaseAuth(@Body() body: FirebaseAuthDto) {
    if (!body.idToken) {
      throw new Error('Firebase ID token is required');
    }

    try {
      console.log('Firebase Admin initialized:', !!admin.apps.length);

      // Verify the token and get Firebase UID
      const decoded = await admin.auth().verifyIdToken(body.idToken);

      console.log('Token verified for user:', decoded.uid);

      // Use our new service method for consistent response
      return await this.users.firebaseAuth(decoded.uid, body.idToken);
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      throw new Error('Invalid Firebase token');
    }
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  me(@CurrentUser() userId: string) {
    return this.users.getById(userId);
  }

  @Put('me')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Update my profile' })
  updateMe(@CurrentUser() userId: string, @Body() dto: updateMeDto) {
    return this.users.updateMeById(userId, dto);
  }

  // ==================== FCM DEVICE MANAGEMENT ====================

  @Post('devices/register')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Register FCM device token' })
  registerDevice(
    @CurrentUser() userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.users.registerDevice(userId, dto);
  }

  @Patch('devices/token')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Update FCM token for existing device' })
  updateToken(@CurrentUser() userId: string, @Body() dto: UpdateTokenDto) {
    return this.users.updateFcmToken(userId, dto);
  }

  @Delete('devices/:deviceId')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Unregister device (soft delete)' })
  unregisterDevice(
    @CurrentUser() userId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.users.unregisterDevice(userId, deviceId);
  }

  @Get('devices')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Get all registered devices for current user' })
  getDevices(@CurrentUser() userId: string) {
    return this.users.getUserDevices(userId);
  }
}
