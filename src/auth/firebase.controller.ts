import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FirebaseAuthGuard } from 'src/auth/firebase-auth.guard';

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
}
