import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { GoogleCalendarService } from './google-calendar-firebase.service';

// Simple DTOs for Firebase-based approach
class SyncEventDto {
  eventId: string;
}

class BulkSyncEventsDto {
  eventIds: string[];
}

class CalendarStatusResponse {
  available: boolean;
  calendarsCount?: number;
  error?: string;
}

class EventSyncStatusResponse {
  synced: boolean;
  syncStatus: string;
  googleEventId?: string;
  lastSyncedAt?: Date;
}

class SyncResultResponse {
  success: boolean;
  googleEventId?: string;
  htmlLink?: string;
  meetLink?: string;
  message?: string;
}

@ApiTags('calendar')
@Controller('calendar')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check Google Calendar service status' })
  @ApiResponse({
    status: 200,
    description: 'Service status retrieved',
    type: CalendarStatusResponse,
  })
  async getServiceStatus(): Promise<CalendarStatusResponse> {
    return this.googleCalendarService.checkServiceStatus();
  }

  @Post('sync-event')
  @ApiOperation({ summary: 'Sync a single event to Google Calendar' })
  @ApiResponse({
    status: 200,
    description: 'Event synced successfully',
    type: SyncResultResponse,
  })
  async syncEvent(
    @Body() syncEventDto: SyncEventDto,
    @CurrentUser() user: any,
  ): Promise<SyncResultResponse> {
    try {
      const result = await this.googleCalendarService.syncEventToGoogle(
        syncEventDto.eventId,
      );
      return {
        success: true,
        ...result,
        message: 'Event synced to Google Calendar successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post('bulk-sync')
  @ApiOperation({ summary: 'Sync multiple events to Google Calendar' })
  @ApiResponse({ status: 200, description: 'Bulk sync completed' })
  async bulkSyncEvents(
    @Body() bulkSyncDto: BulkSyncEventsDto,
    @CurrentUser() user: any,
  ) {
    if (!bulkSyncDto.eventIds || bulkSyncDto.eventIds.length === 0) {
      throw new BadRequestException('Event IDs are required');
    }

    const results = await this.googleCalendarService.bulkSyncEvents(
      bulkSyncDto.eventIds,
    );

    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    return {
      success: successCount > 0,
      message: `Synced ${successCount}/${totalCount} events successfully`,
      results,
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount,
      },
    };
  }

  @Get('event-sync-status')
  @ApiOperation({ summary: 'Get sync status for an event' })
  @ApiResponse({
    status: 200,
    description: 'Sync status retrieved',
    type: EventSyncStatusResponse,
  })
  async getEventSyncStatus(
    @Query('eventId') eventId: string,
  ): Promise<EventSyncStatusResponse> {
    if (!eventId) {
      throw new BadRequestException('Event ID is required');
    }

    return this.googleCalendarService.getEventSyncStatus(eventId);
  }

  @Post('unsync-event')
  @ApiOperation({ summary: 'Remove event sync from Google Calendar' })
  @ApiResponse({ status: 200, description: 'Event unsynced successfully' })
  async unsyncEvent(
    @Body() syncEventDto: SyncEventDto,
    @CurrentUser() user: any,
  ) {
    try {
      await this.googleCalendarService.unsyncEventFromGoogle(
        syncEventDto.eventId,
      );
      return {
        success: true,
        message: 'Event removed from Google Calendar successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('events')
  @ApiOperation({ summary: 'Get events from Google Calendar' })
  @ApiResponse({ status: 200, description: 'Google Calendar events retrieved' })
  async getGoogleEvents(
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
    @Query('maxResults') maxResults?: number,
  ) {
    const options: any = {};

    if (timeMin) options.timeMin = new Date(timeMin);
    if (timeMax) options.timeMax = new Date(timeMax);
    if (maxResults) options.maxResults = Number(maxResults);

    const events = await this.googleCalendarService.getEvents(options);

    return {
      success: true,
      events,
      count: events.length,
    };
  }
}
