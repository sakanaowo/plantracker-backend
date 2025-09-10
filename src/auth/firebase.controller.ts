import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FirebaseAuthGuard } from 'src/auth/firebase-auth.guard';
import * as admin from 'firebase-admin';

@ApiTags('auth')
@Controller('auth')
export class AuthDebugController {
  @UseGuards(FirebaseAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user (requires Firebase ID token)' })
  @ApiOkResponse({ description: 'Returns ok=true if token is valid' })
  // eslint-disable-next-line @typescript-eslint/require-await
  async me() {
    // Nếu verifyIdToken OK thì route này trả về uid/email
    // await admin.auth().getUser('some-uid');
    return { ok: true };
  }
  // TODO:remove this debug endpoint
  @Get('ping-admin')
  @ApiOperation({
    summary: 'Check Firebase Admin credential by listing 1 user',
  })
  @ApiOkResponse({ description: 'Returns count of listed users' })
  async pingAdmin() {
    // Không cần token: gọi listUsers(1) để kiểm tra credential
    const list = await admin.auth().listUsers(1);
    return { ok: true, count: list.users.length };
  }
}
