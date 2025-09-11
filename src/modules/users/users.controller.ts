import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { localLoginDto } from './dto/local-login.dto';
import { localSignupDto } from './dto/local-signup.dto';
import { CombinedAuthGuard } from 'src/auth/combined-auth.guard';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { updateMeDto } from './dto/update-me.dto';
import type { UserPayload } from 'src/type/user-payload.type';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('local/signup')
  @ApiOperation({ summary: 'Sign up with email and password' })
  localSignup(@Body() dto: localSignupDto) {
    return this.users.localSignup(dto);
  }

  @Post('local/signin')
  @ApiOperation({ summary: 'Sign in with email and password' })
  localSignin(@Body() dto: localLoginDto) {
    return this.users.localLogin(dto);
  }

  @Post('firebase/sync')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({ summary: 'Sync Firebase user' })
  async firebaseSync(@CurrentUser() user: UserPayload) {
    if (user.source !== 'firebase') {
      throw new Error('Only Firebase users can sync');
    }

    const row = await this.users.ensureFromFirebase({
      uid: user.uid,
      email: user.email,
      name: user.name,
      avatarUrl: user.picture,
    });

    return { user: row };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  me(@CurrentUser() user: UserPayload) {
    return user.source === 'firebase'
      ? this.users.getByFirebaseUid(user.uid)
      : this.users.getById(user.uid);
  }

  @Put('me')
  @ApiBearerAuth()
  @UseGuards(CombinedAuthGuard)
  updateMe(@CurrentUser() user: UserPayload, @Body() dto: updateMeDto) {
    return user.source === 'firebase'
      ? this.users.updateMeByFirebase(user.uid, dto)
      : this.users.updateMeById(user.uid, dto);
  }
}
