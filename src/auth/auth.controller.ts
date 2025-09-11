import {
  Body,
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CombinedAuthGuard } from './combined-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { UsersService } from 'src/modules/users/users.service';
import { localLoginDto } from 'src/modules/users/dto/local-login.dto';
import { localSignupDto } from 'src/modules/users/dto/local-signup.dto';
import type { UserPayload } from 'src/type/user-payload.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        token: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async login(@Body() dto: localLoginDto) {
    const result = await this.usersService.localLogin(dto);
    return {
      ...result,
      message: 'Login successful',
    };
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user with email and password' })
  @ApiOkResponse({
    description: 'Registration successful',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        token: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async register(@Body() dto: localSignupDto) {
    const result = await this.usersService.localSignup(dto);
    return {
      ...result,
      message: 'Registration successful',
    };
  }

  @Get('me')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({
    description: 'Current user information',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        source: { type: 'string' },
      },
    },
  })
  async getCurrentUser(@CurrentUser() user: UserPayload) {
    const userData =
      user.source === 'firebase'
        ? await this.usersService.getByFirebaseUid(user.uid)
        : await this.usersService.getById(user.uid);

    return {
      user: userData,
      source: user.source,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current user' })
  @ApiOkResponse({
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  logout(@CurrentUser() user: UserPayload) {
    // For JWT-based auth, logout is typically handled client-side
    // by removing the token from storage.
    // Server-side logout would require token blacklisting or
    // session management, which we can implement if needed.

    // For now, we just return success as the client should
    // remove the token from their storage
    return {
      message:
        'Logout successful. Please remove the token from client storage.',
      user_id: user.uid,
      source: user.source,
    };
  }

  @Post('firebase/sync')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync Firebase user to local database' })
  @ApiOkResponse({
    description: 'Firebase user synced successfully',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        message: { type: 'string' },
      },
    },
  })
  async firebaseSync(@CurrentUser() user: UserPayload) {
    if (user.source !== 'firebase') {
      throw new Error('Only Firebase users can sync');
    }

    const syncedUser = await this.usersService.ensureFromFirebase({
      uid: user.uid,
      email: user.email,
      name: user.name,
      avatarUrl: user.picture,
    });

    return {
      user: syncedUser,
      message: 'Firebase user synced successfully',
    };
  }
}
