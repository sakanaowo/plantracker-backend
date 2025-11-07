import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleCalendarService } from '../calendar/google-calendar.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException } from '@nestjs/common';

/**
 * Test suite for Events Project Events functionality
 * Tests getProjectEvents, createProjectEvent, updateProjectEvent, deleteProjectEvent, sendReminder
 */
describe('EventsService - Project Events', () => {
  let service: EventsService;
  let prismaService: PrismaService;
  let googleCalendarService: GoogleCalendarService;

  const mockPrismaService = {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    participants: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    external_event_map: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockGoogleCalendarService = {
    createProjectEventInGoogle: jest.fn(),
    updateProjectEventInGoogle: jest.fn(),
    deleteProjectEventInGoogle: jest.fn(),
  };

  const mockActivityLogsService = {
    logEventCreated: jest.fn(),
    logEventUpdated: jest.fn(),
    logEventDeleted: jest.fn(),
  };

  const mockNotificationsService = {
    notifyEventCreated: jest.fn(),
    notifyEventUpdated: jest.fn(),
  };

  beforeEach(async () => {
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
          provide: ActivityLogsService,
          useValue: mockActivityLogsService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prismaService = module.get<PrismaService>(PrismaService);
    googleCalendarService = module.get<GoogleCalendarService>(
      GoogleCalendarService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectEvents', () => {
    const projectId = 'test-project-id';
    const now = new Date();

    it('should return upcoming events when filter is UPCOMING', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          title: 'Future Event',
          start_at: new Date(now.getTime() + 86400000), // +1 day
          recurrence: 'NONE',
        },
      ];

      mockPrismaService.event.findMany.mockResolvedValue(mockEvents);

      const result = await service.getProjectEvents(projectId, 'UPCOMING');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_id: projectId,
            start_at: {
              gte: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('should return past events when filter is PAST', async () => {
      const mockEvents = [
        {
          id: 'event-2',
          title: 'Past Event',
          start_at: new Date(now.getTime() - 86400000), // -1 day
          recurrence: 'NONE',
        },
      ];

      mockPrismaService.event.findMany.mockResolvedValue(mockEvents);

      const result = await service.getProjectEvents(projectId, 'PAST');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_id: projectId,
            start_at: {
              lt: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('should return recurring events when filter is RECURRING', async () => {
      const mockEvents = [
        {
          id: 'event-3',
          title: 'Weekly Meeting',
          start_at: new Date(),
          recurrence: 'WEEKLY',
        },
      ];

      mockPrismaService.event.findMany.mockResolvedValue(mockEvents);

      const result = await service.getProjectEvents(projectId, 'RECURRING');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_id: projectId,
            recurrence: {
              not: 'NONE',
            },
          }),
        }),
      );
    });
  });

  describe('createProjectEvent', () => {
    const userId = 'test-user-id';
    const createEventDto = {
      projectId: 'project-1',
      title: 'Team Meeting',
      description: 'Weekly sync',
      date: '2024-12-31',
      time: '10:00',
      duration: 60,
      type: 'MEETING' as const,
      recurrence: 'NONE' as const,
      attendeeIds: ['user-1', 'user-2'],
      createGoogleMeet: true,
    };

    it('should create event with Google Meet link', async () => {
      const mockUser = {
        id: userId,
        email: 'organizer@example.com',
      };

      const mockAttendees = [
        { id: 'user-1', email: 'user1@example.com' },
        { id: 'user-2', email: 'user2@example.com' },
      ];

      const mockCreatedEvent = {
        id: 'new-event-id',
        title: createEventDto.title,
        project_id: createEventDto.projectId,
        created_by: userId,
        start_at: new Date('2024-12-31T10:00:00Z'),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findMany.mockResolvedValue(mockAttendees);
      mockGoogleCalendarService.createProjectEventInGoogle.mockResolvedValue({
        calendarEventId: 'google-event-123',
        meetLink: 'https://meet.google.com/abc-defg-hij',
      });
      mockPrismaService.event.create.mockResolvedValue(mockCreatedEvent);
      mockPrismaService.external_event_map.create.mockResolvedValue({});
      mockPrismaService.participants.createMany.mockResolvedValue({ count: 2 });

      const result = await service.createProjectEvent(userId, createEventDto);

      expect(result).toBeDefined();
      expect(
        mockGoogleCalendarService.createProjectEventInGoogle,
      ).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          title: createEventDto.title,
          createMeet: true,
          attendeeEmails: ['user1@example.com', 'user2@example.com'],
        }),
      );
      expect(mockPrismaService.external_event_map.create).toHaveBeenCalled();
    });

    it('should create event without Google Meet', async () => {
      const dtoWithoutMeet = {
        ...createEventDto,
        createGoogleMeet: false,
      };

      const mockUser = { id: userId, email: 'organizer@example.com' };
      const mockCreatedEvent = {
        id: 'new-event-id',
        title: dtoWithoutMeet.title,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockGoogleCalendarService.createProjectEventInGoogle.mockResolvedValue({
        calendarEventId: 'google-event-456',
        meetLink: null,
      });
      mockPrismaService.event.create.mockResolvedValue(mockCreatedEvent);
      mockPrismaService.external_event_map.create.mockResolvedValue({});
      mockPrismaService.participants.createMany.mockResolvedValue({ count: 0 });

      await service.createProjectEvent(userId, dtoWithoutMeet);

      expect(
        mockGoogleCalendarService.createProjectEventInGoogle,
      ).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          createMeet: false,
        }),
      );
    });
  });

  describe('updateProjectEvent', () => {
    const userId = 'test-user-id';
    const eventId = 'event-id-123';
    const updateDto = {
      title: 'Updated Title',
      description: 'Updated description',
      attendeeIds: ['user-3'],
    };

    it('should update event in both database and Google Calendar', async () => {
      const mockExistingEvent = {
        id: eventId,
        title: 'Old Title',
        start_at: new Date('2024-12-31T10:00:00Z'),
        duration: 60,
      };

      const mockExternalMap = {
        event_id: eventId,
        external_event_id: 'google-event-123',
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockExistingEvent);
      mockPrismaService.external_event_map.findFirst.mockResolvedValue(
        mockExternalMap,
      );
      mockGoogleCalendarService.updateProjectEventInGoogle.mockResolvedValue(
        true,
      );
      mockPrismaService.participants.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-3' }]);
      mockPrismaService.participants.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.event.update.mockResolvedValue({
        ...mockExistingEvent,
        ...updateDto,
      });

      const result = await service.updateProjectEvent(
        userId,
        eventId,
        updateDto,
      );

      expect(result.title).toBe(updateDto.title);
      expect(
        mockGoogleCalendarService.updateProjectEventInGoogle,
      ).toHaveBeenCalledWith(userId, 'google-event-123', expect.any(Object));
    });

    it('should throw NotFoundException when event does not exist', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProjectEvent(userId, 'non-existent-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProjectEvent', () => {
    const userId = 'test-user-id';
    const eventId = 'event-to-delete';

    it('should delete event from both database and Google Calendar', async () => {
      const mockEvent = {
        id: eventId,
        title: 'Event to Delete',
      };

      const mockExternalMap = {
        event_id: eventId,
        external_event_id: 'google-event-999',
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.external_event_map.findFirst.mockResolvedValue(
        mockExternalMap,
      );
      mockGoogleCalendarService.deleteProjectEventInGoogle.mockResolvedValue(
        true,
      );
      mockPrismaService.external_event_map.delete.mockResolvedValue({});
      mockPrismaService.participants.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaService.event.delete.mockResolvedValue(mockEvent);

      await service.deleteProjectEvent(userId, eventId);

      expect(
        mockGoogleCalendarService.deleteProjectEventInGoogle,
      ).toHaveBeenCalledWith(userId, 'google-event-999');
      expect(mockPrismaService.event.delete).toHaveBeenCalledWith({
        where: { id: eventId },
      });
    });

    it('should throw NotFoundException when event does not exist', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteProjectEvent(userId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendReminder', () => {
    const eventId = 'event-reminder-test';

    it('should send reminder to all attendees', async () => {
      const mockEvent = {
        id: eventId,
        title: 'Important Meeting',
        start_at: new Date('2024-12-31T10:00:00Z'),
      };

      const mockParticipants = [
        { user_id: 'user-1', user: { email: 'user1@example.com' } },
        { user_id: 'user-2', user: { email: 'user2@example.com' } },
      ];

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.participants.findMany.mockResolvedValue(
        mockParticipants,
      );

      const result = await service.sendReminder(eventId);

      expect(result.success).toBe(true);
      expect(result.recipientCount).toBe(2);
    });

    it('should throw NotFoundException when event does not exist', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.sendReminder('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
