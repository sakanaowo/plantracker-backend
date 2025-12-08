// TODO: Remove this test file after Frontend integration is complete
// This file was created for validating token refresh logic during development
// Location: src/modules/calendar/google-calendar-refresh.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from './google-calendar.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

describe('GoogleCalendarService - Token Refresh', () => {
  let service: GoogleCalendarService;
  let prismaService: PrismaService;

  // Real test data from database
  const REAL_USERS = {
    ACTIVE: {
      id: 'GPIpdb60SEX4bAxrz6UvtW9Kcty1',
      name: 'Minh Doan Quang',
      email: 'doanquangminh021@gmail.com',
    },
    EXPIRED_1: {
      id: 'D2WdxaQp4hdKv1cZ7lJs0p4IPKW2',
      name: 'B22DCVT336_Đoàn Quang Minh',
      email: 'ggvvsihnc@gmail.com',
    },
    EXPIRED_2: {
      id: 'AqhUZmslU1bKzfs4lgfZdLmwCeK2',
      name: 'だいさんかお',
      email: 'uwusakana@gmail.com',
    },
  };

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

  describe('refreshAccessToken', () => {
    it('should skip refresh if token is still valid (> 5 minutes remaining)', async () => {
      // Token expires in 10 minutes
      const validExpiryDate = new Date(Date.now() + 10 * 60 * 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: REAL_USERS.ACTIVE.id,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'valid-access-token',
        refresh_token: 'refresh-token',
        expires_at: validExpiryDate,
        status: 'ACTIVE',
      });

      const result = await service.refreshAccessToken(REAL_USERS.ACTIVE.id);

      expect(result).toBe(true);
      expect(
        mockPrismaService.integration_tokens.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          user_id: REAL_USERS.ACTIVE.id,
          provider: 'GOOGLE_CALENDAR',
          status: 'ACTIVE',
        },
      });
      // Should not call update since token is still valid
      expect(
        mockPrismaService.integration_tokens.update,
      ).not.toHaveBeenCalled();
    });

    it('should return false if no integration found', async () => {
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue(null);

      const result = await service.refreshAccessToken(REAL_USERS.ACTIVE.id);

      expect(result).toBe(false);
      expect(
        mockPrismaService.integration_tokens.update,
      ).not.toHaveBeenCalled();
    });

    it('should return false if no refresh token available', async () => {
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: REAL_USERS.ACTIVE.id,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'access-token',
        refresh_token: null,
        expires_at: new Date(Date.now() - 1000),
        status: 'ACTIVE',
      });

      const result = await service.refreshAccessToken(REAL_USERS.ACTIVE.id);

      expect(result).toBe(false);
    });

    it('should mark token as EXPIRED if refresh fails', async () => {
      const expiredDate = new Date(Date.now() - 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: REAL_USERS.EXPIRED_1.id,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'expired-access-token',
        refresh_token: 'invalid-refresh-token',
        expires_at: expiredDate,
        status: 'ACTIVE',
      });

      // Mock OAuth2 client to throw error
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest
          .fn()
          .mockRejectedValue(new Error('Invalid grant')),
      };
      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);

      mockPrismaService.integration_tokens.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.refreshAccessToken(REAL_USERS.EXPIRED_1.id);

      expect(result).toBe(false);
      expect(
        mockPrismaService.integration_tokens.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          user_id: REAL_USERS.EXPIRED_1.id,
          provider: 'GOOGLE_CALENDAR',
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
          updated_at: expect.any(Date),
        },
      });
    });

    it('should successfully refresh expired token', async () => {
      // Token expired 1 hour ago
      const expiredDate = new Date(Date.now() - 60 * 60 * 1000);
      const newExpiryDate = Date.now() + 60 * 60 * 1000;

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: REAL_USERS.EXPIRED_2.id,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'old-access-token',
        refresh_token: 'valid-refresh-token',
        expires_at: expiredDate,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-access-token',
            expiry_date: newExpiryDate,
          },
        }),
      };
      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);

      mockPrismaService.integration_tokens.update.mockResolvedValue({});

      const result = await service.refreshAccessToken(REAL_USERS.EXPIRED_2.id);

      expect(result).toBe(true);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'valid-refresh-token',
      });
      expect(mockPrismaService.integration_tokens.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: {
          access_token: 'new-access-token',
          expires_at: new Date(newExpiryDate),
          updated_at: expect.any(Date),
        },
      });
    });
  });

  describe('refreshMultipleTokens', () => {
    it('should refresh tokens for multiple users in parallel', async () => {
      const userIds = [
        REAL_USERS.ACTIVE.id,
        REAL_USERS.EXPIRED_1.id,
        REAL_USERS.EXPIRED_2.id,
      ];

      // Mock different results for each user
      const refreshSpy = jest.spyOn(service, 'refreshAccessToken');
      refreshSpy
        .mockResolvedValueOnce(true) // ACTIVE user - success
        .mockResolvedValueOnce(false) // EXPIRED_1 - failed
        .mockResolvedValueOnce(true); // EXPIRED_2 - success

      const result = await service.refreshMultipleTokens(userIds);

      expect(result.size).toBe(3);
      expect(result.get(REAL_USERS.ACTIVE.id)).toBe(true);
      expect(result.get(REAL_USERS.EXPIRED_1.id)).toBe(false);
      expect(result.get(REAL_USERS.EXPIRED_2.id)).toBe(true);
      expect(refreshSpy).toHaveBeenCalledTimes(3);
    });

    it('should return empty map for empty user list', async () => {
      const result = await service.refreshMultipleTokens([]);

      expect(result.size).toBe(0);
    });

    it('should handle all failures gracefully', async () => {
      const userIds = [REAL_USERS.EXPIRED_1.id, REAL_USERS.EXPIRED_2.id];

      const refreshSpy = jest.spyOn(service, 'refreshAccessToken');
      refreshSpy.mockResolvedValue(false);

      const result = await service.refreshMultipleTokens(userIds);

      expect(result.size).toBe(2);
      expect(result.get(REAL_USERS.EXPIRED_1.id)).toBe(false);
      expect(result.get(REAL_USERS.EXPIRED_2.id)).toBe(false);
    });

    it('should handle partial success correctly', async () => {
      const userIds = [
        REAL_USERS.ACTIVE.id,
        REAL_USERS.EXPIRED_1.id,
        REAL_USERS.EXPIRED_2.id,
      ];

      const refreshSpy = jest.spyOn(service, 'refreshAccessToken');
      refreshSpy
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const result = await service.refreshMultipleTokens(userIds);

      const successCount = Array.from(result.values()).filter(Boolean).length;
      expect(successCount).toBe(1);
      expect(result.get(REAL_USERS.ACTIVE.id)).toBe(true);
    });
  });

  describe('Token expiry scenarios', () => {
    it('should refresh token expiring in 3 minutes', async () => {
      const soonToExpire = new Date(Date.now() + 3 * 60 * 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: REAL_USERS.ACTIVE.id,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'soon-to-expire-token',
        refresh_token: 'refresh-token',
        expires_at: soonToExpire,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 60 * 60 * 1000,
          },
        }),
      };
      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});

      const result = await service.refreshAccessToken(REAL_USERS.ACTIVE.id);

      expect(result).toBe(true);
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it('should not refresh token with exactly 5 minutes remaining', async () => {
      const exactlyFiveMinutes = new Date(Date.now() + 5 * 60 * 1000 + 1000);

      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: REAL_USERS.ACTIVE.id,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        expires_at: exactlyFiveMinutes,
        status: 'ACTIVE',
      });

      const result = await service.refreshAccessToken(REAL_USERS.ACTIVE.id);

      expect(result).toBe(true);
      expect(
        mockPrismaService.integration_tokens.update,
      ).not.toHaveBeenCalled();
    });

    it('should handle null expires_at as expired', async () => {
      mockPrismaService.integration_tokens.findFirst.mockResolvedValue({
        id: 'token-1',
        user_id: REAL_USERS.ACTIVE.id,
        provider: 'GOOGLE_CALENDAR',
        access_token: 'token-without-expiry',
        refresh_token: 'refresh-token',
        expires_at: null,
        status: 'ACTIVE',
      });

      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-token',
            expiry_date: Date.now() + 60 * 60 * 1000,
          },
        }),
      };
      jest
        .spyOn(service as any, 'createOAuth2Client')
        .mockReturnValue(mockOAuth2Client);
      mockPrismaService.integration_tokens.update.mockResolvedValue({});

      const result = await service.refreshAccessToken(REAL_USERS.ACTIVE.id);

      expect(result).toBe(true);
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });
  });
});
