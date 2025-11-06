import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { GoogleAuthService } from './google-auth.service';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Google Calendar Authentication')
@Controller('auth/google')
export class GoogleAuthController {
  constructor(private googleAuthService: GoogleAuthService) {}

  @Get('auth-url')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Google OAuth URL for Calendar access' })
  async getAuthUrl(@CurrentUser('id') userId: string) {
    const authUrl = this.googleAuthService.getAuthUrl(userId);
    return { authUrl };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.googleAuthService.handleCallback(code, userId);

      // Redirect back to app with success message
      res.redirect(
        `http://localhost:3000/calendar/connected?success=true&email=${result.accountEmail}`,
      );
    } catch (error) {
      // Redirect back to app with error message
      res.redirect(
        `http://localhost:3000/calendar/connected?success=false&error=${error.message}`,
      );
    }
  }

  @Get('status')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check Google Calendar integration status' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.googleAuthService.getIntegrationStatus(userId);
  }

  @Get('disconnect')
  @UseGuards(CombinedAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Google Calendar' })
  async disconnect(@CurrentUser('id') userId: string) {
    return this.googleAuthService.disconnect(userId);
  }
}
