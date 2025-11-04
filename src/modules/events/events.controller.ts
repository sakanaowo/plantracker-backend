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
  findByProject(@Query('projectId') projectId: string) {
    return this.eventsService.findByProject(projectId);
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
}
