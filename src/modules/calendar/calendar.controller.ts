import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { GoogleCalendarService } from './google-calendar.service';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  AuthUrlResponseDto,
  CallbackResponseDto,
  SyncResponseDto,
  IntegrationStatusResponseDto,
} from './dto/calendar-response.dto';

/**
 * TODO [TONIGHT TESTING WITH FE]:
 * 1. Test GET /calendar/google/auth-url - Get OAuth URL
 * 2. Test POST /calendar/google/callback - Complete OAuth flow
 * 3. Test GET /calendar/google/status - Check integration status
 * 4. Test POST /calendar/google/sync - Manual sync trigger
 * 5. Test DELETE /calendar/google/disconnect - Disconnect integration
 *
 * FLOW TO TEST:
 * 1. FE calls /auth-url → Opens Google consent screen
 * 2. User authorizes → Google redirects back with code
 * 3. FE calls /callback with code → Tokens saved to DB
 * 4. Check /status → Should show connected
 * 5. Test calendar sync with tasks/events
 */
@ApiTags('Calendar Integration')
@Controller('calendar')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(private googleCalendarService: GoogleCalendarService) {}

  // TODO [TONIGHT]: Test getting real auth URL, open in browser
  @Get('google/auth-url')
  @ApiOperation({ summary: 'Get Google OAuth authorization URL' })
  @ApiResponse({
    status: 200,
    description: 'OAuth URL generated successfully',
    type: AuthUrlResponseDto,
  })
  async getGoogleAuthUrl(@CurrentUser('id') userId: string) {
    const authUrl = await this.googleCalendarService.getAuthUrl(userId);
    return { authUrl };
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to mobile app deep link',
  })
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.googleCalendarService.handleOAuthCallback(
        code,
        userId,
      );

      // Redirect về Android app với Deep Link
      if (result.success) {
        return res.redirect(
          302,
          `plantracker://calendar/connected?status=success&userId=${userId}`,
        );
      } else {
        return res.redirect(
          302,
          `plantracker://calendar/connected?status=error&message=${encodeURIComponent('Failed to connect')}`,
        );
      }
    } catch (error) {
      return res.redirect(
        302,
        `plantracker://calendar/connected?status=error&message=${encodeURIComponent(error.message || 'Unknown error')}`,
      );
    }
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync events with Google Calendar' })
  @ApiResponse({
    status: 200,
    description: 'Events synced successfully',
    type: SyncResponseDto,
  })
  async syncEvents(
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId: string,
  ) {
    await this.googleCalendarService.syncUserEvents(userId, projectId);
    return { success: true, message: 'Events synced successfully' };
  }

  @Get('integration-status')
  @ApiOperation({ summary: 'Get Google Calendar integration status' })
  @ApiResponse({
    status: 200,
    description: 'Integration status retrieved successfully',
    type: IntegrationStatusResponseDto,
  })
  async getIntegrationStatus(@CurrentUser('id') userId: string) {
    return await this.googleCalendarService.getIntegrationStatus(userId);
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect Google Calendar integration' })
  @ApiResponse({
    status: 200,
    description: 'Integration disconnected successfully',
    type: CallbackResponseDto,
  })
  async disconnectIntegration(@CurrentUser('id') userId: string) {
    return await this.googleCalendarService.disconnectIntegration(userId);
  }

  @Get('sync/from-google')
  @ApiOperation({ summary: 'Sync events from Google Calendar to project' })
  @ApiResponse({
    status: 200,
    description: 'Events synced successfully from Google Calendar',
  })
  async syncFromGoogle(
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId: string,
    @Query('timeMin') timeMin: string,
    @Query('timeMax') timeMax: string,
  ) {
    if (!projectId || !timeMin || !timeMax) {
      throw new BadRequestException(
        'Missing required parameters: projectId, timeMin, timeMax',
      );
    }

    try {
      const events = await this.googleCalendarService.syncEventsFromGoogle(
        userId,
        projectId,
        timeMin,
        timeMax,
      );

      return {
        success: true,
        events,
        count: events.length,
      };
    } catch (err: unknown) {
      // Handle NestJS exceptions (they have response.message structure)
      if (err instanceof BadRequestException) {
        const errorResponse = err.getResponse();
        const errorMessage =
          typeof errorResponse === 'string'
            ? errorResponse
            : (errorResponse as { message?: string }).message;

        return {
          success: false,
          events: [],
          count: 0,
          message: errorMessage ?? 'Bad Request',
        };
      }

      if (err instanceof NotFoundException) {
        const errorResponse = err.getResponse();
        const errorMessage =
          typeof errorResponse === 'string'
            ? errorResponse
            : (errorResponse as { message?: string }).message;

        return {
          success: false,
          events: [],
          count: 0,
          message: errorMessage ?? 'Project not found',
        };
      }

      // Handle regular errors
      const error = err as Error;
      console.error('Calendar sync error:', error);
      return {
        success: false,
        events: [],
        count: 0,
        message: error.message ?? 'Failed to sync events from Google Calendar',
      };
    }
  }
}
