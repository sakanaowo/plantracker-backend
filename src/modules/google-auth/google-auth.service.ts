import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private oauth2Client: OAuth2Client;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.oauth2Client = new OAuth2Client(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );
  }

  /**
   * Generate Google OAuth URL
   */
  getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId to identify user after callback
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleCallback(code: string, userId: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      // Get user info from Google
      this.oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      // Store/update integration token
      const integration = await this.prisma.integration_tokens.upsert({
        where: {
          user_id_provider: {
            user_id: userId,
            provider: 'GOOGLE_CALENDAR',
          },
        },
        create: {
          user_id: userId,
          provider: 'GOOGLE_CALENDAR',
          account_email: userInfo.data.email,
          external_user_id: userInfo.data.id,
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          token_type: tokens.token_type,
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          status: 'ACTIVE',
        },
        update: {
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token || undefined,
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          status: 'ACTIVE',
          updated_at: new Date(),
        },
      });

      this.logger.log(`Google Calendar connected for user ${userId}`);
      return {
        success: true,
        accountEmail: userInfo.data.email,
        message: 'Google Calendar connected successfully',
      };
    } catch (error) {
      this.logger.error('Google OAuth callback failed:', error);
      throw error;
    }
  }

  /**
   * Get valid OAuth client for user
   */
  async getAuthenticatedClient(userId: string): Promise<OAuth2Client | null> {
    const integration = await this.prisma.integration_tokens.findFirst({
      where: {
        user_id: userId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
      },
    });

    if (!integration) {
      return null;
    }

    this.oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    });

    // Auto-refresh token if expired
    if (integration.expires_at && integration.expires_at <= new Date()) {
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();

        await this.prisma.integration_tokens.update({
          where: { id: integration.id },
          data: {
            access_token: credentials.access_token!,
            expires_at: credentials.expiry_date
              ? new Date(credentials.expiry_date)
              : null,
            updated_at: new Date(),
          },
        });

        this.oauth2Client.setCredentials(credentials);
      } catch (error) {
        this.logger.error('Token refresh failed:', error);
        return null;
      }
    }

    return this.oauth2Client;
  }

  /**
   * Check integration status
   */
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
      accountEmail: integration?.account_email,
      connectedAt: integration?.created_at,
      lastSync: integration?.updated_at,
    };
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnect(userId: string) {
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

    this.logger.log(`Google Calendar disconnected for user ${userId}`);
    return { success: true, message: 'Disconnected successfully' };
  }
}
