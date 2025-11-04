import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';
import * as admin from 'firebase-admin';
import { provider } from '@prisma/client';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calendar: any;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.initializeCalendarService();
  }

  private initializeCalendarService() {
    try {
      // Use Firebase Admin SDK credentials for Google Calendar API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const auth = admin.app().options.credential as any;

      this.calendar = google.calendar({
        version: 'v3',
        auth,
      });

      this.logger.log(
        'Google Calendar service initialized with Firebase credentials',
      );
    } catch (error) {
      this.logger.error('Failed to initialize Google Calendar service:', error);
    }
  }

  /**
   * Create event in Google Calendar using service account
   */
  async createEvent(eventData: {
    title: string;
    description?: string;
    startAt: Date;
    endAt: Date;
    location?: string;
    attendees?: string[];
    meetLink?: string;
  }) {
    try {
      const event = {
        summary: eventData.title,
        description: eventData.description || '',
        start: {
          dateTime: eventData.startAt.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.endAt.toISOString(),
          timeZone: 'UTC',
        },
        location: eventData.location || '',
        attendees: eventData.attendees?.map((email) => ({ email })) || [],
        conferenceData: eventData.meetLink
          ? {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            }
          : undefined,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: eventData.meetLink ? 1 : 0,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.log(`Created Google Calendar event: ${response.data.id}`);
      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        googleEventId: response.data.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        htmlLink: response.data.htmlLink,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        meetLink: response.data.hangoutLink,
      };
    } catch (error) {
      this.logger.error('Failed to create Google Calendar event:', error);
      throw error;
    }
  }

  /**
   * Update event in Google Calendar
   */
  async updateEvent(
    googleEventId: string,
    eventData: {
      title?: string;
      description?: string;
      startAt?: Date;
      endAt?: Date;
      location?: string;
      attendees?: string[];
    },
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event: any = {};

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (eventData.title) event.summary = eventData.title;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (eventData.description !== undefined)
        event.description = eventData.description;
      if (eventData.startAt) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        event.start = {
          dateTime: eventData.startAt.toISOString(),
          timeZone: 'UTC',
        };
      }
      if (eventData.endAt) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        event.end = {
          dateTime: eventData.endAt.toISOString(),
          timeZone: 'UTC',
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (eventData.location !== undefined) event.location = eventData.location;
      if (eventData.attendees) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        event.attendees = eventData.attendees.map((email) => ({ email }));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const response = await this.calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        resource: event,
      });

      this.logger.log(`Updated Google Calendar event: ${googleEventId}`);
      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        googleEventId: response.data.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        htmlLink: response.data.htmlLink,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update Google Calendar event ${googleEventId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete event from Google Calendar
   */
  async deleteEvent(googleEventId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      });

      this.logger.log(`Deleted Google Calendar event: ${googleEventId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to delete Google Calendar event ${googleEventId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get events from Google Calendar
   */
  async getEvents(options?: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
  }) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: options?.timeMin?.toISOString(),
        timeMax: options?.timeMax?.toISOString(),
        maxResults: options?.maxResults || 100,
        singleEvents: true,
        orderBy: 'startTime',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
      return response.data.items || [];
    } catch (error) {
      this.logger.error('Failed to get Google Calendar events:', error);
      throw error;
    }
  }

  /**
   * Sync PlanTracker event to Google Calendar
   */
  async syncEventToGoogle(eventId: string) {
    try {
      // Get event from database
      const event = await this.prisma.events.findUnique({
        where: { id: eventId },
        include: {
          participants: true,
          projects: true,
        },
      });

      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      // Check if already synced
      const existingMapping = await this.prisma.external_event_map.findFirst({
        where: {
          event_id: eventId,
          provider: provider.GOOGLE_CALENDAR,
        },
      });

      const attendees = event.participants?.map((p) => p.email) || [];

      if (existingMapping) {
        // Update existing Google Calendar event
        const result = await this.updateEvent(
          existingMapping.provider_event_id,
          {
            title: event.title,
            startAt: event.start_at,
            endAt: event.end_at,
            location: event.location || undefined,
            attendees,
          },
        );

        this.logger.log(
          `Updated synced event ${eventId} -> ${existingMapping.provider_event_id}`,
        );
        return result;
      } else {
        // Create new Google Calendar event
        const result = await this.createEvent({
          title: event.title,
          description: `Event from PlanTracker project: ${
            event.projects?.name || 'Unknown'
          }`,
          startAt: event.start_at,
          endAt: event.end_at,
          location: event.location || undefined,
          attendees,
          meetLink: event.meet_link || undefined,
        });

        // Store mapping
        await this.prisma.external_event_map.create({
          data: {
            event_id: eventId,
            provider: provider.GOOGLE_CALENDAR,
            provider_event_id: result.googleEventId,
            html_link: result.htmlLink,
            last_synced_at: new Date(),
          },
        });

        this.logger.log(
          `Created and mapped event ${eventId} -> ${result.googleEventId}`,
        );
        return result;
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync event ${eventId} to Google Calendar:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove event sync from Google Calendar
   */
  async unsyncEventFromGoogle(eventId: string) {
    try {
      const mapping = await this.prisma.external_event_map.findFirst({
        where: {
          event_id: eventId,
          provider: provider.GOOGLE_CALENDAR,
        },
      });

      if (mapping) {
        // Delete from Google Calendar
        await this.deleteEvent(mapping.provider_event_id);

        // Remove mapping
        await this.prisma.external_event_map.delete({
          where: { id: mapping.id },
        });

        this.logger.log(`Unsynced event ${eventId} from Google Calendar`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to unsync event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get sync status for an event
   */
  async getEventSyncStatus(eventId: string) {
    const mapping = await this.prisma.external_event_map.findFirst({
      where: {
        event_id: eventId,
        provider: provider.GOOGLE_CALENDAR,
      },
    });

    return {
      synced: Boolean(mapping),
      syncStatus: mapping ? 'SYNCED' : 'NOT_SYNCED',
      googleEventId: mapping?.provider_event_id,
      lastSyncedAt: mapping?.last_synced_at || undefined,
    };
  }

  /**
   * Bulk sync events to Google Calendar
   */
  async bulkSyncEvents(eventIds: string[]) {
    const results: Array<{
      eventId: string;
      success: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result?: any;
      error?: string;
    }> = [];

    for (const eventId of eventIds) {
      try {
        const result = await this.syncEventToGoogle(eventId);
        results.push({ eventId, success: true, result });
      } catch (error: unknown) {
        results.push({
          eventId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk sync completed: ${
        results.filter((r) => r.success).length
      }/${results.length} successful`,
    );
    return results;
  }

  /**
   * Check if Google Calendar service is available
   */
  async checkServiceStatus() {
    try {
      // Try to list calendars to check if service is working
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const response = await this.calendar.calendarList.list({
        maxResults: 1,
      });

      return {
        available: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        calendarsCount: response.data.items?.length || 0,
      };
    } catch (error: unknown) {
      this.logger.error('Google Calendar service check failed:', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
