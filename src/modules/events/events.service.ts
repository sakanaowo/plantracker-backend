import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { participant_status } from '@prisma/client';
import { GoogleCalendarService } from '../calendar/google-calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogsService: ActivityLogsService,
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

    // Create activity log for event creation
    try {
      await this.activityLogsService.logEventCreated({
        projectId: createEventDto.projectId,
        eventId: event.id,
        userId: userId,
        eventTitle: event.title,
        eventType: createEventDto.type || 'MEETING',
        startAt: event.start_at,
        endAt: event.end_at,
      });
      this.logger.log(`✅ Activity log created for event: ${event.title}`);
    } catch (error) {
      this.logger.error(`❌ Failed to create activity log: ${error.message}`);
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
    const oldEvent = await this.findOne(id);

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

    // Log event update
    await this.activityLogsService.logEventUpdated({
      projectId: updatedEvent.project_id,
      eventId: updatedEvent.id,
      userId,
      eventTitle: updatedEvent.title,
      oldValue: {
        title: oldEvent.title,
        startAt: oldEvent.start_at,
        endAt: oldEvent.end_at,
        location: oldEvent.location,
      },
      newValue: {
        title: updatedEvent.title,
        startAt: updatedEvent.start_at,
        endAt: updatedEvent.end_at,
        location: updatedEvent.location,
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

    // Log event deletion
    await this.activityLogsService.logEventDeleted({
      projectId: event.project_id,
      eventId: event.id,
      userId,
      eventTitle: event.title,
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

  /**
   * Get events for project with filter
   */
  async getProjectEvents(
    projectId: string,
    filter?: 'UPCOMING' | 'PAST' | 'RECURRING',
  ) {
    const now = new Date();
    const where: any = { project_id: projectId };

    if (filter === 'UPCOMING') {
      where.start_at = { gte: now };
    } else if (filter === 'PAST') {
      where.start_at = { lt: now };
    } else if (filter === 'RECURRING') {
      where.event_type = { not: 'NONE' };
    }

    return this.prisma.events.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
          },
        },
        participants: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar_url: true,
              },
            },
          },
        },
      },
      orderBy: {
        start_at: filter === 'UPCOMING' ? 'asc' : 'desc', // Default when no filter: newest first (desc)
      },
    });
  }

  /**
   * Create project event with Google Meet integration
   */
  async createProjectEvent(
    userId: string,
    dto: {
      projectId: string;
      title: string;
      description?: string;
      date: string; // YYYY-MM-DD
      time: string; // HH:mm
      duration: number; // minutes
      type: 'MEETING' | 'MILESTONE' | 'OTHER';
      recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
      attendeeIds: string[];
      createGoogleMeet: boolean;
    },
  ) {
    // Get attendee emails
    const attendees = await this.prisma.users.findMany({
      where: { id: { in: dto.attendeeIds } },
      select: { email: true, id: true },
    });

    const attendeeEmails = attendees.map((a) => a.email);

    // Create in Google Calendar if user has it connected
    let calendarEventId: string | null = null;
    let meetLink: string | null = null;

    try {
      const startAt = new Date(`${dto.date}T${dto.time}:00`);
      const endAt = new Date(startAt.getTime() + dto.duration * 60000);

      const result =
        await this.googleCalendarService.createProjectEventInGoogle(userId, {
          title: dto.title,
          description: dto.description,
          startAt,
          endAt,
          attendeeEmails,
          createMeet: dto.createGoogleMeet,
        });

      calendarEventId = result.calendarEventId;
      meetLink = result.meetLink;
    } catch (error) {
      this.logger.error('Failed to create calendar event:', error);
      // Continue without calendar integration
    }

    // Create in database
    const startAt = new Date(`${dto.date}T${dto.time}:00`);
    const endAt = new Date(startAt.getTime() + dto.duration * 60000);

    const event = await this.prisma.events.create({
      data: {
        project_id: dto.projectId,
        title: dto.title,
        description: dto.description,
        start_at: startAt,
        end_at: endAt,
        event_type: dto.type,
        recurrence: dto.recurrence,
        meet_link: meetLink,
        created_by: userId,
        participants: {
          create: dto.attendeeIds.map((attendeeId) => ({
            user_id: attendeeId,
            email: attendees.find((a) => a.id === attendeeId)?.email || '',
            status: participant_status.INVITED,
          })),
        },
      },
      include: {
        participants: {
          include: {
            users: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Store external event mapping
    if (calendarEventId) {
      await this.prisma.external_event_map.create({
        data: {
          event_id: event.id,
          provider: 'GOOGLE_CALENDAR',
          provider_event_id: calendarEventId,
          last_synced_at: new Date(),
        },
      });
    }

    this.logger.log(`Created project event: ${event.title}`);

    // ✅ Log event creation activity
    try {
      await this.activityLogsService.logEventCreated({
        projectId: dto.projectId,
        eventId: event.id,
        userId,
        eventTitle: event.title,
        eventType: dto.type,
        startAt: event.start_at,
        endAt: event.end_at,
      });
    } catch (error) {
      this.logger.error('Failed to log event creation activity:', error);
    }

    // 🔔 Send EVENT_INVITE notification to all attendees
    try {
      const creator = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      await this.notificationsService.sendEventInvite({
        eventId: event.id,
        eventTitle: event.title,
        eventDescription: event.description || undefined,
        startTime: event.start_at,
        endTime: event.end_at,
        location: event.meet_link || undefined,
        organizerId: userId,
        organizerName: creator?.name || creator?.email || 'Unknown',
        meetLink: meetLink || undefined,
        inviteeIds: dto.attendeeIds,
      });
    } catch (error) {
      this.logger.error('Failed to send event invite notifications:', error);
    }

    return event;
  }

  /**
   * Update project event
   */
  async updateProjectEvent(
    userId: string,
    eventId: string,
    dto: {
      title?: string;
      description?: string;
      date?: string;
      time?: string;
      duration?: number;
      attendeeIds?: string[];
    },
  ) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        external_event_map: {
          where: { provider: 'GOOGLE_CALENDAR' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Update in Google Calendar if exists
    const mapping = event.external_event_map[0];
    if (mapping?.provider_event_id) {
      try {
        let startAt: Date | undefined;
        let endAt: Date | undefined;

        if (dto.date && dto.time) {
          startAt = new Date(`${dto.date}T${dto.time}:00`);
          endAt = new Date(startAt.getTime() + (dto.duration || 60) * 60000);
        }

        const attendees = dto.attendeeIds
          ? await this.prisma.users.findMany({
              where: { id: { in: dto.attendeeIds } },
              select: { email: true },
            })
          : undefined;

        await this.googleCalendarService.updateProjectEventInGoogle(
          userId,
          mapping.provider_event_id,
          {
            title: dto.title,
            description: dto.description,
            startAt,
            endAt,
            attendeeEmails: attendees?.map((a) => a.email),
          },
        );
      } catch (error) {
        this.logger.error('Failed to update calendar event:', error);
      }
    }

    // Update in database
    const updateData: any = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.description) updateData.description = dto.description;
    if (dto.date && dto.time) {
      const startAt = new Date(`${dto.date}T${dto.time}:00`);
      updateData.start_at = startAt;
      updateData.end_at = new Date(
        startAt.getTime() + (dto.duration || 60) * 60000,
      );
    }

    const updatedEvent = await this.prisma.events.update({
      where: { id: eventId },
      data: updateData,
      include: {
        participants: true,
      },
    });

    this.logger.log(`Updated project event: ${updatedEvent.title}`);

    // 🔔 Send EVENT_UPDATED notification to all participants
    try {
      const updater = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      const participantIds = updatedEvent.participants
        .filter((p) => p.user_id)
        .map((p) => p.user_id!);

      // Detect what changed
      const changes = {
        time: !!(dto.date && dto.time),
        location: !!dto.description,
        description: !!dto.description,
      };

      if (participantIds.length > 0) {
        await this.notificationsService.sendEventUpdated({
          eventId: updatedEvent.id,
          eventTitle: updatedEvent.title,
          changes,
          newStartTime:
            dto.date && dto.time ? updatedEvent.start_at : undefined,
          newEndTime: dto.date && dto.time ? updatedEvent.end_at : undefined,
          newLocation: dto.description,
          updatedBy: userId,
          updatedByName: updater?.name || updater?.email || 'Unknown',
          participantIds,
        });
      }
    } catch (error) {
      this.logger.error('Failed to send event updated notifications:', error);
    }

    return updatedEvent;
  }

  /**
   * Delete project event
   */
  async deleteProjectEvent(userId: string, eventId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        external_event_map: {
          where: { provider: 'GOOGLE_CALENDAR' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Delete from Google Calendar if exists
    const mapping = event.external_event_map[0];
    if (mapping?.provider_event_id) {
      try {
        await this.googleCalendarService.deleteProjectEventInGoogle(
          userId,
          mapping.provider_event_id,
        );
      } catch (error) {
        this.logger.error('Failed to delete calendar event:', error);
      }
    }

    // Delete from database (cascade will handle participants and mappings)
    await this.prisma.events.delete({
      where: { id: eventId },
    });

    this.logger.log(`Deleted project event: ${event.title}`);
    return { success: true };
  }

  /**
   * Send reminder to attendees
   */
  async sendReminder(eventId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            users: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // TODO: Integrate with notification system to send reminders
    this.logger.log(`Sending reminder for event: ${event.title}`);

    return { success: true };
  }

  /**
   * Get RSVP statistics for an event
   * Returns counts of ACCEPTED, DECLINED, TENTATIVE, INVITED, NO_RESPONSE
   */
  async getRsvpStats(eventId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          select: {
            status: true,
            email: true,
            users: {
              select: {
                name: true,
                avatar_url: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Count by status
    const stats = {
      total: event.participants.length,
      accepted: 0,
      declined: 0,
      tentative: 0,
      invited: 0,
      noResponse: 0,
    };

    const participantsByStatus: Record<string, any[]> = {
      ACCEPTED: [],
      DECLINED: [],
      TENTATIVE: [],
      INVITED: [],
      NO_RESPONSE: [],
    };

    event.participants.forEach((p) => {
      const status = p.status || 'NO_RESPONSE';

      if (status === 'ACCEPTED') stats.accepted++;
      else if (status === 'DECLINED') stats.declined++;
      else if (status === 'TENTATIVE') stats.tentative++;
      else if (status === 'INVITED') stats.invited++;
      else stats.noResponse++;

      participantsByStatus[status].push({
        email: p.email,
        name: p.users?.name || p.email.split('@')[0],
        avatar: p.users?.avatar_url,
      });
    });

    return {
      eventId: event.id,
      eventTitle: event.title,
      stats,
      participants: participantsByStatus,
    };
  }
}
