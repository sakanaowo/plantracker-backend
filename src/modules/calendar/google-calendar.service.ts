import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

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
            dateTime: event.start_at.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: event.end_at.toISOString(),
            timeZone: 'UTC',
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
}
