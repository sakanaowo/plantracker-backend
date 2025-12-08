// TODO: Remove this test file after Frontend integration is complete
// This file was created for validating suggest meeting times logic during development
// Location: src/modules/events/events-suggest-times.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleCalendarService } from '../calendar/google-calendar.service';
import { MeetingSchedulerService } from '../calendar/meeting-scheduler.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { Logger } from '@nestjs/common';

describe('EventsService - Suggest Meeting Times', () => {
  let service: EventsService;
  let prismaService: PrismaService;
  let googleCalendarService: GoogleCalendarService;
  let meetingSchedulerService: MeetingSchedulerService;

  // Real test data from database
  const REAL_PROJECT = {
    id: 'd1ce1f4a-1148-4aca-ae1e-01ace0586beb',
    name: 'team project',
  };

  const REAL_USERS = {
    OWNER: {
      id: 'AqhUZmslU1bKzfs4lgfZdLmwCeK2',
      name: 'だいさんかお',
      email: 'uwusakana@gmail.com',
      hasCalendar: true,
      tokenExpired: true,
    },
    MEMBER_1: {
      id: 'D2WdxaQp4hdKv1cZ7lJs0p4IPKW2',
      name: 'B22DCVT336_Đoàn Quang Minh',
      email: 'ggvvsihnc@gmail.com',
      hasCalendar: true,
      tokenExpired: true,
    },
    MEMBER_2: {
      id: 'GPIpdb60SEX4bAxrz6UvtW9Kcty1',
      name: 'Minh Doan Quang',
      email: 'doanquangminh021@gmail.com',
      hasCalendar: true,
      tokenExpired: false,
    },
  };

  const mockPrismaService = {
    projects: {
      findUnique: jest.fn(),
    },
    project_members: {
      findFirst: jest.fn(),
    },
    users: {
      findMany: jest.fn(),
    },
  };

  const mockGoogleCalendarService = {
    refreshMultipleTokens: jest.fn(),
  };

  const mockMeetingSchedulerService = {
    suggestMeetingTimes: jest.fn(),
  };

  const mockNotificationsService = {
    sendNotification: jest.fn(),
  };

  const mockActivityLogsService = {
    logEventCreated: jest.fn(),
    logEventUpdated: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GoogleCalendarService,
          useValue: mockGoogleCalendarService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: ActivityLogsService,
          useValue: mockActivityLogsService,
        },
        {
          provide: MeetingSchedulerService,
          useValue: mockMeetingSchedulerService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prismaService = module.get<PrismaService>(PrismaService);
    googleCalendarService = module.get<GoogleCalendarService>(
      GoogleCalendarService,
    );
    meetingSchedulerService = module.get<MeetingSchedulerService>(
      MeetingSchedulerService,
    );

    // Suppress logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('suggestEventTimes', () => {
    const validDto = {
      participantIds: [
        REAL_USERS.OWNER.id,
        REAL_USERS.MEMBER_1.id,
        REAL_USERS.MEMBER_2.id,
      ],
      startDate: '2025-12-09T00:00:00Z',
      endDate: '2025-12-13T23:59:59Z',
      durationMinutes: 60,
      maxSuggestions: 5,
    };

    beforeEach(() => {
      // Mock project exists
      mockPrismaService.projects.findUnique.mockResolvedValue({
        id: REAL_PROJECT.id,
        name: REAL_PROJECT.name,
      });

      // Mock user is project member
      mockPrismaService.project_members.findFirst.mockResolvedValue({
        project_id: REAL_PROJECT.id,
        user_id: REAL_USERS.MEMBER_2.id,
      });
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.projects.findUnique.mockResolvedValue(null);

      await expect(
        service.suggestEventTimes(
          REAL_PROJECT.id,
          validDto,
          REAL_USERS.MEMBER_2.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not project member', async () => {
      mockPrismaService.project_members.findFirst.mockResolvedValue(null);

      await expect(
        service.suggestEventTimes(REAL_PROJECT.id, validDto, 'non-member-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if no participants have Google Calendar', async () => {
      mockPrismaService.users.findMany.mockResolvedValue([]);

      await expect(
        service.suggestEventTimes(
          REAL_PROJECT.id,
          validDto,
          REAL_USERS.MEMBER_2.id,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.users.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: validDto.participantIds },
          integration_tokens: {
            some: {
              provider: 'GOOGLE_CALENDAR',
              status: 'ACTIVE',
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });
    });

    it('should refresh tokens for all participants with calendar', async () => {
      mockPrismaService.users.findMany.mockResolvedValue([
        {
          id: REAL_USERS.OWNER.id,
          name: REAL_USERS.OWNER.name,
          email: REAL_USERS.OWNER.email,
        },
        {
          id: REAL_USERS.MEMBER_1.id,
          name: REAL_USERS.MEMBER_1.name,
          email: REAL_USERS.MEMBER_1.email,
        },
        {
          id: REAL_USERS.MEMBER_2.id,
          name: REAL_USERS.MEMBER_2.name,
          email: REAL_USERS.MEMBER_2.email,
        },
      ]);

      mockGoogleCalendarService.refreshMultipleTokens.mockResolvedValue(
        new Map([
          [REAL_USERS.OWNER.id, false], // Refresh failed
          [REAL_USERS.MEMBER_1.id, false], // Refresh failed
          [REAL_USERS.MEMBER_2.id, true], // Refresh success
        ]),
      );

      mockMeetingSchedulerService.suggestMeetingTimes.mockResolvedValue({
        suggestions: [
          {
            start: '2025-12-09T09:00:00',
            end: '2025-12-09T10:00:00',
            availableUsers: [REAL_USERS.MEMBER_2.id],
            score: 33,
          },
        ],
      });

      const result = await service.suggestEventTimes(
        REAL_PROJECT.id,
        validDto,
        REAL_USERS.MEMBER_2.id,
      );

      expect(googleCalendarService.refreshMultipleTokens).toHaveBeenCalledWith([
        REAL_USERS.OWNER.id,
        REAL_USERS.MEMBER_1.id,
        REAL_USERS.MEMBER_2.id,
      ]);

      // Should only call meeting scheduler with users who have valid tokens
      expect(meetingSchedulerService.suggestMeetingTimes).toHaveBeenCalledWith({
        userIds: [REAL_USERS.MEMBER_2.id], // Only one with successful refresh
        startDate: validDto.startDate,
        endDate: validDto.endDate,
        durationMinutes: 60,
        maxSuggestions: 5,
      });

      // participantsWithCalendar should reflect only users with valid tokens
      expect(result.participantsWithCalendar).toBe(1);
      expect(result.totalParticipants).toBe(3);
    });

    it('should throw BadRequestException if all token refreshes fail', async () => {
      mockPrismaService.users.findMany.mockResolvedValue([
        {
          id: REAL_USERS.OWNER.id,
          name: REAL_USERS.OWNER.name,
          email: REAL_USERS.OWNER.email,
        },
        {
          id: REAL_USERS.MEMBER_1.id,
          name: REAL_USERS.MEMBER_1.name,
          email: REAL_USERS.MEMBER_1.email,
        },
      ]);

      mockGoogleCalendarService.refreshMultipleTokens.mockResolvedValue(
        new Map([
          [REAL_USERS.OWNER.id, false],
          [REAL_USERS.MEMBER_1.id, false],
        ]),
      );

      await expect(
        service.suggestEventTimes(
          REAL_PROJECT.id,
          validDto,
          REAL_USERS.MEMBER_2.id,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(
        meetingSchedulerService.suggestMeetingTimes,
      ).not.toHaveBeenCalled();
    });

    it('should successfully suggest times with all valid tokens', async () => {
      mockPrismaService.users.findMany.mockResolvedValue([
        {
          id: REAL_USERS.OWNER.id,
          name: REAL_USERS.OWNER.name,
          email: REAL_USERS.OWNER.email,
        },
        {
          id: REAL_USERS.MEMBER_1.id,
          name: REAL_USERS.MEMBER_1.name,
          email: REAL_USERS.MEMBER_1.email,
        },
        {
          id: REAL_USERS.MEMBER_2.id,
          name: REAL_USERS.MEMBER_2.name,
          email: REAL_USERS.MEMBER_2.email,
        },
      ]);

      mockGoogleCalendarService.refreshMultipleTokens.mockResolvedValue(
        new Map([
          [REAL_USERS.OWNER.id, true],
          [REAL_USERS.MEMBER_1.id, true],
          [REAL_USERS.MEMBER_2.id, true],
        ]),
      );

      mockMeetingSchedulerService.suggestMeetingTimes.mockResolvedValue({
        suggestions: [
          {
            start: '2025-12-09T09:00:00',
            end: '2025-12-09T10:00:00',
            availableUsers: [
              REAL_USERS.OWNER.id,
              REAL_USERS.MEMBER_1.id,
              REAL_USERS.MEMBER_2.id,
            ],
            score: 100,
          },
          {
            start: '2025-12-09T14:00:00',
            end: '2025-12-09T15:00:00',
            availableUsers: [REAL_USERS.MEMBER_1.id, REAL_USERS.MEMBER_2.id],
            score: 67,
          },
        ],
      });

      const result = await service.suggestEventTimes(
        REAL_PROJECT.id,
        validDto,
        REAL_USERS.MEMBER_2.id,
      );

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].score).toBe(100);
      expect(result.suggestions[0].scoreLabel).toBe('Excellent');
      expect(result.suggestions[0].availableUsers).toHaveLength(3);

      expect(result.suggestions[1].score).toBe(67);
      expect(result.suggestions[1].scoreLabel).toBe('Good');
      expect(result.suggestions[1].unavailableUsers).toEqual([
        REAL_USERS.OWNER.id,
      ]);

      expect(result.totalParticipants).toBe(3);
      expect(result.participantsWithCalendar).toBe(3);
      expect(result.checkedRange).toEqual({
        start: validDto.startDate,
        end: validDto.endDate,
      });
    });

    it('should handle partial token refresh success correctly', async () => {
      mockPrismaService.users.findMany.mockResolvedValue([
        {
          id: REAL_USERS.OWNER.id,
          name: REAL_USERS.OWNER.name,
          email: REAL_USERS.OWNER.email,
        },
        {
          id: REAL_USERS.MEMBER_1.id,
          name: REAL_USERS.MEMBER_1.name,
          email: REAL_USERS.MEMBER_1.email,
        },
        {
          id: REAL_USERS.MEMBER_2.id,
          name: REAL_USERS.MEMBER_2.name,
          email: REAL_USERS.MEMBER_2.email,
        },
      ]);

      // Simulate real scenario: 2 expired, 1 active
      mockGoogleCalendarService.refreshMultipleTokens.mockResolvedValue(
        new Map([
          [REAL_USERS.OWNER.id, false], // Token expired (2025-12-07)
          [REAL_USERS.MEMBER_1.id, false], // Token expired (2025-12-07)
          [REAL_USERS.MEMBER_2.id, true], // Token active (2025-12-08)
        ]),
      );

      mockMeetingSchedulerService.suggestMeetingTimes.mockResolvedValue({
        suggestions: [
          {
            start: '2025-12-09T09:00:00',
            end: '2025-12-09T10:00:00',
            availableUsers: [REAL_USERS.MEMBER_2.id],
            score: 33,
          },
        ],
      });

      const result = await service.suggestEventTimes(
        REAL_PROJECT.id,
        validDto,
        REAL_USERS.MEMBER_2.id,
      );

      // Should only use successfully refreshed token
      expect(meetingSchedulerService.suggestMeetingTimes).toHaveBeenCalledWith({
        userIds: [REAL_USERS.MEMBER_2.id],
        startDate: validDto.startDate,
        endDate: validDto.endDate,
        durationMinutes: 60,
        maxSuggestions: 5,
      });

      expect(result.participantsWithCalendar).toBe(1);
      expect(result.totalParticipants).toBe(3);
      expect(result.suggestions[0].scoreLabel).toBe('Poor');

      // Should include recommendations about users without calendar
      expect(result.recommendations).toBeDefined();
    });

    it('should apply score labels correctly', async () => {
      mockPrismaService.users.findMany.mockResolvedValue([
        {
          id: REAL_USERS.MEMBER_2.id,
          name: REAL_USERS.MEMBER_2.name,
          email: REAL_USERS.MEMBER_2.email,
        },
      ]);

      mockGoogleCalendarService.refreshMultipleTokens.mockResolvedValue(
        new Map([[REAL_USERS.MEMBER_2.id, true]]),
      );

      mockMeetingSchedulerService.suggestMeetingTimes.mockResolvedValue({
        suggestions: [
          {
            start: '2025-12-09T09:00:00',
            end: '2025-12-09T10:00:00',
            availableUsers: [],
            score: 90,
          },
          {
            start: '2025-12-09T10:00:00',
            end: '2025-12-09T11:00:00',
            availableUsers: [],
            score: 70,
          },
          {
            start: '2025-12-09T11:00:00',
            end: '2025-12-09T12:00:00',
            availableUsers: [],
            score: 50,
          },
          {
            start: '2025-12-09T14:00:00',
            end: '2025-12-09T15:00:00',
            availableUsers: [],
            score: 30,
          },
        ],
      });

      const result = await service.suggestEventTimes(
        REAL_PROJECT.id,
        { ...validDto, participantIds: [REAL_USERS.MEMBER_2.id] },
        REAL_USERS.MEMBER_2.id,
      );

      expect(result.suggestions[0].scoreLabel).toBe('Excellent'); // 90
      expect(result.suggestions[1].scoreLabel).toBe('Good'); // 70
      expect(result.suggestions[2].scoreLabel).toBe('Fair'); // 50
      expect(result.suggestions[3].scoreLabel).toBe('Poor'); // 30
    });
  });
});
