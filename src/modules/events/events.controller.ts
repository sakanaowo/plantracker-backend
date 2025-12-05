import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CancelEventDto } from './dto/cancel-event.dto';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Events')
@Controller('events')
@UseGuards(CombinedAuthGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.create(createEventDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get events by project' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  findByProject(
    @Query('projectId') projectId: string,
    @Query('status') status?: 'ACTIVE' | 'CANCELLED' | 'ALL',
  ) {
    return this.eventsService.findByProject(projectId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.update(id, updateEventDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.eventsService.remove(id, userId);
  }

  @Post(':id/participants')
  @ApiOperation({ summary: 'Add participants to event' })
  @ApiResponse({ status: 201, description: 'Participants added successfully' })
  addParticipants(
    @Param('id') eventId: string,
    @Body() participantData: { emails: string[] },
  ) {
    return this.eventsService.addParticipants(eventId, participantData.emails);
  }

  @Patch(':id/participants/:email/status')
  @ApiOperation({ summary: 'Update participant status' })
  @ApiResponse({
    status: 200,
    description: 'Participant status updated successfully',
  })
  updateParticipantStatus(
    @Param('id') eventId: string,
    @Param('email') email: string,
    @Body() statusData: { status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' },
  ) {
    return this.eventsService.updateParticipantStatus(
      eventId,
      email,
      statusData.status,
    );
  }

  @Get(':id/rsvp-stats')
  @ApiOperation({ summary: 'Get RSVP statistics for event' })
  @ApiResponse({
    status: 200,
    description: 'RSVP stats retrieved successfully',
  })
  getRsvpStats(@Param('id') eventId: string) {
    return this.eventsService.getRsvpStats(eventId);
  }

  // ==================== NEW PROJECT EVENTS ENDPOINTS ====================
  // TODO [TONIGHT]: Test project events with FE and Google Calendar
  // 1. Create event with Google Meet → Check Meet link generated
  // 2. Update event → Check calendar updated for all attendees
  // 3. Delete event → Check removed from Google Calendar
  // 4. Filter events (UPCOMING/PAST/RECURRING) → Check correct results
  // 5. Send reminder → Check notifications sent

  // TODO [TONIGHT]: Test GET /events/projects/:projectId?filter=UPCOMING
  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get project events with filter' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  getProjectEvents(
    @Param('projectId') projectId: string,
    @Query('filter') filter?: 'UPCOMING' | 'PAST' | 'RECURRING',
    @Query('status') status?: 'ACTIVE' | 'CANCELLED' | 'ALL',
  ) {
    return this.eventsService.getProjectEvents(projectId, filter, status);
  }

  // TODO [TONIGHT]: Test creating event WITH createGoogleMeet=true
  // Verify Google Meet link in response and attendees receive invite
  @Post('projects')
  @ApiOperation({ summary: 'Create project event with Google Meet' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  createProjectEvent(
    @Body()
    dto: {
      projectId: string;
      title: string;
      description?: string;
      date: string;
      time: string;
      duration: number;
      type: 'MEETING' | 'MILESTONE' | 'OTHER';
      recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
      attendeeIds: string[];
      createGoogleMeet: boolean;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.createProjectEvent(userId, dto);
  }

  // TODO [TONIGHT]: Test updating event, check Google Calendar syncs
  @Patch('projects/:id')
  @ApiOperation({ summary: 'Update project event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  updateProjectEvent(
    @Param('id') eventId: string,
    @Body()
    dto: {
      title?: string;
      description?: string;
      date?: string;
      time?: string;
      duration?: number;
      attendeeIds?: string[];
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.updateProjectEvent(userId, eventId, dto);
  }

  // TODO [TONIGHT]: Test deleting event, verify removed from Google Calendar
  @Delete('projects/:id')
  @ApiOperation({ summary: 'Delete project event' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  deleteProjectEvent(
    @Param('id') eventId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.deleteProjectEvent(userId, eventId);
  }

  // TODO [TONIGHT]: Test send reminder (currently placeholder)
  @Post('projects/:id/send-reminder')
  @ApiOperation({ summary: 'Send reminder to event attendees' })
  @ApiResponse({ status: 200, description: 'Reminder sent successfully' })
  sendReminder(@Param('id') eventId: string) {
    return this.eventsService.sendReminder(eventId);
  }

  // ==================== CANCEL/RESTORE EVENT ====================

  @Patch('projects/:projectId/events/:eventId/cancel')
  @ApiOperation({ summary: 'Cancel an event (soft delete)' })
  @ApiResponse({ status: 200, description: 'Event cancelled successfully' })
  cancelEvent(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @Body() dto: CancelEventDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.cancelEvent(projectId, eventId, userId, dto);
  }

  @Patch('projects/:projectId/events/:eventId/restore')
  @ApiOperation({ summary: 'Restore a cancelled event' })
  @ApiResponse({ status: 200, description: 'Event restored successfully' })
  restoreEvent(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.restoreEvent(projectId, eventId, userId);
  }

  @Delete('projects/:projectId/events/:eventId/hard-delete')
  @ApiOperation({ summary: 'Permanently delete an event' })
  @ApiResponse({ status: 200, description: 'Event permanently deleted' })
  hardDeleteEvent(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.hardDeleteEvent(projectId, eventId, userId);
  }
}
