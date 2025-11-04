import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { participant_status } from '@prisma/client';
import { GoogleCalendarService } from '../calendar/google-calendar-firebase.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async create(createEventDto: any, userId: string) {
    const event = await this.prisma.events.create({
      data: {
        project_id: createEventDto.projectId,
        title: createEventDto.title,
        start_at: new Date(createEventDto.startAt),
        end_at: new Date(createEventDto.endAt),
        location: createEventDto.location,
        meet_link: createEventDto.meetLink,
        created_by: userId,
      },
      include: {
        participants: true,
        projects: true,
        users: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    this.logger.log(`Created event: ${event.title} for user ${userId}`);

    // Auto-sync to Google Calendar if enabled
    if (createEventDto.syncToGoogle) {
      try {
        await this.googleCalendarService.syncEventToGoogle(event.id);
        this.logger.log(`Event ${event.id} synced to Google Calendar`);
      } catch (error) {
        this.logger.error(
          `Failed to sync event ${event.id} to Google Calendar:`,
          error,
        );
        // Don't fail the creation if sync fails
      }
    }

    return event;
  }

  async findAll(projectId: string) {
    return this.prisma.events.findMany({
      where: { project_id: projectId },
      include: {
        participants: true,
        users: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { start_at: 'asc' },
    });
  }

  async findByProject(projectId: string) {
    return this.findAll(projectId);
  }

  async findOne(id: string) {
    const event = await this.prisma.events.findUnique({
      where: { id },
      include: {
        participants: true,
        projects: true,
        users: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async update(id: string, updateEventDto: any, userId: string) {
    const updatedEvent = await this.prisma.events.update({
      where: { id },
      data: {
        title: updateEventDto.title,
        start_at: updateEventDto.startAt
          ? new Date(updateEventDto.startAt)
          : undefined,
        end_at: updateEventDto.endAt
          ? new Date(updateEventDto.endAt)
          : undefined,
        location: updateEventDto.location,
        meet_link: updateEventDto.meetLink,
      },
      include: {
        participants: true,
        projects: true,
        users: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    this.logger.log(`Updated event: ${updatedEvent.title} by user ${userId}`);
    return updatedEvent;
  }

  async remove(id: string, userId: string) {
    const event = await this.findOne(id);

    await this.prisma.events.delete({
      where: { id },
    });

    this.logger.log(`Deleted event: ${event.title} by user ${userId}`);
    return { message: 'Event deleted successfully' };
  }

  async addParticipants(eventId: string, participantEmails: string[]) {
    const participantResults: any[] = [];

    for (const email of participantEmails) {
      const user = await this.prisma.users.findUnique({
        where: { email },
      });

      const participant = await this.prisma.participants.create({
        data: {
          event_id: eventId,
          email,
          user_id: user?.id || null,
          status: participant_status.INVITED,
        },
      });

      participantResults.push(participant);
    }

    this.logger.log(
      `Added ${participantResults.length} participants to event ${eventId}`,
    );
    return participantResults;
  }

  async updateParticipantStatus(
    eventId: string,
    participantEmail: string,
    status: string,
  ) {
    return this.prisma.participants.update({
      where: {
        event_id_email: {
          event_id: eventId,
          email: participantEmail,
        },
      },
      data: { status: status as participant_status },
    });
  }
}
