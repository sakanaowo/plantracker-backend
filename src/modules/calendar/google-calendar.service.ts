import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Format datetime for Google Calendar API
   * Google Calendar requires local datetime WITHOUT timezone suffix (no Z)
   * when using the timeZone field. If dateTime has Z, timeZone is ignored.
   *
   * IMPORTANT: Convert UTC to Vietnam timezone (GMT+7) before formatting!
   * Android sends: "2024-12-04T16:00:00Z" (UTC 16h = VN 23h)
   * Backend receives: new Date("2024-12-04T16:00:00Z") = UTC 16h
   * Must convert to VN: UTC 16h + 7h = VN 23h
   * Then format: "2024-12-04T23:00:00" + timeZone: "Asia/Ho_Chi_Minh" = VN 23h ✅
   */
  private formatLocalDateTime(date: Date): string {
    // Convert UTC to Vietnam timezone (GMT+7)
    const vnTime = new Date(
      date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
    );

    const year = vnTime.getFullYear();
    const month = String(vnTime.getMonth() + 1).padStart(2, '0');
    const day = String(vnTime.getDate()).padStart(2, '0');
    const hours = String(vnTime.getHours()).padStart(2, '0');
    const minutes = String(vnTime.getMinutes()).padStart(2, '0');
    const seconds = String(vnTime.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  async getAuthUrl(userId: string): Promise<string> {
    const oauth2Client = this.createOAuth2Client();

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId,
    });
  }

  async handleOAuthCallback(code: string, userId: string) {
    const oauth2Client = this.createOAuth2Client();

    try {
      const { tokens } = await oauth2Client.getToken(code);

      const existingToken = await this.prisma.integration_tokens.findFirst({
        where: {
          user_id: userId,
          provider: 'GOOGLE_CALENDAR',
        },
      });

      if (existingToken) {
        await this.prisma.integration_tokens.update({
          where: { id: existingToken.id },
          data: {
            access_token: tokens.access_token!,
            refresh_token: tokens.refresh_token || existingToken.refresh_token,
            expires_at: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : null,
            status: 'ACTIVE',
            updated_at: new Date(),
          },
        });
      } else {
        await this.prisma.integration_tokens.create({
          data: {
            user_id: userId,
            provider: 'GOOGLE_CALENDAR',
            access_token: tokens.access_token!,
            refresh_token: tokens.refresh_token || '',
            expires_at: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : null,
            status: 'ACTIVE',
          },
        });
      }

      return { success: true };
    } catch (error) {
      this.logger.error('OAuth callback error:', error);
      throw new Error('Failed to process OAuth callback');
    }
  }

  async syncUserEvents(userId: string, projectId: string) {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return;
    }

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      this.logger.log(
        `Found ${events.length} events to sync for user ${userId}`,
      );

      for (const googleEvent of events) {
        await this.syncEventFromGoogle(googleEvent, userId, projectId);
      }
    } catch (error) {
      this.logger.error('Error syncing events:', error);
    }
  }

  async createEventInGoogle(eventId: string, userId: string) {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return;
    }

    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });

    if (!event) {
      this.logger.error(`Event not found: ${eventId}`);
      return;
    }

    try {
      const googleEvent = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.title,
          start: {
            dateTime: this.formatLocalDateTime(event.start_at),
            timeZone: 'Asia/Ho_Chi_Minh',
          },
          end: {
            dateTime: this.formatLocalDateTime(event.end_at),
            timeZone: 'Asia/Ho_Chi_Minh',
          },
          location: event.location || undefined,
          description: 'Created from PlanTracker',
          attendees: event.participants.map((p) => ({ email: p.email })),
        },
      });

      await this.prisma.external_event_map.create({
        data: {
          event_id: eventId,
          provider: 'GOOGLE_CALENDAR',
          provider_event_id: googleEvent.data.id!,
          html_link: googleEvent.data.htmlLink || null,
          etag: googleEvent.data.etag || null,
          last_synced_at: new Date(),
        },
      });

      this.logger.log(`Created Google Calendar event: ${googleEvent.data.id}`);
    } catch (error) {
      this.logger.error('Error creating Google event:', error);
    }
  }

  async getIntegrationStatus(userId: string) {
    const integration = await this.prisma.integration_tokens.findFirst({
      where: {
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
      },
    });

    return {
      isConnected: !!integration,
      accountEmail: integration?.account_email || null,
      lastSyncAt: integration?.updated_at || null,
    };
  }

  async disconnectIntegration(userId: string) {
    await this.prisma.integration_tokens.updateMany({
      where: {
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
      },
      data: {
        status: 'REVOKED',
        updated_at: new Date(),
      },
    });

    this.logger.log(`Disconnected Google Calendar for user ${userId}`);
    return { success: true };
  }

  private createOAuth2Client() {
    return new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );
  }

  private async getCalendarClient(userId: string) {
    const tokens = await this.prisma.integration_tokens.findFirst({
      where: {
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
      },
    });

    if (!tokens) return null;

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    oauth2Client.on('tokens', (newTokens) => {
      this.prisma.integration_tokens
        .update({
          where: { id: tokens.id },
          data: {
            access_token: newTokens.access_token || tokens.access_token,
            expires_at: newTokens.expiry_date
              ? new Date(newTokens.expiry_date)
              : tokens.expires_at,
          },
        })
        .catch((error) => {
          this.logger.error('Failed to update refreshed tokens:', error);
        });
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  private async syncEventFromGoogle(
    googleEvent: any,
    userId: string,
    projectId: string,
  ) {
    if (!googleEvent.id) return;

    const existingMapping = await this.prisma.external_event_map.findFirst({
      where: {
        provider: 'GOOGLE_CALENDAR',
        provider_event_id: googleEvent.id,
      },
    });

    if (existingMapping) {
      await this.updateEventFromGoogle(existingMapping.event_id, googleEvent);
    } else {
      await this.createEventFromGoogle(googleEvent, userId, projectId);
    }
  }

  private async createEventFromGoogle(
    googleEvent: any,
    userId: string,
    projectId: string,
  ) {
    if (!googleEvent.start?.dateTime || !googleEvent.end?.dateTime) return;

    try {
      const event = await this.prisma.events.create({
        data: {
          project_id: projectId,
          title: googleEvent.summary || 'Untitled Event',
          start_at: new Date(googleEvent.start.dateTime),
          end_at: new Date(googleEvent.end.dateTime),
          location: googleEvent.location || null,
          created_by: userId,
        },
      });

      await this.prisma.external_event_map.create({
        data: {
          event_id: event.id,
          provider: 'GOOGLE_CALENDAR',
          provider_event_id: googleEvent.id,
          html_link: googleEvent.htmlLink || null,
          etag: googleEvent.etag || null,
          last_synced_at: new Date(),
        },
      });

      if (googleEvent.attendees && Array.isArray(googleEvent.attendees)) {
        for (const attendee of googleEvent.attendees) {
          if (attendee.email) {
            await this.prisma.participants.create({
              data: {
                event_id: event.id,
                email: attendee.email,
                status: this.mapGoogleStatusToOurs(attendee.responseStatus),
              },
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error creating event from Google:', error);
    }
  }

  private async updateEventFromGoogle(eventId: string, googleEvent: any) {
    try {
      await this.prisma.events.update({
        where: { id: eventId },
        data: {
          title: googleEvent.summary || 'Untitled Event',
          start_at: new Date(googleEvent.start.dateTime),
          end_at: new Date(googleEvent.end.dateTime),
          location: googleEvent.location || null,
          updated_at: new Date(),
        },
      });

      await this.prisma.external_event_map.updateMany({
        where: {
          event_id: eventId,
          provider: 'GOOGLE_CALENDAR',
        },
        data: {
          etag: googleEvent.etag || null,
          last_synced_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error updating event from Google:', error);
    }
  }

  private mapGoogleStatusToOurs(googleStatus?: string) {
    switch (googleStatus) {
      case 'accepted':
        return 'ACCEPTED';
      case 'declined':
        return 'DECLINED';
      case 'tentative':
        return 'TENTATIVE';
      default:
        return 'INVITED';
    }
  }

  /**
   * Create task reminder event in Google Calendar
   */
  async createTaskReminderEvent(
    userId: string,
    taskId: string,
    title: string,
    dueDate: Date,
    reminderMinutes: number,
  ): Promise<string | null> {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return null;
    }

    try {
      const reminderTime = new Date(
        dueDate.getTime() - reminderMinutes * 60000,
      );
      const reminderEndTime = new Date(reminderTime.getTime() + 15 * 60000);

      const googleEvent: calendar_v3.Schema$Event = (
        await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: `⏰ Nhắc nhở: ${title}`,
            description: `Đây là nhắc nhở cho task: ${title}\n\nTask ID: ${taskId}`,
            start: {
              dateTime: this.formatLocalDateTime(reminderTime),
              timeZone: 'Asia/Ho_Chi_Minh',
            },
            end: {
              dateTime: this.formatLocalDateTime(reminderEndTime),
              timeZone: 'Asia/Ho_Chi_Minh',
            },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'popup', minutes: 10 },
                { method: 'email', minutes: 30 },
              ],
            },
            colorId: '11', // Red color for reminders
          },
        })
      ).data;

      this.logger.log(`Created task reminder event: ${googleEvent.id}`);
      return googleEvent.id || null;
    } catch (error) {
      this.logger.error(`Failed to create task reminder: ${error.message}`);
      return null;
    }
  }

  /**
   * Update task reminder event
   */
  async updateTaskReminderEvent(
    userId: string,
    calendarEventId: string,
    title: string,
    dueDate: Date,
    reminderMinutes: number,
  ): Promise<boolean> {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return false;
    }

    try {
      const reminderTime = new Date(
        dueDate.getTime() - reminderMinutes * 60000,
      );
      const reminderEndTime = new Date(reminderTime.getTime() + 15 * 60000);

      await calendar.events.patch({
        calendarId: 'primary',
        eventId: calendarEventId,
        requestBody: {
          summary: `⏰ Nhắc nhở: ${title}`,
          start: {
            dateTime: this.formatLocalDateTime(reminderTime),
            timeZone: 'Asia/Ho_Chi_Minh',
          },
          end: {
            dateTime: this.formatLocalDateTime(reminderEndTime),
            timeZone: 'Asia/Ho_Chi_Minh',
          },
        },
      });

      this.logger.log(`Updated task reminder event: ${calendarEventId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update task reminder: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete task reminder event
   */
  async deleteTaskReminderEvent(
    userId: string,
    calendarEventId: string,
  ): Promise<boolean> {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return false;
    }

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: calendarEventId,
      });

      this.logger.log(`Deleted task reminder event: ${calendarEventId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete task reminder: ${error.message}`);
      return false;
    }
  }

  /**
   * Create project event with optional Google Meet link
   */
  async createProjectEventInGoogle(
    userId: string,
    eventData: {
      title: string;
      description?: string;
      startAt: Date;
      endAt: Date;
      attendeeEmails: string[];
      createMeet: boolean;
    },
  ): Promise<{ calendarEventId: string | null; meetLink: string | null }> {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return { calendarEventId: null, meetLink: null };
    }

    try {
      const requestBody: any = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: this.formatLocalDateTime(eventData.startAt),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        end: {
          dateTime: this.formatLocalDateTime(eventData.endAt),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        attendees: eventData.attendeeEmails.map((email) => ({
          email,
          responseStatus: 'needsAction', // Mark as pending invitation
        })),
        // ✅ Use default reminders from user's calendar settings
        // This ensures notifications work according to each user's preferences
        reminders: {
          useDefault: true, // ✅ Use user's default notification settings
        },
        guestsCanModify: false,
        guestsCanInviteOthers: false,
        guestsCanSeeOtherGuests: true,
      };

      // Add conference data for Google Meet
      if (eventData.createMeet) {
        requestBody.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const googleEvent = await calendar.events.insert({
        calendarId: 'primary',
        requestBody,
        conferenceDataVersion: eventData.createMeet ? 1 : 0,
        sendUpdates: 'all', // ✅ Send email to ALL attendees
        sendNotifications: true, // ✅ Legacy parameter - still needed for email delivery
      });

      const meetLink = googleEvent.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video',
      )?.uri;

      this.logger.log(
        `Created project event: ${googleEvent.data.id} ${meetLink ? 'with Google Meet' : ''}`,
      );

      return {
        calendarEventId: googleEvent.data.id || null,
        meetLink: meetLink || null,
      };
    } catch (error) {
      this.logger.warn(`Failed to create project event: ${error.message}`);
      return { calendarEventId: null, meetLink: null };
    }
  }

  /**
   * Update project event in Google Calendar
   */
  async updateProjectEventInGoogle(
    userId: string,
    calendarEventId: string,
    eventData: {
      title?: string;
      description?: string;
      startAt?: Date;
      endAt?: Date;
      attendeeEmails?: string[];
    },
  ): Promise<boolean> {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return false;
    }

    try {
      // Get existing event first
      const existing = await calendar.events.get({
        calendarId: 'primary',
        eventId: calendarEventId,
      });

      const updates: any = {
        summary: eventData.title || existing.data.summary,
        description: eventData.description || existing.data.description,
      };

      if (eventData.startAt && eventData.endAt) {
        updates.start = {
          dateTime: this.formatLocalDateTime(eventData.startAt),
          timeZone: 'Asia/Ho_Chi_Minh',
        };
        updates.end = {
          dateTime: this.formatLocalDateTime(eventData.endAt),
          timeZone: 'Asia/Ho_Chi_Minh',
        };
      }

      if (eventData.attendeeEmails) {
        updates.attendees = eventData.attendeeEmails.map((email) => ({
          email,
          responseStatus: 'needsAction', // Mark as pending invitation
        }));
      }

      await calendar.events.patch({
        calendarId: 'primary',
        eventId: calendarEventId,
        requestBody: updates,
        sendUpdates: 'all', // ✅ Send email to ALL attendees
        sendNotifications: true, // ✅ Legacy parameter for email delivery
      });

      this.logger.log(`Updated project event: ${calendarEventId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update project event: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete project event from Google Calendar
   */
  async deleteProjectEventInGoogle(
    userId: string,
    calendarEventId: string,
  ): Promise<boolean> {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return false;
    }

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: calendarEventId,
        sendUpdates: 'all', // Notify all attendees
      });

      this.logger.log(`Deleted project event: ${calendarEventId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete project event: ${error.message}`);
      return false;
    }
  }

  /**
   * Sync events from Google Calendar to project database
   * Fetches events from Google Calendar and saves/updates them in the database
   */
  async syncEventsFromGoogle(
    userId: string,
    projectId: string,
    timeMin: string,
    timeMax: string,
  ) {
    this.logger.log(
      `📅 Syncing events for project ${projectId} from ${timeMin} to ${timeMax}`,
    );

    // 0. Validate project exists and user has access
    const project = await this.prisma.projects.findFirst({
      where: {
        id: projectId,
        OR: [
          // User is workspace owner
          {
            workspaces: {
              owner_id: userId,
            },
          },
          // User is project member
          {
            project_members: {
              some: {
                user_id: userId,
              },
            },
          },
        ],
      },
    });

    if (!project) {
      this.logger.error(
        `❌ Project ${projectId} not found or user ${userId} has no access`,
      );
      throw new NotFoundException(
        'Project not found or you do not have access to this project',
      );
    }

    // 1. Get integration token
    const integration = await this.prisma.integration_tokens.findFirst({
      where: {
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
      },
    });

    if (!integration) {
      this.logger.error(
        `❌ No Google Calendar integration found for user ${userId}`,
      );
      throw new BadRequestException(
        'Google Calendar not connected. Please connect your Google Calendar first.',
      );
    }

    this.logger.log(
      `✅ Found integration, access_token: ${integration.access_token?.substring(0, 10)}...`,
    );

    // 2. Setup OAuth client
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    });

    try {
      // 3. Fetch from Google Calendar
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      this.logger.log('📡 Fetching events from Google Calendar API...');

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const googleEvents = response.data.items || [];
      this.logger.log(`📥 Received ${googleEvents.length} events from Google`);

      // 4. Sync to database
      const syncedEvents: any[] = [];
      for (const googleEvent of googleEvents) {
        if (!googleEvent.id || !googleEvent.start || !googleEvent.end) {
          this.logger.warn(
            `⚠️ Skipping event without required fields: ${googleEvent.id}`,
          );
          continue;
        }

        const startTime = googleEvent.start.dateTime || googleEvent.start.date;
        const endTime = googleEvent.end.dateTime || googleEvent.end.date;

        if (!startTime || !endTime) {
          this.logger.warn(
            `⚠️ Skipping event ${googleEvent.id} - missing time`,
          );
          continue;
        }

        try {
          // Check if event already exists FOR THIS USER
          const existingMapping =
            await this.prisma.external_event_map.findFirst({
              where: {
                provider: 'GOOGLE_CALENDAR',
                provider_event_id: googleEvent.id,
                events: {
                  created_by: userId, // ← Chỉ check event của user này
                },
              },
              include: {
                events: true,
              },
            });

          let event;
          if (existingMapping) {
            // Update existing event
            this.logger.log(
              `🔄 Updating existing event: ${googleEvent.summary}`,
            );
            event = await this.prisma.events.update({
              where: { id: existingMapping.event_id },
              data: {
                title: googleEvent.summary || 'Untitled Event',
                start_at: new Date(startTime),
                end_at: new Date(endTime),
                location: googleEvent.location || null,
                updated_at: new Date(),
              },
            });
          } else {
            // Create new event
            this.logger.log(`➕ Creating new event: ${googleEvent.summary}`);
            event = await this.prisma.events.create({
              data: {
                project_id: projectId,
                title: googleEvent.summary || 'Untitled Event',
                start_at: new Date(startTime),
                end_at: new Date(endTime),
                location: googleEvent.location || null,
                created_by: userId,
              },
            });

            // Create mapping
            await this.prisma.external_event_map.create({
              data: {
                event_id: event.id,
                provider: 'GOOGLE_CALENDAR',
                provider_event_id: googleEvent.id,
                html_link: googleEvent.htmlLink || null,
                etag: googleEvent.etag || null,
                last_synced_at: new Date(),
              },
            });
          }

          syncedEvents.push(event);
        } catch (error) {
          this.logger.error(
            `❌ Error syncing event ${googleEvent.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `✅ Successfully synced ${syncedEvents.length} events to database`,
      );
      return syncedEvents;
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync events: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get calendar events for date range (for Calendar Tab)
   */
  async getCalendarEventsForDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) {
      this.logger.warn(`No calendar client for user ${userId}`);
      return [];
    }

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      });

      return response.data.items || [];
    } catch (error) {
      this.logger.error(`Failed to get calendar events: ${error.message}`);
      return [];
    }
  }
}
