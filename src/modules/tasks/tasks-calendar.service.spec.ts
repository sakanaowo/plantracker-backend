import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleCalendarService } from '../calendar/google-calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotFoundException } from '@nestjs/common';

/**
 * Test suite for Tasks Calendar Sync functionality
 * Tests updateTaskWithCalendarSync and getTasksForCalendar methods
 */
describe('TasksService - Calendar Integration', () => {
  let service: TasksService;
  let prismaService: PrismaService;
  let googleCalendarService: GoogleCalendarService;

  const mockPrismaService = {
    task: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    integration_tokens: {
      findFirst: jest.fn(),
    },
    board: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const mockGoogleCalendarService = {
    createTaskReminderEvent: jest.fn(),
    updateTaskReminderEvent: jest.fn(),
    deleteTaskReminderEvent: jest.fn(),
  };

  const mockNotificationsService = {
    notifyTaskUpdated: jest.fn(),
  };

  const mockActivityLogsService = {
    logTaskUpdated: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
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
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prismaService = module.get<PrismaService>(PrismaService);
    googleCalendarService = module.get<GoogleCalendarService>(
      GoogleCalendarService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateTaskWithCalendarSync', () => {
    const userId = 'test-user-id';
    const taskId = 'test-task-id';

    const mockTask = {
      id: taskId,
      title: 'Test Task',
      due_at: new Date('2024-12-31T10:00:00Z'),
      calendar_reminder_enabled: false,
      calendar_event_id: null,
      calendar_reminder_time: null,
    };

    const mockIntegrationToken = {
      id: 'token-id',
      user_id: userId,
      provider: 'GOOGLE_CALENDAR',
      status: 'ACTIVE',
    };

    it('should throw NotFoundException when task does not exist', async () => {
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTaskWithCalendarSync(userId, taskId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enable calendar reminder and create Google Calendar event', async () => {
      mockPrismaService.task.findFirst.mockResolvedValue(mockTask);
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(
        mockIntegrationToken,
      );
      mockGoogleCalendarService.createTaskReminderEvent.mockResolvedValue(
        'google-event-id-123',
      );
      mockPrismaService.task.update.mockResolvedValue({
        ...mockTask,
        calendar_reminder_enabled: true,
        calendar_reminder_time: 30,
        calendar_event_id: 'google-event-id-123',
      });

      const updateData = {
        calendarReminderEnabled: true,
        calendarReminderTime: 30,
      };

      const result = await service.updateTaskWithCalendarSync(
        userId,
        taskId,
        updateData,
      );

      expect(result.calendar_reminder_enabled).toBe(true);
      expect(result.calendar_event_id).toBe('google-event-id-123');
      expect(
        mockGoogleCalendarService.createTaskReminderEvent,
      ).toHaveBeenCalledWith(
        userId,
        taskId,
        mockTask.title,
        mockTask.due_at,
        30,
      );
    });

    it('should disable calendar reminder and delete Google Calendar event', async () => {
      const taskWithEvent = {
        ...mockTask,
        calendar_reminder_enabled: true,
        calendar_event_id: 'google-event-id-123',
        calendar_reminder_time: 30,
      };

      mockPrismaService.task.findFirst.mockResolvedValue(taskWithEvent);
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(
        mockIntegrationToken,
      );
      mockGoogleCalendarService.deleteTaskReminderEvent.mockResolvedValue(true);
      mockPrismaService.task.update.mockResolvedValue({
        ...taskWithEvent,
        calendar_reminder_enabled: false,
        calendar_event_id: null,
      });

      const updateData = {
        calendarReminderEnabled: false,
      };

      const result = await service.updateTaskWithCalendarSync(
        userId,
        taskId,
        updateData,
      );

      expect(result.calendar_reminder_enabled).toBe(false);
      expect(result.calendar_event_id).toBeNull();
      expect(
        mockGoogleCalendarService.deleteTaskReminderEvent,
      ).toHaveBeenCalledWith(userId, 'google-event-id-123');
    });

    it('should update existing Google Calendar event when task details change', async () => {
      const taskWithEvent = {
        ...mockTask,
        calendar_reminder_enabled: true,
        calendar_event_id: 'google-event-id-123',
        calendar_reminder_time: 30,
      };

      mockPrismaService.task.findFirst.mockResolvedValue(taskWithEvent);
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(
        mockIntegrationToken,
      );
      mockGoogleCalendarService.updateTaskReminderEvent.mockResolvedValue(true);
      mockPrismaService.task.update.mockResolvedValue({
        ...taskWithEvent,
        title: 'Updated Task Title',
        due_at: new Date('2025-01-15T14:00:00Z'),
      });

      const updateData = {
        title: 'Updated Task Title',
        dueAt: new Date('2025-01-15T14:00:00Z'),
      };

      await service.updateTaskWithCalendarSync(userId, taskId, updateData);

      expect(
        mockGoogleCalendarService.updateTaskReminderEvent,
      ).toHaveBeenCalledWith(
        userId,
        'google-event-id-123',
        'Updated Task Title',
        new Date('2025-01-15T14:00:00Z'),
        30,
      );
    });

    it('should handle case when user has no Google Calendar integration', async () => {
      mockPrismaService.task.findFirst.mockResolvedValue(mockTask);
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);
      mockPrismaService.task.update.mockResolvedValue({
        ...mockTask,
        calendar_reminder_enabled: false,
      });

      const updateData = {
        calendarReminderEnabled: true,
        calendarReminderTime: 30,
      };

      const result = await service.updateTaskWithCalendarSync(
        userId,
        taskId,
        updateData,
      );

      // Should still update task but not create calendar event
      expect(result.calendar_reminder_enabled).toBe(false);
      expect(
        mockGoogleCalendarService.createTaskReminderEvent,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getTasksForCalendar', () => {
    const projectId = 'test-project-id';
    const startDate = new Date('2024-12-01T00:00:00Z');
    const endDate = new Date('2024-12-31T23:59:59Z');

    it('should return tasks within date range with calendar info', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          due_at: new Date('2024-12-15T10:00:00Z'),
          calendar_reminder_enabled: true,
          calendar_event_id: 'event-1',
          calendar_reminder_time: 30,
          board: { name: 'Board 1' },
          assigned_to: [{ user: { id: 'user-1', email: 'user1@example.com' } }],
          created_by: { id: 'creator-1', email: 'creator@example.com' },
        },
        {
          id: 'task-2',
          title: 'Task 2',
          due_at: new Date('2024-12-20T14:00:00Z'),
          calendar_reminder_enabled: false,
          calendar_event_id: null,
          calendar_reminder_time: null,
          board: { name: 'Board 2' },
          assigned_to: [],
          created_by: { id: 'creator-2', email: 'creator2@example.com' },
        },
      ];

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.getTasksForCalendar(
        projectId,
        startDate,
        endDate,
      );

      expect(result).toHaveLength(2);
      expect(result[0].calendarReminderEnabled).toBe(true);
      expect(result[0].calendarEventId).toBe('event-1');
      expect(result[1].calendarReminderEnabled).toBe(false);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            board: {
              project_id: projectId,
            },
            due_at: {
              gte: startDate,
              lte: endDate,
            },
            deleted_at: null,
          },
        }),
      );
    });

    it('should return empty array when no tasks in date range', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const result = await service.getTasksForCalendar(
        projectId,
        startDate,
        endDate,
      );

      expect(result).toEqual([]);
    });

    it('should include board name and assignees in response', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task with Details',
          due_at: new Date('2024-12-15T10:00:00Z'),
          calendar_reminder_enabled: true,
          calendar_event_id: 'event-1',
          calendar_reminder_time: 15,
          board: { name: 'Development Board' },
          assigned_to: [
            {
              user: {
                id: 'user-1',
                email: 'dev1@example.com',
                name: 'Developer 1',
              },
            },
            {
              user: {
                id: 'user-2',
                email: 'dev2@example.com',
                name: 'Developer 2',
              },
            },
          ],
          created_by: {
            id: 'manager-1',
            email: 'manager@example.com',
            name: 'Project Manager',
          },
        },
      ];

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.getTasksForCalendar(
        projectId,
        startDate,
        endDate,
      );

      expect(result[0].boardName).toBe('Development Board');
      expect(result[0].assignees).toHaveLength(2);
      expect(result[0].creator.email).toBe('manager@example.com');
    });
  });
});
