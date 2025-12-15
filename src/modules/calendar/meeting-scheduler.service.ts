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
      workingHoursStart = 9,
      workingHoursEnd = 17,
    } = dto;

    this.logger.log(
      `Suggesting meeting times for ${userIds.length} users from ${startDate} to ${endDate} (${workingHoursStart}h-${workingHoursEnd}h)`,
    );

    // Parse dates
    const searchStartDate = new Date(startDate);
    const searchEndDate = new Date(endDate);

    // Get free/busy info for all users
    const freeBusyData = await this.getFreeBusyForUsers(
      userIds,
      startDate,
      endDate,
    );

    // Count successful users (those with available=true, meaning token refresh worked)
    const successfulUsers = Array.from(freeBusyData.values()).filter(
      (data) => data.available,
    ).length;

    this.logger.log(
      `Successfully checked ${successfulUsers}/${userIds.length} users`,
    );

    // Find common free time slots
    const suggestions = this.findCommonFreeSlots(
      freeBusyData,
      userIds,
      durationMinutes,
      maxSuggestions,
      searchStartDate,
      searchEndDate,
      workingHoursStart,
      workingHoursEnd,
    );

    return {
      suggestions,
      totalUsersChecked: userIds.length,
      successfulUsersChecked: successfulUsers,
      checkedRange: {
        start: startDate,
        end: endDate,
      },
    };
  }

  /**
   * Get Free/Busy information from Google Calendar for multiple users
   * ⚠️ IMPORTANT: This method refreshes tokens before querying to avoid stale token issues
   */
  private async getFreeBusyForUsers(
    userIds: string[],
    timeMin: string,
    timeMax: string,
  ): Promise<Map<string, FreeBusyData>> {
    const freeBusyMap = new Map<string, FreeBusyData>();

    for (const userId of userIds) {
      try {
        // ✅ CRITICAL FIX: Refresh token before querying to ensure it's valid
        // This prevents users with expired tokens from being marked as "unavailable"
        this.logger.debug(
          `Refreshing token for user ${userId} before FreeBusy query...`,
        );
        const refreshSuccess =
          await this.googleCalendarService.refreshAccessToken(userId);

        if (!refreshSuccess) {
          this.logger.warn(
            `Failed to refresh token for user ${userId}, marking as unavailable`,
          );
          freeBusyMap.set(userId, { busy: [], available: false });
          continue;
        }

        // Get user's Google Calendar token (should be ACTIVE after refresh)
        const token = await this.prisma.integration_tokens.findFirst({
          where: {
            user_id: userId,
            provider: 'GOOGLE_CALENDAR',
            status: 'ACTIVE',
          },
        });

        if (!token) {
          this.logger.warn(
            `User ${userId} has no active Google Calendar integration after refresh`,
          );
          freeBusyMap.set(userId, { busy: [], available: false });
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
    startDate?: Date,
    endDate?: Date,
    workingHoursStart: number = 9,
    workingHoursEnd: number = 17,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];

    // Use provided date range or default to next 7 days
    const searchStartDate = startDate ? new Date(startDate) : new Date();
    const searchEndDate = endDate
      ? new Date(endDate)
      : (() => {
          const defaultEnd = new Date();
          defaultEnd.setDate(defaultEnd.getDate() + 7);
          return defaultEnd;
        })();

    // Generate potential time slots (every 30 minutes during working hours)
    for (
      let date = new Date(searchStartDate);
      date <= searchEndDate;
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
          const now = new Date();
          if (slotStart < now) continue;

          // Check if slot extends beyond working hours (5 PM = 17:00)
          if (
            slotEnd.getHours() > workingHoursEnd ||
            (slotEnd.getHours() === workingHoursEnd && slotEnd.getMinutes() > 0)
          )
            continue;

          // Check availability for all users
          const availableUsers: string[] = [];
          const unavailableUsers: string[] = [];

          for (const userId of userIds) {
            const userData = freeBusyData.get(userId);
            if (!userData || !userData.available) {
              unavailableUsers.push(userId);
              continue;
            }

            const isFree = !this.isTimeSlotBusy(
              slotStart,
              slotEnd,
              userData.busy,
            );

            if (isFree) {
              availableUsers.push(userId);
            } else {
              unavailableUsers.push(userId);
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
              unavailableUsers,
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
      attendees: attendees.map((a) => ({
        email: a.email,
        responseStatus: 'needsAction', // Mark as pending invitation
      })),
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
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: true,
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all', // ✅ Send email invites to ALL attendees
      sendNotifications: true, // ✅ Legacy parameter for email delivery
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
