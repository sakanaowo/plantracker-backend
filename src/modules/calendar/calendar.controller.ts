import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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

@ApiTags('Calendar Integration')
@Controller('calendar')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(private googleCalendarService: GoogleCalendarService) {}

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

  @Post('google/callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiResponse({
    status: 200,
    description: 'OAuth callback processed successfully',
    type: CallbackResponseDto,
  })
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') userId: string,
  ) {
    return await this.googleCalendarService.handleOAuthCallback(code, userId);
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
}
