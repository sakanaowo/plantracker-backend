// TODO: Remove this test file after Frontend integration is complete
// This file validates proactive token refresh in all Google Calendar API calls
// Location: src/modules/calendar/google-calendar-proactive-refresh.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from './google-calendar.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

describe('GoogleCalendarService - Proactive Token Refresh in All API Calls', () => {
  let service: GoogleCalendarService;
  let prismaService: PrismaService;

  const TEST_USER_ID = 'test-user-123';

  const mockPrismaService = {
    integration_tokens: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCalendarService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GoogleCalendarService>(GoogleCalendarService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Suppress logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  describe('syncUserEvents - Token Refresh', () => {
    it('should refresh token before syncing events', async () => {
      const expiredToken = new Date(Date.now() - 1000); // Expired

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: expiredToken,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});

      // Mock getCalendarClient to return null (to exit early)
      jest.spyOn(service as any, 'getCalendarClient').mockResolvedValue(null);

      await service.syncUserEvents(TEST_USER_ID, 'project-123');

      // Verify refresh was called
      expect(mockPrismaService.integration_tokens.findFirst).toHaveBeenCalled();
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(mockPrismaService.integration_tokens.update).toHaveBeenCalled();
    });

    it('should exit early if token refresh fails', async () => {
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const getCalendarSpy = jest.spyOn(service as any, 'getCalendarClient');

      await service.syncUserEvents(TEST_USER_ID, 'project-123');

      // Should not call getCalendarClient if refresh fails
      expect(getCalendarSpy).not.toHaveBeenCalled();
    });
  });

  describe('createTaskReminderEvent - Token Refresh', () => {
    it('should refresh token before creating task reminder', async () => {
      const expiredToken = new Date(Date.now() - 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: expiredToken,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});
      jest.spyOn(service as any, 'getCalendarClient').mockResolvedValue(null);

      const result = await service.createTaskReminderEvent(
        TEST_USER_ID,
        'task-123',
        'Test Task',
        new Date(),
        30,
      );

      expect(result).toBeNull();
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it('should return null if refresh fails', async () => {
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const result = await service.createTaskReminderEvent(
        TEST_USER_ID,
        'task-123',
        'Test Task',
        new Date(),
        30,
      );

      expect(result).toBeNull();
    });
  });

  describe('updateTaskReminderEvent - Token Refresh', () => {
    it('should refresh token before updating task reminder', async () => {
      const expiredToken = new Date(Date.now() - 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: expiredToken,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});
      jest.spyOn(service as any, 'getCalendarClient').mockResolvedValue(null);

      const result = await service.updateTaskReminderEvent(
        TEST_USER_ID,
        'event-123',
        'Updated Task',
        new Date(),
        30,
      );

      expect(result).toBe(false);
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it('should return false if refresh fails', async () => {
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const result = await service.updateTaskReminderEvent(
        TEST_USER_ID,
        'event-123',
        'Updated Task',
        new Date(),
        30,
      );

      expect(result).toBe(false);
    });
  });

  describe('deleteTaskReminderEvent - Token Refresh', () => {
    it('should refresh token before deleting task reminder', async () => {
      const expiredToken = new Date(Date.now() - 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: expiredToken,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});
      jest.spyOn(service as any, 'getCalendarClient').mockResolvedValue(null);

      const result = await service.deleteTaskReminderEvent(
        TEST_USER_ID,
        'event-123',
      );

      expect(result).toBe(false);
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it('should return false if refresh fails', async () => {
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const result = await service.deleteTaskReminderEvent(
        TEST_USER_ID,
        'event-123',
      );

      expect(result).toBe(false);
    });
  });

  describe('createProjectEventInGoogle - Token Refresh and Recurrence', () => {
    it('should refresh token before creating project event', async () => {
      const expiredToken = new Date(Date.now() - 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: expiredToken,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});
      jest.spyOn(service as any, 'getCalendarClient').mockResolvedValue(null);

      const result = await service.createProjectEventInGoogle(TEST_USER_ID, {
        title: 'Test Event',
        startAt: new Date(),
        endAt: new Date(),
        attendeeEmails: ['test@example.com'],
        createMeet: false,
        recurrence: 'WEEKLY',
      });

      expect(result.calendarEventId).toBeNull();
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it('should return null if refresh fails', async () => {
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const result = await service.createProjectEventInGoogle(TEST_USER_ID, {
        title: 'Test Event',
        startAt: new Date(),
        endAt: new Date(),
        attendeeEmails: ['test@example.com'],
        createMeet: false,
      });

      expect(result.calendarEventId).toBeNull();
      expect(result.meetLink).toBeNull();
    });

    it('should add RRULE for weekly recurrence', async () => {
      const validToken = new Date(Date.now() + 3600000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: validToken,
        status: 'ACTIVE',
      });

      const mockCalendar = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'event-123',
              conferenceData: null,
            },
          }),
        },
      };

      jest
        .spyOn(service as any, 'getCalendarClient')
        .mockResolvedValue(mockCalendar);

      const result = await service.createProjectEventInGoogle(TEST_USER_ID, {
        title: 'Weekly Meeting',
        startAt: new Date('2025-12-09T10:00:00'),
        endAt: new Date('2025-12-09T11:00:00'),
        attendeeEmails: ['test@example.com'],
        createMeet: false,
        recurrence: 'WEEKLY',
      });

      expect(mockCalendar.events.insert).toHaveBeenCalled();
      const callArgs = mockCalendar.events.insert.mock.calls[0][0];
      expect(callArgs.requestBody.recurrence).toEqual(['RRULE:FREQ=WEEKLY']);
      expect(result.calendarEventId).toBe('event-123');
    });

    it('should add RRULE for daily recurrence', async () => {
      const validToken = new Date(Date.now() + 3600000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: validToken,
        status: 'ACTIVE',
      });

      const mockCalendar = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'event-456',
              conferenceData: null,
            },
          }),
        },
      };

      jest
        .spyOn(service as any, 'getCalendarClient')
        .mockResolvedValue(mockCalendar);

      const result = await service.createProjectEventInGoogle(TEST_USER_ID, {
        title: 'Daily Standup',
        startAt: new Date('2025-12-09T09:00:00'),
        endAt: new Date('2025-12-09T09:15:00'),
        attendeeEmails: ['team@example.com'],
        createMeet: true,
        recurrence: 'DAILY',
      });

      const callArgs = mockCalendar.events.insert.mock.calls[0][0];
      expect(callArgs.requestBody.recurrence).toEqual(['RRULE:FREQ=DAILY']);
      expect(callArgs.conferenceDataVersion).toBe(1);
      expect(result.calendarEventId).toBe('event-456');
    });

    it('should add RRULE for biweekly recurrence', async () => {
      const validToken = new Date(Date.now() + 3600000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: validToken,
        status: 'ACTIVE',
      });

      const mockCalendar = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'event-789',
              conferenceData: null,
            },
          }),
        },
      };

      jest
        .spyOn(service as any, 'getCalendarClient')
        .mockResolvedValue(mockCalendar);

      await service.createProjectEventInGoogle(TEST_USER_ID, {
        title: 'Biweekly Review',
        startAt: new Date(),
        endAt: new Date(),
        attendeeEmails: [],
        createMeet: false,
        recurrence: 'BIWEEKLY',
      });

      const callArgs = mockCalendar.events.insert.mock.calls[0][0];
      expect(callArgs.requestBody.recurrence).toEqual([
        'RRULE:FREQ=WEEKLY;INTERVAL=2',
      ]);
    });

    it('should add RRULE for monthly recurrence', async () => {
      const validToken = new Date(Date.now() + 3600000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: validToken,
        status: 'ACTIVE',
      });

      const mockCalendar = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'event-999',
              conferenceData: null,
            },
          }),
        },
      };

      jest
        .spyOn(service as any, 'getCalendarClient')
        .mockResolvedValue(mockCalendar);

      await service.createProjectEventInGoogle(TEST_USER_ID, {
        title: 'Monthly Planning',
        startAt: new Date(),
        endAt: new Date(),
        attendeeEmails: [],
        createMeet: false,
        recurrence: 'MONTHLY',
      });

      const callArgs = mockCalendar.events.insert.mock.calls[0][0];
      expect(callArgs.requestBody.recurrence).toEqual(['RRULE:FREQ=MONTHLY']);
    });

    it('should not add RRULE when recurrence is NONE', async () => {
      const validToken = new Date(Date.now() + 3600000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: validToken,
        status: 'ACTIVE',
      });

      const mockCalendar = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'event-one-time',
              conferenceData: null,
            },
          }),
        },
      };

      jest
        .spyOn(service as any, 'getCalendarClient')
        .mockResolvedValue(mockCalendar);

      await service.createProjectEventInGoogle(TEST_USER_ID, {
        title: 'One-time Event',
        startAt: new Date(),
        endAt: new Date(),
        attendeeEmails: [],
        createMeet: false,
        recurrence: 'NONE',
      });

      const callArgs = mockCalendar.events.insert.mock.calls[0][0];
      expect(callArgs.requestBody.recurrence).toBeUndefined();
    });

    it('should create Meet link when requested with recurrence', async () => {
      const validToken = new Date(Date.now() + 3600000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: validToken,
        status: 'ACTIVE',
      });

      const mockCalendar = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'event-with-meet',
              conferenceData: {
                entryPoints: [
                  {
                    entryPointType: 'video',
                    uri: 'https://meet.google.com/abc-def-ghi',
                  },
                ],
              },
            },
          }),
        },
      };

      jest
        .spyOn(service as any, 'getCalendarClient')
        .mockResolvedValue(mockCalendar);

      const result = await service.createProjectEventInGoogle(TEST_USER_ID, {
        title: 'Weekly Meeting with Meet',
        startAt: new Date(),
        endAt: new Date(),
        attendeeEmails: ['test@example.com'],
        createMeet: true,
        recurrence: 'WEEKLY',
      });

      expect(result.meetLink).toBe('https://meet.google.com/abc-def-ghi');
      expect(result.calendarEventId).toBe('event-with-meet');

      const callArgs = mockCalendar.events.insert.mock.calls[0][0];
      expect(callArgs.requestBody.recurrence).toEqual(['RRULE:FREQ=WEEKLY']);
      expect(callArgs.conferenceDataVersion).toBe(1);
    });
  });

  describe('updateProjectEventInGoogle - Token Refresh', () => {
    it('should refresh token before updating event', async () => {
      const expiredToken = new Date(Date.now() - 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: expiredToken,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});
      jest.spyOn(service as any, 'getCalendarClient').mockResolvedValue(null);

      const result = await service.updateProjectEventInGoogle(
        TEST_USER_ID,
        'event-123',
        {
          title: 'Updated Event',
        },
      );

      expect(result).toBe(false);
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });
  });

  describe('deleteProjectEventInGoogle - Token Refresh', () => {
    it('should refresh token before deleting event', async () => {
      const expiredToken = new Date(Date.now() - 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: TEST_USER_ID,
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        expires_at: expiredToken,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});
      jest.spyOn(service as any, 'getCalendarClient').mockResolvedValue(null);

      const result = await service.deleteProjectEventInGoogle(
        TEST_USER_ID,
        'event-123',
      );

      expect(result).toBe(false);
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });
  });
});
