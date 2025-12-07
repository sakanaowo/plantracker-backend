import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { participant_status } from '@prisma/client';
import { GoogleCalendarService } from '../calendar/google-calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CancelEventDto } from './dto/cancel-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  CreateEventReminderDto,
  EventReminderResponseDto,
} from './dto/event-reminder.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(createEventDto: CreateEventDto, userId: string) {
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
        workspaceId: event.projects?.workspace_id,
        projectId: createEventDto.projectId,
        eventId: event.id,
        userId: userId,
        eventTitle: event.title,
        eventType: 'MEETING', // Default to MEETING for simple events
        startAt: event.start_at,
        endAt: event.end_at,
      });
      this.logger.log(`✅ Activity log created for event: ${event.title}`);
    } catch (error) {
      this.logger.error(`❌ Failed to create activity log: ${error.message}`);
    }

    return event;
  }

  async findAll(projectId: string, status?: 'ACTIVE' | 'CANCELLED' | 'ALL') {
    const where: any = { project_id: projectId };

    // Default: only show active events
    if (status && status !== 'ALL') {
      where.status = status;
    } else if (!status) {
      where.status = 'ACTIVE';
    }

    return this.prisma.events.findMany({
      where,
      include: {
        participants: true,
        users: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { start_at: 'asc' },
    });
  }

  async findByProject(
    projectId: string,
    status?: 'ACTIVE' | 'CANCELLED' | 'ALL',
  ) {
    return this.findAll(projectId, status);
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

  async update(id: string, updateEventDto: UpdateEventDto, userId: string) {
    const oldEvent = await this.findOne(id);

    // ✅ Permission check: Only event creator or project admin/owner can update
    await this.checkEventPermission(
      oldEvent.project_id,
      userId,
      oldEvent.created_by,
    );

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
      workspaceId: updatedEvent.projects.workspace_id, // ✅ Add workspace
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

    // ✅ Permission check: Only event creator or project admin/owner can delete
    await this.checkEventPermission(event.project_id, userId, event.created_by);

    await this.prisma.events.delete({
      where: { id },
    });

    // Log event deletion
    await this.activityLogsService.logEventDeleted({
      workspaceId: event.projects.workspace_id, // ✅ Add workspace
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
   * Get events for project (shows ACTIVE and CANCELLED by default)
   */
  async getProjectEvents(
    projectId: string,
    status?: 'ACTIVE' | 'CANCELLED' | 'ALL',
  ) {
    const where: any = { project_id: projectId };

    // Status filter: Default shows ACTIVE and CANCELLED (exclude COMPLETED)
    if (status === 'ALL') {
      // Show all events including COMPLETED
    } else if (status === 'ACTIVE' || status === 'CANCELLED') {
      where.status = status;
    } else {
      // Default: Show ACTIVE and CANCELLED events
      where.status = { in: ['ACTIVE', 'CANCELLED'] };
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
        start_at: 'desc', // Newest first
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
    // ✅ Auto-add event creator to attendees if not already included (use Set to prevent duplicates)
    const attendeeIdsSet = new Set(dto.attendeeIds);
    attendeeIdsSet.add(userId); // Add creator
    const allAttendeeIds = Array.from(attendeeIdsSet);

    // Get attendee emails
    const attendees = await this.prisma.users.findMany({
      where: { id: { in: allAttendeeIds } },
      select: { email: true, id: true },
    });

    const attendeeEmails = attendees.map((a) => a.email);

    // Create in Google Calendar if user has it connected
    let calendarEventId: string | null = null;
    let meetLink: string | null = null;

    try {
      // Parse datetime with timezone from FE (e.g., "2025-12-06T01:00:00+07:00")
      // If FE doesn't send timezone, default to Vietnam time (+07:00)
      const startAtStr = `${dto.date}T${dto.time}:00`;
      const hasTimezone =
        startAtStr.includes('+') || startAtStr.match(/-\d{2}:\d{2}$/);
      const startAt = new Date(
        hasTimezone ? startAtStr : `${startAtStr}+07:00`,
      );
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
    // Parse datetime with timezone from FE (e.g., "2025-12-06T01:00:00+07:00")
    // If FE doesn't send timezone, default to Vietnam time (+07:00)
    const startAtStr = `${dto.date}T${dto.time}:00`;
    const hasTimezone =
      startAtStr.includes('+') || startAtStr.match(/-\d{2}:\d{2}$/);
    const startAt = new Date(hasTimezone ? startAtStr : `${startAtStr}+07:00`);
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
          create: allAttendeeIds.map((attendeeId) => ({
            user_id: attendeeId,
            email: attendees.find((a) => a.id === attendeeId)?.email || '',
            status:
              attendeeId === userId
                ? participant_status.ACCEPTED // ✅ Creator auto-accepts
                : participant_status.INVITED,
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
        projects: {
          select: {
            workspace_id: true,
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
        workspaceId: event.projects?.workspace_id,
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

    // 🔔 Send EVENT_INVITE notification to all attendees (except creator)
    try {
      const creator = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      // ✅ Only send invites to attendees who are not the creator
      const inviteeIds = allAttendeeIds.filter((id) => id !== userId);

      this.logger.log(
        `📧 Event attendees: total=${allAttendeeIds.length}, invitees=${inviteeIds.length}, creator=${userId}`,
      );

      if (inviteeIds.length > 0) {
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
          inviteeIds,
        });
      }
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

    // ✅ Permission check: Only event creator or project admin/owner can update
    await this.checkEventPermission(event.project_id, userId, event.created_by);

    // Update in Google Calendar if exists
    const mapping = event.external_event_map[0];
    if (mapping?.provider_event_id) {
      try {
        let startAt: Date | undefined;
        let endAt: Date | undefined;

        if (dto.date && dto.time) {
          // Parse datetime with timezone from FE or default to Vietnam (+07:00)
          const startAtStr = `${dto.date}T${dto.time}:00`;
          const hasTimezone =
            startAtStr.includes('+') || startAtStr.match(/-\d{2}:\d{2}$/);
          startAt = new Date(hasTimezone ? startAtStr : `${startAtStr}+07:00`);
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
      // Parse datetime with timezone from FE or default to Vietnam (+07:00)
      const startAtStr = `${dto.date}T${dto.time}:00`;
      const hasTimezone =
        startAtStr.includes('+') || startAtStr.match(/-\d{2}:\d{2}$/);
      const startAt = new Date(
        hasTimezone ? startAtStr : `${startAtStr}+07:00`,
      );
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

    // Permission check: Only event creator or project admin/owner can delete
    await this.checkEventPermission(event.project_id, userId, event.created_by);

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
   * Soft delete project event (cancel instead of hard delete)
   */
  async softDeleteProjectEvent(userId: string, eventId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        projects: true,
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Use cancelEvent logic
    return this.cancelEvent(event.project_id, eventId, userId, {
      reason: 'Event deleted by user',
    });
  }

  /**
   * Permanently delete project event (hard delete for UI)
   */
  async permanentDeleteProjectEvent(userId: string, eventId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        projects: true,
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
        this.logger.log(`✅ Deleted event from Google Calendar`);
      } catch (error) {
        this.logger.error(
          `❌ Failed to delete from Google Calendar: ${error.message}`,
        );
      }
    }

    // Log activity before deletion
    try {
      await this.activityLogsService.logEventDeleted({
        workspaceId: event.projects.workspace_id,
        projectId: event.project_id,
        eventId: event.id,
        userId,
        eventTitle: event.title,
      });
    } catch (error) {
      this.logger.error(`❌ Failed to log deletion: ${error.message}`);
    }

    // Delete from database (cascade will handle participants and mappings)
    await this.prisma.events.delete({
      where: { id: eventId },
    });

    this.logger.log(
      `Permanently deleted event: ${event.title} by user ${userId}`,
    );
    return { success: true, message: 'Event permanently deleted' };
  }

  /**
   * Send reminder to attendees
   */
  async sendReminder(eventId: string) {
    this.logger.log(
      `📬 [REMINDER] Starting sendReminder for eventId: ${eventId}`,
    );

    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            users: true,
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!event) {
      this.logger.error(`❌ [REMINDER] Event not found: ${eventId}`);
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    this.logger.log(`📧 [REMINDER] Event found: "${event.title}"`);
    this.logger.log(`📊 [REMINDER] Event details:`);
    this.logger.log(`   - ID: ${event.id}`);
    this.logger.log(`   - Title: ${event.title}`);
    this.logger.log(`   - Project ID: ${event.project_id}`);
    this.logger.log(`   - Project Name: ${event.projects?.name || 'N/A'}`);
    this.logger.log(`   - Start: ${event.start_at}`);
    this.logger.log(`   - Total participants: ${event.participants.length}`);

    // Get attendee user IDs (exclude null users - external participants)
    const attendeeIds = event.participants
      .filter((p) => p.user_id !== null)
      .map((p) => p.user_id!); // Use non-null assertion since we filtered nulls

    this.logger.log(
      `👥 [REMINDER] Filtered attendees (registered users only): ${attendeeIds.length}`,
    );
    this.logger.log(
      `📋 [REMINDER] Attendee IDs: ${JSON.stringify(attendeeIds)}`,
    );

    if (attendeeIds.length === 0) {
      this.logger.warn('⚠️ [REMINDER] No registered users to send reminder to');
      return { success: true, sent: 0 };
    }

    // Send EVENT_REMINDER notification to all attendees
    try {
      this.logger.log(
        `🚀 [REMINDER] Calling NotificationsService.sendEventReminder...`,
      );

      await this.notificationsService.sendEventReminder({
        eventId: event.id,
        eventTitle: event.title,
        eventStartAt: event.start_at,
        senderName: 'System', // Automated reminder from system
        message: `Sự kiện "${event.title}" sẽ diễn ra sớm`,
        recipientIds: attendeeIds,
        projectId: event.project_id, // ✅ Add projectId for deep link navigation
      });

      this.logger.log(
        `✅ [REMINDER] Event reminder sent successfully to ${attendeeIds.length} attendees`,
      );

      return { success: true, sent: attendeeIds.length };
    } catch (error) {
      this.logger.error(`❌ [REMINDER] Failed to send event reminder:`, error);
      this.logger.error(`❌ [REMINDER] Error details: ${error.message}`);
      this.logger.error(`❌ [REMINDER] Error stack: ${error.stack}`);
      throw error;
    }
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

  /**
   * Cancel an event (soft delete)
   */
  async cancelEvent(
    projectId: string,
    eventId: string,
    userId: string,
    dto: CancelEventDto,
  ) {
    // 1. Check if event exists
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: {
            users: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        projects: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.project_id !== projectId) {
      throw new ForbiddenException('Event does not belong to this project');
    }

    // Permission check: Only event creator or project admin/owner can cancel
    await this.checkEventPermission(event.project_id, userId, event.created_by);

    // 2. Check if already cancelled
    if (event.status === 'CANCELLED') {
      throw new BadRequestException('Event is already cancelled');
    }

    // 3. Update event status
    const updatedEvent = await this.prisma.events.update({
      where: { id: eventId },
      data: {
        status: 'CANCELLED',
        cancelled_at: new Date(),
        cancelled_by: userId,
        cancellation_reason: dto.reason,
        updated_at: new Date(),
      },
      include: {
        participants: {
          include: {
            users: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        projects: true,
      },
    });

    this.logger.log(`Event cancelled: ${event.title} by user ${userId}`);

    // 4. Create activity log
    try {
      await this.activityLogsService.logEventUpdated({
        workspaceId: event.projects?.workspace_id,
        projectId: projectId,
        eventId: eventId,
        userId: userId,
        eventTitle: event.title,
        oldValue: { status: 'ACTIVE' },
        newValue: {
          status: 'CANCELLED',
          reason: dto.reason,
        },
      });
      this.logger.log(`✅ Activity log created for event cancellation`);
    } catch (error) {
      this.logger.error(`❌ Failed to create activity log: ${error.message}`);
    }

    // 5. Send notifications to participants
    try {
      const canceller = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      const participantIds = event.participants
        .filter((p) => p.users !== null && p.users.id !== userId)
        .map((p) => p.users!.id);

      if (participantIds.length > 0) {
        await this.notificationsService.sendEventCancelled({
          eventId: eventId,
          eventTitle: event.title,
          reason: dto.reason,
          cancelledBy: userId,
          cancelledByName: canceller?.name || canceller?.email || 'Unknown',
          participantIds,
        });
        this.logger.log(
          `✅ Event cancelled notifications sent to ${participantIds.length} participants`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Failed to send notifications: ${error.message}`);
    }

    // 6. Delete from Google Calendar if synced
    try {
      const externalMapping = await this.prisma.external_event_map.findFirst({
        where: {
          event_id: eventId,
          provider: 'GOOGLE_CALENDAR',
        },
      });

      if (externalMapping) {
        await this.googleCalendarService.deleteProjectEventInGoogle(
          userId,
          externalMapping.provider_event_id,
        );
        this.logger.log(`✅ Deleted event from Google Calendar`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to delete from Google Calendar: ${error.message}`,
      );
    }

    return updatedEvent;
  }

  /**
   * Restore a cancelled event
   */
  async restoreEvent(projectId: string, eventId: string, userId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: {
        projects: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.project_id !== projectId) {
      throw new ForbiddenException('Event does not belong to this project');
    }

    if (event.status !== 'CANCELLED') {
      throw new BadRequestException('Event is not cancelled');
    }

    const restoredEvent = await this.prisma.events.update({
      where: { id: eventId },
      data: {
        status: 'ACTIVE',
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
        updated_at: new Date(),
      },
      include: {
        participants: {
          include: {
            users: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        projects: true,
      },
    });

    this.logger.log(`Event restored: ${event.title} by user ${userId}`);

    // Re-create in Google Calendar if needed
    try {
      const attendees = await this.prisma.users.findMany({
        where: {
          id: {
            in: restoredEvent.participants
              .filter((p) => p.user_id)
              .map((p) => p.user_id!),
          },
        },
        select: { email: true },
      });

      const result =
        await this.googleCalendarService.createProjectEventInGoogle(userId, {
          title: restoredEvent.title,
          description: restoredEvent.description || undefined,
          startAt: restoredEvent.start_at,
          endAt: restoredEvent.end_at,
          attendeeEmails: attendees.map((a) => a.email),
          createMeet: !!restoredEvent.meet_link,
        });

      // Store new external event mapping
      if (result.calendarEventId) {
        await this.prisma.external_event_map.create({
          data: {
            event_id: eventId,
            provider: 'GOOGLE_CALENDAR',
            provider_event_id: result.calendarEventId,
            last_synced_at: new Date(),
          },
        });
        this.logger.log(`✅ Re-created event in Google Calendar`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to re-create in Google Calendar: ${error.message}`,
      );
    }

    // Create activity log
    try {
      await this.activityLogsService.logEventUpdated({
        workspaceId: event.projects?.workspace_id,
        projectId: projectId,
        eventId: eventId,
        userId: userId,
        eventTitle: event.title,
        oldValue: { status: 'CANCELLED' },
        newValue: { status: 'ACTIVE' },
      });
    } catch (error) {
      this.logger.error(`❌ Failed to create activity log: ${error.message}`);
    }

    return restoredEvent;
  }

  /**
   * Hard delete an event (permanent)
   */
  async hardDeleteEvent(projectId: string, eventId: string, userId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.project_id !== projectId) {
      throw new ForbiddenException('Event does not belong to this project');
    }

    // Permission check: Only event creator or project admin/owner can hard delete
    await this.checkEventPermission(event.project_id, userId, event.created_by);

    // Delete from Google Calendar first
    try {
      const externalMapping = await this.prisma.external_event_map.findFirst({
        where: {
          event_id: eventId,
          provider: 'GOOGLE_CALENDAR',
        },
      });

      if (externalMapping) {
        await this.googleCalendarService.deleteProjectEventInGoogle(
          userId,
          externalMapping.provider_event_id,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to delete from Google Calendar: ${error.message}`,
      );
    }

    // Delete event from database
    await this.prisma.events.delete({
      where: { id: eventId },
    });

    this.logger.log(`Event permanently deleted: ${event.title}`);

    return { message: 'Event permanently deleted' };
  }

  /**
   * Helper: Check if user has permission to modify event
   * Logic:
   * - Event creator (created_by) can always edit/delete their own events
   * - Project OWNER and ADMIN can edit/delete any event
   * - Project MEMBER can only edit/delete events they created
   */
  private async checkEventPermission(
    projectId: string,
    userId: string,
    eventCreatorId: string | null,
  ) {
    // If user is the event creator, allow
    if (eventCreatorId === userId) {
      return true;
    }

    // Check user's project role
    const member = await this.prisma.project_members.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userId,
        },
      },
    });

    // If not a project member, deny
    if (!member) {
      throw new ForbiddenException(
        'You do not have permission to modify this event',
      );
    }

    // OWNER and ADMIN can modify any event
    if (member.role === 'OWNER' || member.role === 'ADMIN') {
      return true;
    }

    // MEMBER can only modify their own events (already checked above)
    throw new ForbiddenException(
      'Members can only edit/delete events they created',
    );
  }

  // ==================== EVENT REMINDERS ====================

  /**
   * Create event reminder(s)
   * Send reminder to specific users about an event
   */
  async createEventReminder(
    dto: CreateEventReminderDto,
    senderId: string,
  ): Promise<{ success: boolean; created: number }> {
    // Verify event exists
    const event = await this.prisma.events.findUnique({
      where: { id: dto.eventId },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check sender has permission to send reminders for this event
    await this.checkEventPermission(
      event.project_id,
      senderId,
      event.created_by,
    );

    // Create reminders for each recipient
    const reminders = await Promise.all(
      dto.recipientIds.map((recipientId) =>
        this.prisma.event_reminders.create({
          data: {
            event_id: dto.eventId,
            recipient_id: recipientId,
            sender_id: senderId,
            message: dto.message,
          },
        }),
      ),
    );

    this.logger.log(
      `Created ${reminders.length} event reminders for event ${dto.eventId}`,
    );

    // Send notifications to recipients
    try {
      const sender = await this.prisma.users.findUnique({
        where: { id: senderId },
        select: { name: true, email: true },
      });

      if (sender) {
        await this.notificationsService.sendEventReminder({
          eventId: dto.eventId,
          eventTitle: event.title,
          eventStartAt: event.start_at,
          senderName: sender.name || sender.email,
          message: dto.message,
          recipientIds: dto.recipientIds,
        });
      }
    } catch (error) {
      this.logger.error('Failed to send event reminder notifications:', error);
    }

    return {
      success: true,
      created: reminders.length,
    };
  }

  /**
   * Get event reminders for current user
   */
  async getUserEventReminders(
    userId: string,
  ): Promise<EventReminderResponseDto[]> {
    const reminders = await this.prisma.event_reminders.findMany({
      where: {
        recipient_id: userId,
        dismissed_at: null,
      },
      include: {
        events: {
          include: {
            projects: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sender: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return reminders.map((reminder) => ({
      id: reminder.id,
      eventId: reminder.event_id,
      eventTitle: reminder.events.title,
      eventDate: reminder.events.start_at.toISOString().split('T')[0],
      eventTime: reminder.events.start_at.toTimeString().slice(0, 5),
      projectId: reminder.events.project_id,
      projectName: reminder.events.projects?.name || 'Unknown Project',
      senderName: reminder.sender.name || reminder.sender.email,
      message: reminder.message,
      timestamp: reminder.created_at.getTime(),
      isRead: reminder.is_read,
    }));
  }

  /**
   * Mark reminder as read
   */
  async markReminderAsRead(reminderId: string, userId: string): Promise<void> {
    const reminder = await this.prisma.event_reminders.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    if (reminder.recipient_id !== userId) {
      throw new ForbiddenException('Not authorized to modify this reminder');
    }

    await this.prisma.event_reminders.update({
      where: { id: reminderId },
      data: { is_read: true },
    });
  }

  /**
   * Dismiss event reminder
   */
  async dismissEventReminder(
    reminderId: string,
    userId: string,
  ): Promise<void> {
    const reminder = await this.prisma.event_reminders.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    if (reminder.recipient_id !== userId) {
      throw new ForbiddenException('Not authorized to dismiss this reminder');
    }

    await this.prisma.event_reminders.update({
      where: { id: reminderId },
      data: {
        dismissed_at: new Date(),
      },
    });

    this.logger.log(`User ${userId} dismissed reminder ${reminderId}`);
  }
}
