import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import {
  SuggestMeetingTimeDto,
  MeetingTimeSuggestion,
  TimeSlot,
} from './dto/suggest-meeting-time.dto';

interface BusyPeriod {
  start: string;
  end: string;
}

interface FreeBusyData {
  busy: BusyPeriod[];
  available: boolean;
}

@Injectable()
export class MeetingSchedulerService {
  private readonly logger = new Logger(MeetingSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private googleCalendarService: GoogleCalendarService,
  ) {}

  /**
   * Suggest meeting times based on Google Calendar Free/Busy API
   * Finds time slots where maximum number of participants are available
   */
  async suggestMeetingTimes(
    dto: SuggestMeetingTimeDto,
  ): Promise<MeetingTimeSuggestion> {
    const {
      userIds,
      startDate,
      endDate,
      durationMinutes = 60,
      maxSuggestions = 5,
    } = dto;

    this.logger.log(
      `Suggesting meeting times for ${userIds.length} users from ${startDate} to ${endDate}`,
    );

    // Get free/busy info for all users
    const freeBusyData = await this.getFreeBusyForUsers(
      userIds,
      startDate,
      endDate,
    );

    // Find common free time slots
    const suggestions = this.findCommonFreeSlots(
      freeBusyData,
      userIds,
      durationMinutes,
      maxSuggestions,
    );

    return {
      suggestions,
      totalUsersChecked: userIds.length,
      checkedRange: {
        start: startDate,
        end: endDate,
      },
    };
  }

  /**
   * Get Free/Busy information from Google Calendar for multiple users
   */
  private async getFreeBusyForUsers(
    userIds: string[],
    timeMin: string,
    timeMax: string,
  ): Promise<Map<string, FreeBusyData>> {
    const freeBusyMap = new Map<string, FreeBusyData>();

    for (const userId of userIds) {
      try {
        // Get user's Google Calendar token
        const token = await this.prisma.integration_tokens.findFirst({
          where: {
            user_id: userId,
            provider: 'GOOGLE_CALENDAR',
            status: 'ACTIVE',
          },
        });

        if (!token) {
          this.logger.warn(
            `User ${userId} has no active Google Calendar integration`,
          );
          freeBusyMap.set(userId, { busy: [], available: true });
          continue;
        }

        // Create OAuth2 client with user's token
        const oauth2Client = this.googleCalendarService['createOAuth2Client']();
        oauth2Client.setCredentials({
          access_token: token.access_token,
          refresh_token: token.refresh_token,
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Call Google Calendar Free/Busy API
        const response = await calendar.freebusy.query({
          requestBody: {
            timeMin,
            timeMax,
            items: [{ id: 'primary' }],
          },
        });

        const busySlots = response.data.calendars?.primary?.busy || [];
        const busyPeriods: BusyPeriod[] = busySlots.map((slot) => ({
          start: slot.start as string,
          end: slot.end as string,
        }));

        freeBusyMap.set(userId, { busy: busyPeriods, available: true });

        this.logger.debug(
          `User ${userId} has ${busyPeriods.length} busy slots`,
        );
      } catch (error) {
        this.logger.error(`Failed to get free/busy for user ${userId}:`, error);
        freeBusyMap.set(userId, { busy: [], available: false });
      }
    }

    return freeBusyMap;
  }

  /**
   * Find common free time slots across all users
   * Returns slots sorted by score (number of available users)
   */
  private findCommonFreeSlots(
    freeBusyData: Map<string, FreeBusyData>,
    userIds: string[],
    durationMinutes: number,
    maxSuggestions: number,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];

    // Define working hours (9 AM - 6 PM)
    const workingHoursStart = 9;
    const workingHoursEnd = 18;

    // Generate potential time slots (every 30 minutes during working hours)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7); // Next 7 days

    for (
      let date = new Date(now);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      for (let hour = workingHoursStart; hour < workingHoursEnd; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotStart = new Date(date);
          slotStart.setHours(hour, minute, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

          // Check if slot is in the past
          if (slotStart < now) continue;

          // Check if slot extends beyond working hours
          if (slotEnd.getHours() >= workingHoursEnd) continue;

          // Check availability for all users
          const availableUsers: string[] = [];

          for (const userId of userIds) {
            const userData = freeBusyData.get(userId);
            if (!userData || !userData.available) continue;

            const isFree = !this.isTimeSlotBusy(
              slotStart,
              slotEnd,
              userData.busy,
            );

            if (isFree) {
              availableUsers.push(userId);
            }
          }

          // Calculate score (percentage of users available)
          const score = Math.round(
            (availableUsers.length / userIds.length) * 100,
          );

          // Only include slots where at least 50% of users are available
          if (score >= 50) {
            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              availableUsers,
              score,
            });
          }
        }
      }
    }

    // Sort by score (highest first), then by date (earliest first)
    slots.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    return slots.slice(0, maxSuggestions);
  }

  /**
   * Check if a time slot conflicts with busy periods
   */
  private isTimeSlotBusy(
    slotStart: Date,
    slotEnd: Date,
    busyPeriods: BusyPeriod[],
  ): boolean {
    for (const busy of busyPeriods) {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);

      // Check for overlap
      if (slotStart < busyEnd && slotEnd > busyStart) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create a meeting event with Google Meet link for all available participants
   */
  async createMeetingEvent(
    organizerId: string,
    attendeeIds: string[],
    timeSlot: TimeSlot,
    summary: string,
    description?: string,
  ) {
    const calendar =
      await this.googleCalendarService['getCalendarClient'](organizerId);

    if (!calendar) {
      throw new Error('Organizer has no Google Calendar integration');
    }

    // Get attendee emails
    const attendees = await this.prisma.users.findMany({
      where: { id: { in: attendeeIds } },
      select: { email: true },
    });

    const event = {
      summary,
      description,
      start: {
        dateTime: timeSlot.start,
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: timeSlot.end,
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      attendees: attendees.map((a) => ({ email: a.email })),
      conferenceData: {
        createRequest: {
          requestId: `meeting-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 min before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all', // Send email invites to all attendees
    });

    this.logger.log(
      `Created meeting event: ${response.data.id} with Meet link: ${response.data.hangoutLink}`,
    );

    return {
      eventId: response.data.id,
      meetLink: response.data.hangoutLink,
      htmlLink: response.data.htmlLink,
    };
  }
}
