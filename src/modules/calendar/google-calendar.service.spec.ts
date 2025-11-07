import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from './google-calendar.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    integration_tokens: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    external_event_map: {
      create: jest.fn(),
      findFirst: jest.fn(),
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
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAuthUrl', () => {
    it('should generate Google OAuth URL with correct scopes', async () => {
      const userId = 'test-user-id';
      const url = await service.getAuthUrl(userId);

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('scope=');
      expect(url).toContain('calendar');
      expect(url).toContain('state=' + userId);
    });
  });

  describe('handleOAuthCallback', () => {
    it('should create new integration token if not exists', async () => {
      const code = 'test-auth-code';
      const userId = 'test-user-id';

      const mockOAuth2Client = {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      // Spy on createOAuth2Client to return mock
      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);
      mockPrismaService.integration_tokens.create.mockResolvedValue({
        id: 'token-id',
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
      });

      await service.handleOAuthCallback(code, userId);

      // Verify OAuth2 getToken was called
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(code);

      // Verify that findFirst was called
      expect(
        mockPrismaService.integration_tokens.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: userId,
            provider: 'GOOGLE_CALENDAR',
          },
        }),
      );

      // Verify create was called
      expect(mockPrismaService.integration_tokens.create).toHaveBeenCalled();
    });

    it('should update existing integration token', async () => {
      const code = 'test-auth-code';
      const userId = 'test-user-id';

      const mockOAuth2Client = {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'updated-access-token',
            refresh_token: 'updated-refresh-token',
            expiry_date: Date.now() + 3600000,
          },
        }),
      };

      // Spy on createOAuth2Client to return mock
      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);

      const existingToken = {
        id: 'existing-token-id',
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'old-token',
        refresh_token: 'refresh-token',
      };

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(
        existingToken,
      );
      mockPrismaService.integration_tokens.update.mockResolvedValue({
        ...existingToken,
        access_token: 'updated-access-token',
      });

      await service.handleOAuthCallback(code, userId);

      // Verify OAuth2 getToken was called
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(code);

      // Verify findFirst was called
      expect(mockPrismaService.integration_tokens.findFirst).toHaveBeenCalled();

      // Verify update was called
      expect(mockPrismaService.integration_tokens.update).toHaveBeenCalled();
    });
  });

  describe('getIntegrationStatus', () => {
    it('should return connected status when active integration exists', async () => {
      const userId = 'test-user-id';
      const mockIntegration = {
        id: 'token-id',
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
        account_email: 'test@example.com',
        updated_at: new Date(),
      };

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(
        mockIntegration,
      );

      const status = await service.getIntegrationStatus(userId);

      expect(status.isConnected).toBe(true);
      expect(status.accountEmail).toBe('test@example.com');
      expect(status.lastSyncAt).toBeDefined();
    });

    it('should return disconnected status when no integration exists', async () => {
      const userId = 'test-user-id';

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const status = await service.getIntegrationStatus(userId);

      expect(status.isConnected).toBe(false);
      expect(status.accountEmail).toBeNull();
    });
  });

  describe('disconnectIntegration', () => {
    it('should revoke integration token', async () => {
      const userId = 'test-user-id';

      mockPrismaService.integration_tokens.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.disconnectIntegration(userId);

      expect(result.success).toBe(true);
      expect(
        mockPrismaService.integration_tokens.updateMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: userId,
            provider: 'GOOGLE_CALENDAR',
          },
          data: {
            status: 'REVOKED',
            updated_at: expect.any(Date),
          },
        }),
      );
    });
  });

  describe('createTaskReminderEvent', () => {
    it('should return null when user has no calendar integration', async () => {
      const userId = 'test-user-id';
      const taskId = 'task-id';
      const title = 'Test Task';
      const dueDate = new Date('2024-12-31T10:00:00Z');
      const reminderMinutes = 30;

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const result = await service.createTaskReminderEvent(
        userId,
        taskId,
        title,
        dueDate,
        reminderMinutes,
      );

      expect(result).toBeNull();
    });
  });

  describe('createProjectEventInGoogle', () => {
    it('should return null calendar event ID when user has no integration', async () => {
      const userId = 'test-user-id';
      const eventData = {
        title: 'Team Meeting',
        description: 'Weekly sync',
        startAt: new Date('2024-12-31T10:00:00Z'),
        endAt: new Date('2024-12-31T11:00:00Z'),
        attendeeEmails: ['user1@example.com', 'user2@example.com'],
        createMeet: true,
      };

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const result = await service.createProjectEventInGoogle(
        userId,
        eventData,
      );

      expect(result.calendarEventId).toBeNull();
      expect(result.meetLink).toBeNull();
    });
  });
});
