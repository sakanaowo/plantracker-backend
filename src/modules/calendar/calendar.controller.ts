import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { GoogleCalendarService } from './google-calendar.service';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SyncResponseDto } from './dto/calendar-response.dto';

/**
 * CalendarController
 *
 * PURPOSE: Handle Google Calendar synchronization and event management operations.
 *
 * RESPONSIBILITY:
 * - Sync internal events TO Google Calendar
 * - Import events FROM Google Calendar to projects
 * - Trigger manual sync operations
 *
 * NOTE: OAuth authentication flow is handled by GoogleAuthController (/auth/google/*)
 * This controller only handles calendar data operations after user is already authenticated.
 *
 * ENDPOINTS:
 * - POST /calendar/sync - Sync events to Google (legacy, consider deprecating)
 * - GET /calendar/sync/from-google - Import events from Google Calendar
 */
@ApiTags('Calendar Integration')
@Controller('calendar')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(private googleCalendarService: GoogleCalendarService) {}

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

  @Get('sync/from-google')
  @ApiOperation({
    summary: 'Import events from Google Calendar to project',
    description:
      "Fetches events from user's Google Calendar and creates them in the specified project. Requires active Google Calendar integration.",
  })
  @ApiResponse({
    status: 200,
    description: 'Events imported successfully from Google Calendar',
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
