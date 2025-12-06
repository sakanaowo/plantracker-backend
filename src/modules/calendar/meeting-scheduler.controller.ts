import { Body, Controller, Post, UseGuards, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { MeetingSchedulerService } from './meeting-scheduler.service';
import { SuggestMeetingTimeDto } from './dto/suggest-meeting-time.dto';

@ApiTags('Meeting Scheduler')
@Controller('calendar/meetings')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class MeetingSchedulerController {
  constructor(private meetingScheduler: MeetingSchedulerService) {}

  @Post('suggest-times')
  @ApiOperation({
    summary: 'Suggest meeting times based on participants availability',
    description:
      'Uses Google Calendar Free/Busy API to find time slots where maximum participants are available',
  })
  async suggestMeetingTimes(@Body() dto: SuggestMeetingTimeDto) {
    return this.meetingScheduler.suggestMeetingTimes(dto);
  }

  @Post('create')
  @ApiOperation({
    summary: 'Create a meeting event with Google Meet link',
    description:
      'Creates a calendar event for selected time slot with automatic Google Meet link generation',
  })
  async createMeeting(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      attendeeIds: string[];
      timeSlot: { start: string; end: string; availableUsers: string[] };
      summary: string;
      description?: string;
    },
  ) {
    return this.meetingScheduler.createMeetingEvent(
      userId,
      body.attendeeIds,
      {
        ...body.timeSlot,
        score: 100,
      },
      body.summary,
      body.description,
    );
  }

  @Get('project/:projectId/members')
  @ApiOperation({
    summary: 'Get project members with Google Calendar integration status',
    description:
      'Returns list of project members and their calendar sync status',
  })
  getProjectMembersWithCalendarStatus(@Param('projectId') _projectId: string) {
    return {
      message:
        'To be implemented - returns project members with calendar status',
    };
  }
}
